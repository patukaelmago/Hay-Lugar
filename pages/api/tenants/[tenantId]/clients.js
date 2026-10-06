import { FieldValue, FieldPath } from 'firebase-admin/firestore';
import { authorize } from '../../../../lib/server';
import { validateNotes } from '../../../../lib/clients.mjs';
const revision = snapshot => snapshot.updateTime ? `${snapshot.updateTime.seconds}:${snapshot.updateTime.nanoseconds}` : null;
const serialize = snapshot => {
  const data = snapshot.data();
  return { id: snapshot.id, name: data.name, email: data.email, phone: data.phone, notes: data.notes || '', totalReservations: data.totalReservations || 0, confirmedReservations: data.confirmedReservations || 0, cancelledReservations: data.cancelledReservations || 0, lastReservation: data.lastReservation || '', revision: revision(snapshot) };
};
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET','PUT'].includes(req.method)) { res.setHeader('Allow', 'GET, PUT');return res.status(405).json({ error: 'Método no permitido.' }); }
  try {
    const { db, uid } = await authorize(req,req.query.tenantId);
    const root = `tenants/${req.query.tenantId}`;
    const id = req.method === 'PUT' ? req.body?.id : req.query.id;
    if (id !== undefined && (typeof id !== 'string' || !/^[0-9a-f]{64}$/.test(id))) return res.status(400).json({ error: 'Cliente inválido.' });
    if (req.method === 'PUT') {
      let notes;
      try { notes = validateNotes(req.body?.notes); } catch (err) { return res.status(400).json({ error: err.message }); }
      if (!id) return res.status(400).json({ error: 'Elegí un cliente.' });
      const ref = db.doc(`${root}/clients/${id}`);
      await db.runTransaction(async tx => {
        const snapshot = await tx.get(ref);
        if (!snapshot.exists) throw Object.assign(new Error('No encontramos al cliente.'), { status: 404 });
        if (revision(snapshot) !== req.body.revision) throw Object.assign(new Error('La ficha cambió. Volvé a abrirla antes de guardar.'), { status: 409 });
        tx.update(ref,{ notes, notesUpdatedBy: uid, updatedAt: FieldValue.serverTimestamp() });
      });
      return res.status(200).json({ client: serialize(await ref.get()) });
    }
    if (id) {
      const snapshot = await db.doc(`${root}/clients/${id}`).get();
      if (!snapshot.exists) return res.status(404).json({ error: 'No encontramos al cliente.' });
      const history = await db.collection(`${root}/reservations`).where('email','==',snapshot.data().email).get();
      return res.status(200).json({ client: serialize(snapshot), reservations: history.docs.map(doc => {
        const data = doc.data();return { id: doc.id, date: data.date, time: data.time, partySize: data.partySize, table: data.table, status: data.status, serviceState: data.serviceState || 'waiting' };
      }).sort((a,b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)) });
    }
    let query = db.collection(`${root}/clients`).orderBy(FieldPath.documentId()).limit(51);
    if (req.query.after !== undefined) {
      if (typeof req.query.after !== 'string' || !/^[0-9a-f]{64}$/.test(req.query.after)) return res.status(400).json({ error: 'Página inválida.' });
      query = query.startAfter(req.query.after);
    }
    const snapshot = await query.get(), page = snapshot.docs.slice(0,50);
    return res.status(200).json({ clients: page.map(serialize), next: snapshot.docs.length > 50 ? page.at(-1).id : null });
  } catch (err) {
    if (!err.status) console.error('Clients backend:', err.code || err.message);
    return res.status(err.status || 503).json({ error: err.status ? err.message : 'No pudimos cargar los clientes. Volvé a intentar.' });
  }
}
