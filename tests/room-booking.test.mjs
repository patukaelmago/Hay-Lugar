import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAvailability,emptyAvailability} from '../lib/availability.mjs';
import {remaining,slotsForDate} from '../lib/reservations.mjs';
import {withinBookingWindow} from '../lib/booking-settings.mjs';
const base=()=>({...emptyAvailability(),mode:'tables',tables:[{name:'1',seats:8,sector:'Salón'},{name:'2',seats:4,sector:'Patio'},{name:'3',seats:2,sector:'Patio',enabled:false}],layouts:[{id:'patio',name:'Patio',enabled:true,tables:['2','3']}],slots:[{type:'date',date:'2026-10-10',time:'20:00',duration:90,layoutId:'patio'}]});
test('turn layout limits inventory and excludes disabled tables',()=>{
 const settings=validateAvailability(base()),slot=slotsForDate(settings,'2026-10-10')[0];
 assert.deepEqual(remaining(settings,slot,[],2).tables.map(table=>table.name),['2']);
 assert.equal(remaining(settings,slot,[],5).available,false);
 assert.equal(remaining(settings,slot,[],2,'Salón').available,false);
 assert.equal(remaining({...settings,layouts:settings.layouts.map(layout=>({...layout,enabled:false}))},slot,[],1).available,false);
});
test('automatic assignment prefers smallest suitable table and respects minimum size',()=>{
 const settings=validateAvailability(base());
 assert.deepEqual(remaining(settings,{start:0,end:100},[],3).tables.map(table=>table.name),['2','1']);
 settings.tables[1].minPartySize=4;
 assert.deepEqual(remaining(settings,{start:0,end:100},[],3).tables.map(table=>table.name),['1']);
 assert.equal(remaining(settings,{start:0,end:100},[{table:'1',partySize:5,start:30,end:80}],3).available,false);
});
test('booking window applies notice, group size, advance limit and public state',()=>{
 const now=Date.parse('2026-10-01T15:00:00Z'),settings={booking:{maxAdvanceDays:10,minNoticeMinutes:120,maxPartySize:6,publicEnabled:true}};
 assert.equal(withinBookingWindow(settings,{start:now+60*60000},2,now),false);
 assert.equal(withinBookingWindow(settings,{start:now+180*60000},2,now),true);
 assert.equal(withinBookingWindow(settings,{start:now+180*60000},7,now),false);
 assert.equal(withinBookingWindow(settings,{start:now+11*86400000},2,now),false);
 assert.equal(withinBookingWindow({booking:{publicEnabled:false}},{start:now+180*60000},2,now),false);
});
test('reject dangling layouts, invalid table minima and booking policies',()=>{
 for(const patch of [{layouts:[{id:'x',name:'X',enabled:true,tables:['missing']}]},{slots:[{type:'date',date:'2026-10-10',time:'20:00',duration:90,layoutId:'missing'}]},{booking:{minNoticeMinutes:-1}},{tables:[{name:'1',seats:2,sector:'',minPartySize:3}]}]) assert.throws(()=>validateAvailability({...base(),...patch}));
});
