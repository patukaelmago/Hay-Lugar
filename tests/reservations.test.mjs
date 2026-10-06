import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyAvailability } from '../lib/availability.mjs';
import { slotsForDate, remaining, nearbyDates, validateRequest } from '../lib/reservations.mjs';
const settings = () => ({...emptyAvailability(),capacity:6,slots:[{type:'weekly',days:[6],time:'20:00',duration:90}]});
test('date-specific service replaces weekly hours and closures take precedence',()=>{
 const config=settings();config.slots.push({type:'date',date:'2026-10-10',time:'21:00',duration:90});assert.equal(slotsForDate(config,'2026-10-10')[0].time,'21:00');assert.equal(slotsForDate(config,'2026-10-10').length,1);config.closedDates.push('2026-10-10');assert.deepEqual(slotsForDate(config,'2026-10-10'),[]);
});
test('capacity uses peak occupancy and half-open boundaries',()=>{
 const config=settings(),slot={start:0,end:100};
 const entries=[{start:0,end:50,partySize:4},{start:50,end:100,partySize:4}];
 assert.equal(remaining(config,slot,entries,2).available,true);assert.equal(remaining(config,slot,entries,3).available,false);
 assert.equal(remaining(config,{start:100,end:200},entries,6).available,true);
});
test('mesas exclude occupied and undersized tables; mode change cannot double-book',()=>{
 const config={...settings(),mode:'tables',tables:[{name:'Mesa 1',seats:4,sector:'Salón'},{name:'Mesa 2',seats:2,sector:'Patio'}]},slot={start:0,end:100};
 assert.equal(remaining(config,slot,[{start:10,end:20,partySize:2,table:'Mesa 1'}],3).available,false);
 assert.equal(remaining(config,slot,[{start:10,end:20,partySize:2,table:null}],1).available,false);
 assert.equal(remaining(config,slot,[],3).tables[0].name,'Mesa 1');
});
test('midnight duration checks adjacent dates including year boundaries',()=>{
 assert.deepEqual(nearbyDates('2027-01-01'),['2026-12-31','2027-01-01','2027-01-02']);
 const config={...settings(),slots:[{type:'date',date:'2026-10-10',time:'23:30',duration:90}]};const slot=slotsForDate(config,'2026-10-10')[0];assert.equal(new Date(slot.end).toISOString(),'2026-10-11T04:00:00.000Z');
});
test('reject invalid contact details, party size, paths and request identifiers',()=>{
 const base={date:'2026-10-10',time:'20:00',partySize:2,name:'Pato',email:'pato@example.com',phone:'+54 341 1234567',requestId:'12345678-1234-4234-8234-123456789abc'};
 assert.equal(validateRequest(base).name,'Pato');
 for(const patch of [{date:'../../admin'},{partySize:-1},{email:'invalid'},{phone:'abc'},{requestId:'existing/doc'}])assert.throws(()=>validateRequest({...base,...patch}));
});
