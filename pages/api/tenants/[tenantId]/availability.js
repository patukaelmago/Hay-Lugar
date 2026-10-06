import { authorize } from '../../../../lib/server';
import { emptyAvailability, validateAvailability } from '../../../../lib/availability.mjs';
import { FieldValue } from 'firebase-admin/firestore';

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
      tx.set(ref, { ...availability, updatedBy: uid, updatedAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (revision) return res.status(200).json({ saved: true });
  } catch (error) {
    if (!error.status) console.error('Availability backend:', error.code || error.message);
    return res.status(error.status || 503).json({ error: error.status ? error.message : 'No pudimos conectar con la base de datos. Volvé a intentar.' });
  }
}
