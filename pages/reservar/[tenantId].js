import { useEffect, useRef, useState } from 'react';
import ReservationLayout from '../../components/ReservationLayout';
import { argentinaToday } from '../../lib/reservations.mjs';
export function getServerSideProps({ params }) {
  if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(params.tenantId)) return { notFound: true };
  return { props: { tenantId: params.tenantId, today: argentinaToday() } };
}
export default function Reserve({ tenantId, today }) {
  const [date,setDate] = useState(today), [partySize,setPartySize] = useState(2), [time,setTime] = useState(''), [table,setTable] = useState('');
  const [name,setName] = useState(''), [email,setEmail] = useState(''), [phone,setPhone] = useState('');
  const [slots,setSlots] = useState([]), [mode,setMode] = useState('capacity'), [loading,setLoading] = useState(true), [busy,setBusy] = useState(false);
  const [error,setError] = useState(''), [confirmed,setConfirmed] = useState(null), [refresh,setRefresh] = useState(0), [configured,setConfigured] = useState(true);
  const requestRef = useRef(null);
  const tenantName = tenantId === 'pulpo' ? 'Pulpo Sushi' : tenantId;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);setTime('');setTable('');setSlots([]);setError('');
    fetch(`/api/tenants/${tenantId}/reservations?date=${encodeURIComponent(date)}&partySize=${partySize}`,{signal:controller.signal}).then(async res=>{
      const data = await res.json();if(!res.ok)throw new Error(data.error);
      setSlots(data.slots);setMode(data.mode || 'capacity');setConfigured(data.configured);
    }).catch(err=>{if(err.name !== 'AbortError')setError(err.message || 'No pudimos consultar los horarios.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[tenantId,date,partySize,refresh]);
  const selected = slots.find(slot=>slot.time===time);
  async function book(event) {
    event.preventDefault();setError('');
    if(!time || (mode==='tables' && !table)){setError('Elegí un horario y, si corresponde, una mesa.');return;}
    setBusy(true);
    const details={date,time,partySize,table:mode==='tables'?table:null,name,email,phone};
    const fingerprint=JSON.stringify(details);
    if(requestRef.current?.fingerprint!==fingerprint)requestRef.current={fingerprint,id:crypto.randomUUID()};
    try {
      const res=await fetch(`/api/tenants/${tenantId}/reservations`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...details,requestId:requestRef.current.id})});
      const data=await res.json();if(!res.ok)throw Object.assign(new Error(data.error),{conflict:res.status===409});
      setConfirmed(data.reservation);
    }catch(err){setError(err.message || 'No pudimos confirmar. Volvé a intentar.');if(err.conflict){setTime('');setTable('');}}
    finally{setBusy(false);}
  }
  return <ReservationLayout title={confirmed?'Reserva confirmada':'Reservá tu lugar'} tenantName={tenantName}>
    {confirmed?<section className="box"><h2 className="success">¡Listo! Tu lugar está reservado.</h2><p><strong>{confirmed.date.split('-').reverse().join('/')}</strong> a las <strong>{confirmed.time} hs</strong><br />{confirmed.partySize} {confirmed.partySize===1?'persona':'personas'}{confirmed.table && <><br />{confirmed.table}</>}</p><p className="hint">Código de reserva: {confirmed.id.slice(0,8).toUpperCase()}. Guardá esta pantalla como comprobante.</p><button className="secondary" onClick={()=>{setConfirmed(null);setRefresh(value=>value+1);requestRef.current=null;}}>Hacer otra reserva</button></section>:<form onSubmit={book}><fieldset disabled={busy}><section className="box"><h2>Elegí cuándo venir</h2><div className="row"><label className="field">Fecha<input type="date" min={today} required value={date} onChange={e=>setDate(e.target.value)} /></label><label className="field">Personas<input type="number" min="1" max="100" required value={partySize} onChange={e=>setPartySize(Number(e.target.value))} /></label></div>
      {loading?<p role="status">Consultando disponibilidad…</p>:slots.some(slot=>slot.available)?<><p>Horarios disponibles</p><div className="times">{slots.map(slot=><button type="button" disabled={!slot.available} aria-pressed={slot.time===time} className={slot.time===time?'selected':''} key={slot.time} onClick={()=>{setTime(slot.time);setTable('');}}>{slot.time}</button>)}</div>{mode==='tables' && selected && <label className="field">Mesa<select required value={table} onChange={e=>setTable(e.target.value)}><option value="">Elegí una mesa</option>{selected.tables.map(t=><option key={t.name} value={t.name}>{t.name}{t.sector?` · ${t.sector}`:''} · {t.seats} lugares</option>)}</select></label>}</>:!error && <p>{configured?'No hay lugares disponibles para esta fecha y cantidad de personas. Probá otra fecha.':'El negocio todavía no habilitó sus horarios de reserva.'}</p>}
      {!loading && <button type="button" className="secondary" onClick={()=>setRefresh(value=>value+1)}>Actualizar horarios</button>}
    </section><section className="box"><h2>Tus datos</h2><label className="field">Nombre<input autoComplete="name" maxLength="100" required value={name} onChange={e=>setName(e.target.value)} /></label><label className="field">Teléfono<input type="tel" autoComplete="tel" maxLength="40" required value={phone} onChange={e=>setPhone(e.target.value)} /></label><label className="field">Correo electrónico<input type="email" autoComplete="email" maxLength="160" required value={email} onChange={e=>setEmail(e.target.value)} /></label><p className="hint">El negocio usará estos datos para gestionar tu reserva.</p><button type="submit" disabled={loading || !time || (mode==='tables' && !table)}>{busy?'Confirmando…':'Confirmar reserva'}</button></section></fieldset>{error && <p className="error" role="alert">{error}</p>}</form>}
  </ReservationLayout>;
}
