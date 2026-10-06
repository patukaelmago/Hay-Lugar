import { FieldValue } from 'firebase-admin/firestore';
import { authorize } from '../../../lib/server';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Método no permitido.'});}
  try {
    // Decode the account with the same Google verification as tenant endpoints.
    const {db,email,isSuperadmin}=await authorize(req,'pulpo',true);
    if(req.method==='POST') {
      if(!isSuperadmin)return res.status(403).json({error:'Solo el superadmin puede crear negocios.'});
      const {id,name,adminEmail}=req.body || {};
      if(typeof id!=='string'||!/^[a-z0-9][a-z0-9-]{0,59}$/.test(id)||typeof name!=='string'||!name.trim()||name.length>100||typeof adminEmail!=='string'||adminEmail.length>160||(adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)))return res.status(400).json({error:'Revisá el identificador, nombre y correo del administrador.'});
      if(id==='pulpo')return res.status(409).json({error:'Pulpo ya está reservado para el negocio existente.'});
      const ref=db.doc(`tenants/${id}`);
      await db.runTransaction(async tx=>{const doc=await tx.get(ref);if(doc.exists)throw Object.assign(new Error('Ya existe un negocio con este identificador.'),{status:409});tx.set(ref,{name:name.trim(),allowedEmails:adminEmail?[adminEmail.trim().toLowerCase()]:[],createdAt:FieldValue.serverTimestamp()});});
      return res.status(200).json({created:true,id});
    }
    const snapshot=isSuperadmin?await db.collection('tenants').limit(100).get():await db.collection('tenants').where('allowedEmails','array-contains',email).limit(100).get();
    const tenants=snapshot.docs.map(doc=>({id:doc.id,name:doc.data().name || doc.id}));
    if(isSuperadmin && !tenants.some(tenant=>tenant.id==='pulpo'))tenants.unshift({id:'pulpo',name:'Pulpo Sushi'});
    return res.status(200).json({tenants,isSuperadmin});
  }catch(err){return res.status(err.status || 503).json({error:err.status?err.message:'No pudimos consultar tus negocios.'});}
}
