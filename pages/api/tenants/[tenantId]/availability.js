import { authorize } from '../../../../lib/server';
import { emptyAvailability, validateAvailability } from '../../../../lib/availability.mjs';
import { FieldValue } from 'firebase-admin/firestore';
import { argentinaToday, remaining } from '../../../../lib/reservations.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'PUT'].includes(req.method)) { res.setHeader('Allow', 'GET, PUT'); return res.status(405).json({ error: 'Método no permitido.' }); }
  try {
    const { db, uid } = await authorize(req, req.query.tenantId);
    const ref = db.doc(`tenants/${req.query.tenantId}/settings/availability`);
    if (req.method === 'GET') {
      const snapshot = await ref.get();
      return res.status(200).json({ availability: snapshot.exists ? validateAvailability(snapshot.data()) : emptyAvailability(), revision: snapshot.updateTime ? `${snapshot.updateTime.seconds}:${snapshot.updateTime.nanoseconds}` : null });
    }
    let availability;
    try { availability = validateAvailability(req.body?.availability); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    const revision = await db.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      if ((snapshot.updateTime ? `${snapshot.updateTime.seconds}:${snapshot.updateTime.nanoseconds}` : null) !== req.body.revision) throw Object.assign(new Error('Otra persona modificó la configuración. Recargá antes de guardar.'), { status: 409 });
      const reservations = await tx.get(db.collection(`tenants/${req.query.tenantId}/reservations`).where('date', '>=', argentinaToday()));
      const active = reservations.docs.map(doc => doc.data()).filter(data => data.status === 'confirmed' && data.end > Date.now());
      const previous = snapshot.data();
      if (active.length && previous?.mode !== availability.mode) throw Object.assign(new Error('Hay reservas futuras. Cancelalas antes de cambiar la modalidad.'), { status: 409 });
      if (availability.mode === 'tables' && active.some(data => !availability.tables.some(table => table.name === data.table && table.seats >= data.partySize))) throw Object.assign(new Error('Una mesa tiene reservas futuras. Conservá su nombre y capacidad o cancelá esas reservas.'), { status: 409 });
      if (availability.mode === 'capacity' && active.some(data => !remaining(availability, { start: data.start, end: data.end }, active, 0).available)) throw Object.assign(new Error('El cupo nuevo es menor que las reservas ya confirmadas.'), { status: 409 });
      tx.set(ref, { ...availability, updatedBy: uid, updatedAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (revision) return res.status(200).json({ saved: true });
  } catch (error) {
    if (!error.status) console.error('Availability backend:', error.code || error.message);
    return res.status(error.status || 503).json({ error: error.status ? error.message : 'No pudimos conectar con la base de datos. Volvé a intentar.' });
  }
}
