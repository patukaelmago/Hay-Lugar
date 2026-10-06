import test from 'node:test';
import assert from 'node:assert/strict';
import { clientIdFor, profileForBooking, profileAfterCancel, validateNotes } from '../lib/clients.mjs';
const booking={name:'Pato',email:'pato@example.com',phone:'3411234567',date:'2026-10-10',time:'20:30'};
test('email canonicalization joins repeat reservations while keeping different clients separate',()=>{
 assert.equal(clientIdFor(' PATO@example.com '),clientIdFor(booking.email));assert.notEqual(clientIdFor('otro@example.com'),clientIdFor(booking.email));assert.match(clientIdFor(booking.email),/^[0-9a-f]{64}$/);
});
test('new reservations keep private notes and original contact without replacing latest date with an older date',()=>{
 const previous={name:'Patricio',phone:'3417654321',notes:'Nota privada',totalReservations:2,confirmedReservations:1,cancelledReservations:1,lastReservation:'2026-12-01 21:00'};
 const profile=profileForBooking(previous,booking);assert.equal(profile.notes,'Nota privada');assert.equal(profile.name,'Patricio');assert.equal(profile.phone,'3417654321');assert.equal(profile.lastReservation,previous.lastReservation);assert.equal(profile.totalReservations,3);assert.equal(profile.confirmedReservations,2);assert.equal(profile.cancelledReservations,1);
});
test('cancellation keeps totals and prevents negative confirmed counts',()=>{
 assert.deepEqual(profileAfterCancel({confirmedReservations:1,cancelledReservations:2}),{confirmedReservations:0,cancelledReservations:3});assert.equal(profileAfterCancel({confirmedReservations:0}).confirmedReservations,0);assert.equal(profileAfterCancel(null),null);
});
test('notes are bounded text',()=>{assert.equal(validateNotes(' Nota '),'Nota');assert.throws(()=>validateNotes({admin:true}));assert.throws(()=>validateNotes('a'.repeat(3001)));});
