import { slotsForDate } from './reservations.mjs';
const pulpoPositions = {
  '1': { x: 12, y: 76, shape: 'round' }, '2': { x: 22, y: 47, shape: 'square' },
  '3': { x: 36, y: 15, shape: 'round' }, '4': { x: 47, y: 81, shape: 'square' },
  '5': { x: 59, y: 23, shape: 'square' }, '6': { x: 70, y: 20, shape: 'square' },
  '7': { x: 87, y: 18, shape: 'round' }, '8': { x: 66, y: 49, shape: 'square' },
  '9': { x: 68, y: 90, shape: 'square' }, '10': { x: 86, y: 86, shape: 'square' },
  '110': { x: 43, y: 50, shape: 'square' }, '120': { x: 84, y: 47, shape: 'square' }
};
export function tableLayout(tenantId, table, index, total = 25) {
  if (table.layout) return table.layout;
  if (tenantId === 'pulpo' && pulpoPositions[table.name]) return { ...pulpoPositions[table.name] };
  return { x: 12 + (index % 5) * 18, y: 5 + (Math.floor(index / 5) + .5) * 90 / Math.max(1, Math.ceil(total / 5)), shape: 'square' };
}
export function serviceState(reservation) { return reservation.serviceState || 'waiting'; }
export function transitionService(reservation, next, now = Date.now()) {
  const current = serviceState(reservation);
  if (reservation.status === 'cancelled') throw new Error('La reserva está cancelada.');
  if (!['arrived', 'completed', 'no_show'].includes(next)) throw new Error('Acción inválida.');
  if (current === next) return { changed: false, release: false };
  const allowed = current === 'waiting' ? ['arrived', 'no_show'] : current === 'arrived' ? ['completed'] : [];
  if (!allowed.includes(next)) throw new Error('La reserva cambió de estado. Actualizá el turno.');
  if (next === 'no_show' && reservation.start > now) throw new Error('Todavía no llegó el horario de la reserva.');
  return { changed: true, release: next === 'completed' || next === 'no_show' };
}
export function reservationsForView(reservations, settings, date, time) {
  if (!time) return reservations.filter(r => r.date === date);
  const slot = slotsForDate(settings, date).find(s => s.time === time);
  if (!slot) return reservations.filter(r => r.date === date && r.time === time);
  return reservations.filter(r => r.start < slot.end && r.end > slot.start);
}
export function tableReservations(reservations, name) {
  return reservations.filter(r => r.table === name && r.status !== 'cancelled' && !['completed','no_show'].includes(serviceState(r)));
}
