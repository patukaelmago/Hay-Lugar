import { validDate } from './reservations.mjs';
export function validateWaitlist(input) {
  if (!input || !validDate(input.date) || typeof input.name !== 'string' || input.name.trim().length < 2 || input.name.length > 100 || typeof input.phone !== 'string' || input.phone.length > 40 || input.phone.replace(/\D/g,'').length < 8 || !/^[+\d\s()-]+$/.test(input.phone) || !Number.isInteger(input.partySize) || input.partySize < 1 || input.partySize > 100) throw new Error('Completá fecha, nombre, teléfono y cantidad de personas.');
  if (typeof input.notes !== 'string' || input.notes.length > 1000) throw new Error('Las notas admiten hasta 1000 caracteres.');
  if (typeof input.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId)) throw new Error('Recargá para agregar a la lista.');
  return {date:input.date,name:input.name.trim(),phone:input.phone.trim(),partySize:input.partySize,notes:input.notes.trim(),requestId:input.requestId};
}
