import { FieldValue } from 'firebase-admin/firestore';
import { authorize } from '../../../../lib/server';
import { validDate } from '../../../../lib/reservations.mjs';
import { validateWaitlist } from '../../../../lib/waitlist.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST','PATCH'].includes(req.method)){res.setHeader('Allow','GET, POST, PATCH');return res.status(405).json({error:'Método no permitido.'});}
 try{
  const {db,uid}=await authorize(req,req.query.tenantId),collection=db.collection(`tenants/${req.query.tenantId}/waitlist`);
  if(req.method==='GET'){
   if(!validDate(req.query.date))return res.status(400).json({error:'Elegí una fecha válida.'});
   const snapshot=await collection.where('date','==',req.query.date).get();
   return res.status(200).json({entries:snapshot.docs.map(doc=>({...doc.data(),id:doc.id,createdAt:doc.data().createdAt?.toDate().toISOString()||null})).sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''))});
  }
  if(req.method==='POST'){
   let input;try{input=validateWaitlist(req.body);}catch(err){return res.status(400).json({error:err.message});}
   const {requestId,...data}=input,ref=collection.doc(requestId);
   await db.runTransaction(async tx=>{const doc=await tx.get(ref);if(doc.exists){if(JSON.stringify(doc.data().input)!==JSON.stringify(data))throw Object.assign(new Error('Iniciá una nueva carga.'),{status:409});return;}tx.set(ref,{...data,input:data,status:'waiting',createdBy:uid,createdAt:FieldValue.serverTimestamp()});});
   return res.status(200).json({saved:true});
  }
  if(typeof req.body?.id!=='string'||!/^[0-9a-f-]{36}$/i.test(req.body.id)||!['contacted','closed','cancelled'].includes(req.body.status))return res.status(400).json({error:'Acción inválida.'});
  await db.runTransaction(async tx=>{const ref=collection.doc(req.body.id),doc=await tx.get(ref);if(!doc.exists)throw Object.assign(new Error('No encontramos esta entrada.'),{status:404});if(['closed','cancelled'].includes(doc.data().status))throw Object.assign(new Error('Esta entrada ya está cerrada.'),{status:409});tx.update(ref,{status:req.body.status,updatedBy:uid,updatedAt:FieldValue.serverTimestamp()});});
  return res.status(200).json({saved:true});
 }catch(err){return res.status(err.status||503).json({error:err.status?err.message:'No pudimos actualizar la lista de espera.'});}
}
