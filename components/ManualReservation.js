import { useEffect, useRef, useState } from 'react';
export default function ManualReservation({ tenantId, user, date, tables, onSaved }) {
  const [open,setOpen] = useState(false), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const [form,setForm] = useState({name:'',email:'',phone:'',partySize:2,time:'20:00',table:'',walkIn:false,duration:90});
  const request = useRef(null);
  useEffect(()=>{request.current=null;setError('');},[tenantId,date]);
  const change = patch => { setForm({...form,...patch}); request.current=null; };
  async function submit(event) {
    event.preventDefault();setBusy(true);setError('');
    try {
      const token=await user.getIdToken();
      const now = new Date(Date.now()-3*3600000).toISOString();
      request.current ||= {...form,date:form.walkIn?now.slice(0,10):date,time:form.walkIn?now.slice(11,16):form.time,manual:true,requestId:crypto.randomUUID()};
      const input=request.current;
      const res=await fetch(`/api/tenants/${tenantId}/reservations`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(input)});
      const result=await res.json();if(!res.ok)throw new Error(result.error);
      setOpen(false);request.current=null;setForm({...form,name:'',email:'',phone:''});onSaved();
    }catch(err){setError(err.message);}finally{setBusy(false);}
  }
  return <div className="manual"><button disabled={busy} onClick={()=>{setOpen(!open);setError('');}}>Nueva reserva / llegada</button>{open && <form onSubmit={submit} className="manual-form"><h2>Nueva reserva</h2><fieldset disabled={busy}><label><input type="checkbox" checked={form.walkIn} onChange={e=>change({walkIn:e.target.checked})} />Llegada sin reserva · ahora</label><div className="manual-grid"><label>Nombre<input required minLength="2" maxLength="100" value={form.name} onChange={e=>change({name:e.target.value})} /></label><label>Teléfono<input type="tel" required maxLength="40" value={form.phone} onChange={e=>change({phone:e.target.value})} /></label><label>Correo<input type="email" required maxLength="160" value={form.email} onChange={e=>change({email:e.target.value})} /></label><label>Personas<input type="number" required min="1" max="100" value={form.partySize} onChange={e=>change({partySize:Number(e.target.value)})} /></label>{!form.walkIn && <label>Horario · {date}<input type="time" required value={form.time} onChange={e=>change({time:e.target.value})} /></label>}{form.walkIn && <label>Permanencia (min)<input type="number" required min="15" max="720" value={form.duration} onChange={e=>change({duration:Number(e.target.value)})} /></label>}{tables.length>0 && <label>Mesa<select value={form.table} onChange={e=>change({table:e.target.value})}><option value="">Asignación automática</option>{tables.filter(t=>t.enabled!==false && t.seats>=form.partySize).map(t=><option key={t.name} value={t.name}>{t.name} · {t.seats} lugares</option>)}</select></label>}</div><p className="hint">La disponibilidad se vuelve a comprobar al guardar.</p><button type="submit">{busy?'Guardando…':'Guardar reserva'}</button> <button type="button" className="secondary" onClick={()=>setOpen(false)}>Volver</button></fieldset>{error && <p className="error" role="alert">{error}</p>}</form>}<style jsx>{`.manual{margin:20px 0}.manual-form{border:1px solid #dfd3c3;border-radius:16px;padding:24px;background:#fffdf8;margin-top:16px}.manual-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin:20px 0}.manual-grid label{display:flex;flex-direction:column;gap:8px}.manual-grid input,.manual-grid select{width:100%}fieldset{border:0;padding:0}input[type=checkbox]{min-height:0;width:18px;height:18px}`}</style></div>;
}
