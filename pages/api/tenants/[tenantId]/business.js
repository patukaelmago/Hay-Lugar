import {authorize,services} from '../../../../lib/server';
import {FieldValue} from 'firebase-admin/firestore';
const profile=(data,id)=>({name:data?.name || (id==='pulpo'?'Pulpo Sushi':id),address:data?.address || '',phone:data?.phone || ''});
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','PUT'].includes(req.method)){res.setHeader('Allow','GET, PUT');return res.status(405).json({error:'Método no permitido.'});}
 try{
  const id=req.query.tenantId;
  if(typeof id!=='string'||!/^[a-z0-9][a-z0-9-]{0,59}$/.test(id))return res.status(400).json({error:'Negocio inválido.'});
  const {db}=req.method==='PUT'?await authorize(req,id):services(),ref=db.doc(`tenants/${id}`);
  if(req.method==='GET'){const doc=await ref.get();return res.status(200).json(profile(doc.data(),id));}
  const {name,address,phone}=req.body || {};
  if(typeof name!=='string'||!name.trim()||name.length>100||typeof address!=='string'||address.length>300||typeof phone!=='string'||phone.length>40)return res.status(400).json({error:'Revisá los datos del negocio.'});
  await ref.set({name:name.trim(),address:address.trim(),phone:phone.trim(),updatedAt:FieldValue.serverTimestamp()},{merge:true});
  return res.status(200).json({saved:true});
 }catch(err){return res.status(err.status||503).json({error:err.status?err.message:'No pudimos consultar el negocio.'});}
}
