import { createHash } from 'node:crypto';
export function clientIdFor(email) {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}
export function profileForBooking(previous, booking) {
  return {
    name: previous?.name || booking.name,
    email: booking.email.trim().toLowerCase(),
    phone: previous?.phone || booking.phone,
    notes: previous?.notes || '',
    totalReservations: (previous?.totalReservations || 0) + 1,
    confirmedReservations: (previous?.confirmedReservations || 0) + 1,
    cancelledReservations: previous?.cancelledReservations || 0,
    lastReservation: [previous?.lastReservation || '', `${booking.date} ${booking.time}`].sort().at(-1)
  };
}
export function profileAfterCancel(previous) {
  if (!previous) return null;
  return { confirmedReservations: Math.max(0, (previous.confirmedReservations || 0) - 1), cancelledReservations: (previous.cancelledReservations || 0) + 1 };
}
export function validateNotes(input) {
  if (typeof input !== 'string' || input.length > 3000) throw new Error('Las notas pueden tener hasta 3000 caracteres.');
  return input.trim();
}
