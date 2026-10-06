import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export function services() {
  const app = getApps()[0] || initializeApp({ credential: applicationDefault(), projectId: 'hay-lugar-1346d' });
  return { auth: getAuth(app), db: getFirestore(app) };
}
export async function authorize(req, tenantId) {
  if (typeof tenantId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,59}$/.test(tenantId)) throw Object.assign(new Error('Negocio inválido.'), { status: 400 });
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw Object.assign(new Error('Ingresá con Google para continuar.'), { status: 401 });
  const { auth, db } = services();
  let user;
  try { user = await auth.verifyIdToken(token); }
  catch { throw Object.assign(new Error('Tu sesión venció. Volvé a ingresar.'), { status: 401 }); }
  if (!user.email_verified || !user.email || user.firebase?.sign_in_provider !== 'google.com') throw Object.assign(new Error('Ingresá con una cuenta de Google verificada.'), { status: 403 });
  const email = user.email.toLowerCase();
  if (email !== 'patriciouskaer@gmail.com') {
    const tenant = await db.doc(`tenants/${tenantId}`).get();
    if (!tenant.exists || !Array.isArray(tenant.data().allowedEmails) || !tenant.data().allowedEmails.some(e => typeof e === 'string' && e.toLowerCase() === email)) throw Object.assign(new Error('Tu cuenta no tiene acceso a este negocio.'), { status: 403 });
  }
  return { db, uid: user.uid };
}
