import test from 'node:test';
import assert from 'node:assert/strict';
import {tableLayout,transitionService,tableReservations,reservationsForView} from '../lib/guest-center.mjs';
import {validateAvailability} from '../lib/availability.mjs';
import {initialAvailability} from '../lib/initial-availability.mjs';
test('Pulpo floor plan is tenant-specific and preserves saved edits after a rename',()=>{
 assert.equal(tableLayout('pulpo',{name:'1'},0).shape,'round');assert.equal(tableLayout('otro',{name:'1'},0).shape,'square');
 const layout={x:65,y:40,shape:'round'};assert.deepEqual(tableLayout('otro',{name:'Mi mesa',layout},2),layout);
 const settings=initialAvailability('pulpo');settings.tables[0].name='VIP';settings.tables[0].layout.x=20;assert.equal(validateAvailability(settings).tables[0].layout.x,20);
 settings.tables[0].layout.x=101;assert.throws(()=>validateAvailability(settings),/posición/);
});
test('arrival does not release inventory; completion and no-show do; terminal state cannot reopen',()=>{
 const reservation={status:'confirmed',start:100,end:300};
 assert.deepEqual(transitionService(reservation,'arrived',150),{changed:true,release:false});
 assert.equal(transitionService({...reservation,serviceState:'arrived'},'completed',200).release,true);
 assert.equal(transitionService(reservation,'no_show',150).release,true);
 assert.throws(()=>transitionService(reservation,'no_show',50));assert.throws(()=>transitionService({...reservation,serviceState:'completed'},'arrived',200));
 assert.deepEqual(transitionService({...reservation,serviceState:'completed'},'completed',200),{changed:false,release:false});
 assert.throws(()=>transitionService({...reservation,status:'cancelled'},'arrived',200));
});
test('table status ignores cancelled and closed service but keeps waiting and arrived',()=>{
 const reservations=[{table:'1',status:'confirmed'},{table:'1',status:'confirmed',serviceState:'arrived'},{table:'1',status:'cancelled'},{table:'1',status:'confirmed',serviceState:'completed'},{table:'1',status:'confirmed',serviceState:'no_show'},{table:'2',status:'confirmed'}];assert.equal(tableReservations(reservations,'1').length,2);
});
test('selected service includes reservations overlapping midnight from the prior day',()=>{
 const settings=initialAvailability('pulpo');settings.slots=[{type:'date',date:'2026-10-11',time:'00:30',duration:90}];
 const reservations=[{date:'2026-10-10',time:'23:30',start:Date.parse('2026-10-11T02:30:00Z'),end:Date.parse('2026-10-11T04:30:00Z')},{date:'2026-10-11',time:'20:30',start:Date.parse('2026-10-11T23:30:00Z'),end:Date.parse('2026-10-12T01:00:00Z')}];
 assert.equal(reservationsForView(reservations,settings,'2026-10-11','00:30')[0].date,'2026-10-10');assert.equal(reservationsForView(reservations,settings,'2026-10-11','').length,1);
});
