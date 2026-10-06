import { FieldValue } from 'firebase-admin/firestore';
import { authorize } from '../../../../lib/server';
import { initialAvailability } from '../../../../lib/initial-availability.mjs';
import { validateAvailability } from '../../../../lib/availability.mjs';
import { nearbyDates, validDate, remaining, slotsForDate } from '../../../../lib/reservations.mjs';
import { transitionService } from '../../../../lib/guest-center.mjs';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (!['GET','PATCH'].includes(req.method)) { res.setHeader('Allow','GET, PATCH');return res.status(405).json({error:'Método no permitido.'}); }
  try {
    const {db,uid}=await authorize(req,req.query.tenantId), root=`tenants/${req.query.tenantId}`;
    if(req.method==='GET'){
      const date=req.query.date;
      if(!validDate(date))return res.status(400).json({error:'Elegí una fecha válida.'});
      const [snapshot,...days]=await Promise.all([db.doc(`${root}/settings/availability`).get(),...nearbyDates(date).map(day=>db.collection(`${root}/reservations`).where('date','==',day).get())]);
      return res.status(200).json({configured:snapshot.exists,availability:snapshot.exists?validateAvailability(snapshot.data()):initialAvailability(req.query.tenantId),reservations:days.flatMap(day=>day.docs.map(doc=>{
        const data=doc.data();return {id:doc.id,name:data.name,email:data.email,phone:data.phone,date:data.date,time:data.time,start:data.start,end:data.end,partySize:data.partySize,table:data.table,status:data.status,source:data.source || 'link', serviceState:data.serviceState || 'waiting'};
      })).sort((a,b)=>a.start-b.start)});
    }
    if(typeof req.body?.id!=='string' || !/^[0-9a-f-]{36}$/i.test(req.body.id))return res.status(400).json({error:'Reserva inválida.'});
    const ref=db.doc(`${root}/reservations/${req.body.id}`);
    await db.runTransaction(async tx=>{
      const doc=await tx.get(ref);
      if(!doc.exists)throw Object.assign(new Error('No encontramos la reserva.'),{status:404});
      const data=doc.data();
      if (req.body.table !== undefined) {
        if (typeof req.body.table !== 'string' || req.body.table.length > 60 || data.status === 'cancelled' || ['completed','no_show'].includes(data.serviceState)) throw Object.assign(new Error('Esta reserva no se puede reubicar.'),{status:409});
        const settingsDoc = await tx.get(db.doc(`${root}/settings/availability`));
        if (!settingsDoc.exists) throw Object.assign(new Error('Guardá la configuración del local.'),{status:409});
        const settings = validateAvailability(settingsDoc.data());
        const refs = nearbyDates(data.date).map(date => db.doc(`${root}/occupancy/${date}`));
        const occupancy = await tx.getAll(...refs);
        const entries = occupancy.flatMap(day => day.data()?.entries || []).filter(entry => entry.id !== doc.id);
        const slot = { start: data.start, end: data.end, layoutId: data.layoutId || null };
        if (settings.mode !== 'tables' || !remaining(settings,slot,entries,data.partySize).tables.some(table => table.name === req.body.table)) throw Object.assign(new Error('La mesa no tiene capacidad o está ocupada durante la reserva.'),{status:409});
        tx.set(refs[1],{entries:(occupancy[1].data()?.entries || []).map(entry => entry.id === doc.id ? {...entry,table:req.body.table} : entry)});
        tx.update(ref,{table:req.body.table,serviceUpdatedBy:uid,serviceUpdatedAt:FieldValue.serverTimestamp()});
        return;
      }
      let action;
      try{action=transitionService(data,req.body.serviceState);}catch(err){throw Object.assign(err,{status:409});}
      if(!action.changed)return;
      let occupancyRef,occupancy;
      if(action.release){occupancyRef=db.doc(`${root}/occupancy/${data.date}`);occupancy=await tx.get(occupancyRef);}
      if(action.release)tx.set(occupancyRef,{entries:(occupancy.data()?.entries || []).filter(entry=>entry.id!==doc.id)});
      const patch={serviceState:req.body.serviceState,serviceUpdatedBy:uid,serviceUpdatedAt:FieldValue.serverTimestamp()};
      if(action.release)patch.end=Math.min(data.end,Date.now());
      tx.update(ref,patch);
    });
    return res.status(200).json({updated:true});
  }catch(err){
    if(!err.status)console.error('Guest Center backend:',err.code || err.message);
    return res.status(err.status || 503).json({error:err.status?err.message:'No pudimos cargar el turno. Volvé a intentar.'});
  }
}
