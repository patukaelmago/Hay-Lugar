import { authorize } from '../../../../lib/server';
import { argentinaToday } from '../../../../lib/reservations.mjs';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Método no permitido.'});}
  try{
    const {db}=await authorize(req,req.query.tenantId);
    const today=argentinaToday(),start=new Date(`${today}T12:00:00Z`);start.setUTCDate(start.getUTCDate()-29);
    const from=start.toISOString().slice(0,10);
    const snapshot=await db.collection(`tenants/${req.query.tenantId}/reservations`).where('date','>=',from).where('date','<=',today).get();
    const reservations=snapshot.docs.map(doc=>doc.data());
    const active=reservations.filter(r=>r.status!=='cancelled');
    return res.status(200).json({from,to:today,total:reservations.length,people:active.reduce((sum,r)=>sum+r.partySize,0),cancelled:reservations.filter(r=>r.status==='cancelled').length,arrived:active.filter(r=>['arrived','completed'].includes(r.serviceState)).length,noShow:active.filter(r=>r.serviceState==='no_show').length,today:active.filter(r=>r.date===today).length,sources:['link','manual','walkin'].map(source=>({source,total:reservations.filter(r=>(r.source||'link')===source).length}))});
  }catch(err){return res.status(err.status||503).json({error:err.status?err.message:'No pudimos cargar el resumen.'});}
}
