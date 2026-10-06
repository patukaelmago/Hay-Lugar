import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {emptyAvailability} from '../lib/availability.mjs';
const hooks=registerHooks({
 resolve(specifier,context,next){
  if(specifier==='firebase-admin/firestore')return {url:'mock:firestore-fields',shortCircuit:true};
  if(specifier.endsWith('/lib/server') || specifier.endsWith('/lib/server.js'))return {url:'mock:booking-server',shortCircuit:true};
  if(specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier))return next(`${specifier}.js`,context);
  return next(specifier,context);
 },
 load(url,context,next){if(url==='mock:firestore-fields')return {format:'module',shortCircuit:true,source:`export const FieldValue={serverTimestamp:()=> 'server-timestamp'};`};if(url==='mock:booking-server')return {format:'module',shortCircuit:true,source:`export function services(){return globalThis.__bookingServices;} export async function authorize(req){if(req.headers.authorization!=='Bearer staff')throw Object.assign(new Error('Ingresá con Google.'),{status:401});return {...services(),uid:'staff'};}`};return next(url,context);}
});
const {default:handler}=await import('../pages/api/tenants/[tenantId]/reservations.js');
const future=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
function database(settings){
 const store=new Map([['tenants/pulpo/settings/availability',settings]]);
 const ref=path=>({path,id:path.split('/').at(-1)});
 const snapshot=reference=>({exists:store.has(reference.path),data:()=>store.get(reference.path),id:reference.id});
 let queue=Promise.resolve();
 return {store,doc:ref,runTransaction(work){const promise=queue.then(async()=>{let writing=false;const writes=[];const tx={get:async reference=>{assert.equal(writing,false,'Firestore requires every read before the first write');return snapshot(reference);},getAll:async(...references)=>{assert.equal(writing,false);return references.map(snapshot);},set(reference,data,options){writing=true;writes.push(()=>store.set(reference.path,options?.merge?{...store.get(reference.path),...data}:data));},update(reference,data){writing=true;writes.push(()=>store.set(reference.path,{...store.get(reference.path),...data}));}};const result=await work(tx);writes.forEach(write=>write());return result;});queue=promise.catch(()=>{});return promise;}};
}
const settings=()=>({...emptyAvailability(),mode:'tables',tables:[{name:'1',seats:8,sector:'Salón'},{name:'2',seats:4,sector:'Salón'}],slots:[{type:'date',date:future,time:'20:00',duration:90}]});
const body=(requestId='12345678-1234-4234-8234-123456789abc')=>({requestId,date:future,time:'20:00',partySize:3,name:'Cliente',phone:'+54 341 1234567',email:'cliente@example.com'});
async function call(input,headers={}){let status=200,result;await handler({method:'POST',query:{tenantId:'pulpo'},headers,body:input},{setHeader(){},status(code){status=code;return this;},json(data){result=data;return this;}});return {status,result};}
test('booking API atomically assigns tables and retries without duplicating profile or occupancy',async()=>{
 const db=database(settings());globalThis.__bookingServices={db};
 const first=await call(body());assert.equal(first.status,200);assert.equal(first.result.reservation.table,'2');
 const retry=await call(body());assert.deepEqual(retry,first);
 assert.equal(db.store.get(`tenants/pulpo/occupancy/${future}`).entries.length,1);
 const profile=[...db.store].find(([key])=>key.includes('/clients/'))[1];assert.equal(profile.totalReservations,1);
 const second=await call(body('22345678-1234-4234-8234-123456789abc'));assert.equal(second.result.reservation.table,'1');
 const full=await call(body('32345678-1234-4234-8234-123456789abc'));assert.equal(full.status,409);
});
test('two simultaneous requests cannot claim the same last table',async()=>{
 const config=settings();config.tables=config.tables.slice(1);const db=database(config);globalThis.__bookingServices={db};
 const results=await Promise.all([call(body()),call(body('22345678-1234-4234-8234-123456789abc'))]);
 assert.deepEqual(results.map(result=>result.status).sort(),[200,409]);assert.equal(db.store.get(`tenants/pulpo/occupancy/${future}`).entries.length,1);
});
test('public cannot bypass closed bookings as a manual request and must accept current policy',async()=>{
 let config=settings();config.booking={publicEnabled:false};globalThis.__bookingServices={db:database(config)};
 assert.equal((await call(body())).status,409);
 assert.equal((await call({...body(),manual:true})).status,401);
 assert.equal((await call({...body(),manual:true},{authorization:'Bearer staff'})).status,200);
 config=settings();config.booking={policy:'Llegar con puntualidad.'};globalThis.__bookingServices={db:database(config)};
 assert.equal((await call(body())).status,409);
 assert.equal((await call({...body(),policyAccepted:true,acceptedPolicy:'Versión anterior'})).status,409);
 assert.equal((await call({...body(),policyAccepted:true,acceptedPolicy:config.booking.policy})).status,200);
});
const {default:guestHandler}=await import('../pages/api/tenants/[tenantId]/guestcenter.js');
async function guest(input,tenantId='pulpo'){let status=200,result;await guestHandler({method:'PATCH',query:{tenantId},headers:{authorization:'Bearer staff'},body:input},{setHeader(){},status(code){status=code;return this;},json(data){result=data;return this;}});return {status,result};}
test('reassignment preserves occupancy and rejects occupied tables and another tenant',async()=>{
 const db=database(settings());globalThis.__bookingServices={db};
 const first=await call(body()),id=first.result.reservation.id;
 assert.equal((await guest({id,table:'1'})).status,200);
 assert.equal(db.store.get(`tenants/pulpo/reservations/${id}`).table,'1');
 assert.equal(db.store.get(`tenants/pulpo/occupancy/${future}`).entries[0].table,'1');
 await call(body('22345678-1234-4234-8234-123456789abc'));
 assert.equal((await guest({id,table:'2'})).status,409);
 assert.equal((await guest({id,table:'1'},'otro-local')).status,404);
 assert.equal(db.store.get(`tenants/pulpo/reservations/${id}`).table,'1');
});
test('arrival retains inventory and completion releases it exactly once',async()=>{
 const db=database(settings());globalThis.__bookingServices={db};const reservation=await call(body()),id=reservation.result.reservation.id;
 assert.equal((await guest({id,serviceState:'arrived'})).status,200);
 assert.equal(db.store.get(`tenants/pulpo/occupancy/${future}`).entries.length,1);
 assert.equal((await guest({id,serviceState:'completed'})).status,200);
 assert.equal(db.store.get(`tenants/pulpo/occupancy/${future}`).entries.length,0);
 assert.equal((await guest({id,serviceState:'completed'})).status,200);
 assert.equal((await guest({id,table:'1'})).status,409);
});
