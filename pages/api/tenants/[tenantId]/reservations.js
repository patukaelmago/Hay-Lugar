import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { services, authorize } from '../../../../lib/server';
import { clientIdFor, profileForBooking, profileAfterCancel } from '../../../../lib/clients.mjs';
import { validateAvailability } from '../../../../lib/availability.mjs';
import { argentinaToday, validDate, validateRequest, slotsForDate, remaining, nearbyDates } from '../../../../lib/reservations.mjs';
const failure = (message, status = 400) => Object.assign(new Error(message), { status });
const confirmation = (id, data) => ({ id, date: data.date, time: data.time, partySize: data.partySize, table: data.table });
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) { res.setHeader('Allow', 'GET, POST, PATCH'); return res.status(405).json({ error: 'Método no permitido.' }); }
  try {
    const tenant = req.query.tenantId;
    if (typeof tenant !== 'string' || !/^[a-z0-9][a-z0-9-]{0,59}$/.test(tenant)) throw failure('Negocio inválido.');
    if (req.method === 'GET' && req.query.admin === 'true') {
      const { db } = await authorize(req, tenant);
      const date = req.query.date;
      if (!validDate(date)) throw failure('Elegí una fecha.');
      const snapshot = await db.collection(`tenants/${tenant}/reservations`).where('date', '==', date).get();
      return res.status(200).json({ reservations: snapshot.docs.map(doc => {
        const { requestHash, ...data } = doc.data(); return { ...data, createdAt: data.createdAt?.toDate().toISOString() || null, id: doc.id };
      }).sort((a,b) => a.time.localeCompare(b.time)) });
    }
    if (req.method === 'PATCH') {
      const { db } = await authorize(req, tenant);
      if (typeof req.body?.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(req.body.id)) throw failure('Reserva inválida.');
      const ref = db.doc(`tenants/${tenant}/reservations/${req.body.id}`);
      await db.runTransaction(async tx => {
        const doc = await tx.get(ref);
        if (!doc.exists) throw failure('No encontramos la reserva.', 404);
        const data = doc.data();
        if (data.status === 'cancelled') return;
        const occupancyRef = db.doc(`tenants/${tenant}/occupancy/${data.date}`);
        const occupancy = await tx.get(occupancyRef);
        const clientRef = db.doc(`tenants/${tenant}/clients/${clientIdFor(data.email)}`);
        const client = await tx.get(clientRef);
        if (client.exists) tx.update(clientRef, { ...profileAfterCancel(client.data()), updatedAt: FieldValue.serverTimestamp() });
        tx.set(occupancyRef, { entries: (occupancy.data()?.entries || []).filter(e => e.id !== ref.id) });
        tx.update(ref, { status: 'cancelled', cancelledAt: FieldValue.serverTimestamp() });
      });
      return res.status(200).json({ cancelled: true });
    }
    const { db } = services();
    const settingsRef = db.doc(`tenants/${tenant}/settings/availability`);
    if (req.method === 'GET') {
      const date = req.query.date, partySize = Number(req.query.partySize);
      if (!validDate(date) || !Number.isInteger(partySize) || partySize < 1 || partySize > 100 || date < argentinaToday()) throw failure('Elegí una fecha y cantidad de personas válidas.');
      const snapshot = await settingsRef.get();
      if (!snapshot.exists) return res.status(200).json({ slots: [], configured: false });
      const settings = validateAvailability(snapshot.data());
      const occupancy = await db.getAll(...nearbyDates(date).map(d => db.doc(`tenants/${tenant}/occupancy/${d}`)));
      const entries = occupancy.flatMap(doc => doc.data()?.entries || []);
      return res.status(200).json({ mode: settings.mode, configured: true, slots: slotsForDate(settings, date).filter(slot => slot.start > Date.now()).map(slot => ({ time: slot.time, ...remaining(settings, slot, entries, partySize) })) });
    }
    let input;
    try { input = validateRequest(req.body); } catch (err) { throw failure(err.message); }
    const { requestId, ...details } = input;
    const requestHash = createHash('sha256').update(JSON.stringify(details)).digest('hex');
    const ref = db.doc(`tenants/${tenant}/reservations/${requestId}`);
    const result = await db.runTransaction(async tx => {
      const existing = await tx.get(ref);
      if (existing.exists) {
        if (existing.data().requestHash !== requestHash) throw failure('Iniciá una nueva reserva.', 409);
        if (existing.data().status === 'cancelled') throw failure('Esta reserva fue cancelada. Iniciá una nueva.', 409);
        return confirmation(ref.id, existing.data());
      }
      const snapshot = await tx.get(settingsRef);
      if (!snapshot.exists) throw failure('El negocio todavía no habilitó sus reservas.', 409);
      const settings = validateAvailability(snapshot.data());
      const slot = slotsForDate(settings, input.date).find(s => s.time === input.time);
      if (!slot || slot.start <= Date.now()) throw failure('Este horario ya no está disponible.', 409);
      const refs = nearbyDates(input.date).map(date => db.doc(`tenants/${tenant}/occupancy/${date}`));
      const occupancy = await tx.getAll(...refs);
      const entries = occupancy.flatMap(doc => doc.data()?.entries || []);
      const available = remaining(settings, slot, entries, input.partySize);
      if (!available.available || (settings.mode === 'tables' && !available.tables.some(t => t.name === input.table))) throw failure('El lugar acaba de ocuparse. Elegí otro horario o mesa.', 409);
      const table = settings.mode === 'tables' ? input.table : null;
      const current = occupancy[1].data()?.entries || [];
      const clientRef = db.doc(`tenants/${tenant}/clients/${clientIdFor(input.email)}`);
      const client = await tx.get(clientRef);
      tx.set(clientRef, { ...profileForBooking(client.data(), details), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      // Each booking reads the adjacent days, so transactions also protect midnight overlaps.
      tx.set(refs[1], { entries: [...current, { id: ref.id, start: slot.start, end: slot.end, partySize: input.partySize, table }] });
      tx.set(ref, { ...details, table, start: slot.start, end: slot.end, status: 'confirmed', requestHash, createdAt: FieldValue.serverTimestamp() });
      return confirmation(ref.id, { ...details, table });
    });
    return res.status(200).json({ reservation: result });
  } catch (error) {
    if (!error.status) console.error('Reservations backend:', error.code || error.message);
    return res.status(error.status || 503).json({ error: error.status ? error.message : 'No pudimos conectar con el negocio. Volvé a intentar.' });
  }
}
