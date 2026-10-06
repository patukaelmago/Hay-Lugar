import Head from 'next/head';
import { useEffect, useRef, useState } from 'react';
import ReservationLayout from '../../../components/ReservationLayout';
import { loadFirebaseClient } from '../../../lib/client';
export function getServerSideProps({params}) {
  if(!/^[a-z0-9][a-z0-9-]{0,59}$/.test(params.tenantId))return {notFound:true};
  return {props:{tenantId:params.tenantId}};
}
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export default function Clients({tenantId}) {
  const [user,setUser]=useState(null),[authLoading,setAuthLoading]=useState(true),[loading,setLoading]=useState(false),[clients,setClients]=useState([]),[next,setNext]=useState(null),[query,setQuery]=useState('');
  const [selected,setSelected]=useState(null),[history,setHistory]=useState([]),[notes,setNotes]=useState(''),[detailLoading,setDetailLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const requestVersion=useRef(0);
  const tenantName=tenantId==='pulpo'?'Pulpo Sushi':tenantId;
  const dirty=Boolean(selected && notes!==selected.notes);
  async function api(params='',body) {
    const token=await user.getIdToken();
    const res=await fetch(`/api/tenants/${tenantId}/clients${params}`,{method:body?'PUT':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    const data=await res.json();if(!res.ok)throw new Error(data.error || 'No pudimos completar la operación.');return data;
  }
  useEffect(()=>{
    let stopped=false,unsubscribe;
    loadFirebaseClient().then(mod=>{if(!stopped)unsubscribe=mod.onAuthStateChanged(mod.auth,current=>{setUser(current);setAuthLoading(false);});}).catch(()=>{if(!stopped){setAuthLoading(false);setError('No pudimos verificar tu sesión.');}});
    return()=>{stopped=true;unsubscribe?.();};
  },[]);
  useEffect(()=>{
    if(!user){setClients([]);setSelected(null);return;}
    let stopped=false;setLoading(true);setError('');
    api().then(data=>{if(!stopped){setClients(data.clients);setNext(data.next);}}).catch(err=>{if(!stopped)setError(err.message);}).finally(()=>{if(!stopped)setLoading(false);});
    return()=>{stopped=true;};
  },[user,tenantId]);
  useEffect(()=>{
    const warn=event=>{if(dirty){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[dirty]);
  async function more(){
    setLoading(true);setError('');
    try{const data=await api(`?after=${next}`);setClients(list=>[...list,...data.clients.filter(client=>!list.some(existing=>existing.id===client.id))]);setNext(data.next);}catch(err){setError(err.message);}finally{setLoading(false);}
  }
  async function open(id){
    if(dirty && !window.confirm('Tenés notas sin guardar. ¿Descartar esos cambios?'))return;
    const version=++requestVersion.current;setDetailLoading(true);setError('');setNotice('');
    try{const data=await api(`?id=${id}`);if(version===requestVersion.current){setSelected(data.client);setNotes(data.client.notes);setHistory(data.reservations);}}
    catch(err){if(version===requestVersion.current)setError(err.message);}finally{if(version===requestVersion.current)setDetailLoading(false);}
  }
  async function save(event){
    event.preventDefault();setSaving(true);setError('');setNotice('');
    try{const data=await api('',{id:selected.id,notes,revision:selected.revision});setSelected(data.client);setNotes(data.client.notes);setClients(list=>list.map(client=>client.id===data.client.id?data.client:client));setNotice('Notas guardadas.');}catch(err){setError(err.message);}finally{setSaving(false);}
  }
  function close(){
    if(dirty && !window.confirm('Tenés notas sin guardar. ¿Descartar esos cambios?'))return;
    ++requestVersion.current;setSelected(null);setDetailLoading(false);setError('');setNotice('');
  }
  const filtered=clients.filter(client=>normalize(`${client.name} ${client.email} ${client.phone}`).includes(normalize(query))).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  return <ReservationLayout title="Clientes" tenantName={tenantName}><Head><meta name="robots" content="noindex,nofollow" /></Head><nav className="links"><a href={`/guestcenter/${tenantId}`}>Guest Center</a><a href={`/admin/${tenantId}`}>Disponibilidad</a><a href={`/reservar/${tenantId}`} target="_blank" rel="noopener noreferrer">Link público ↗</a></nav>
    {authLoading?<p role="status">Verificando sesión…</p>:!user?<section className="box"><p>Ingresá para ver los clientes.</p><a href={`/admin/${tenantId}`}>Ingresar con Google</a></section>:<>
      {selected?<><button className="secondary" disabled={saving} onClick={close}>← Volver a clientes</button><section className="box" aria-busy={detailLoading}><h2>{selected.name}</h2><p>{selected.email}<br />{selected.phone}</p><div className="row"><p><strong>{selected.totalReservations}</strong> reservas</p><p><strong>{selected.confirmedReservations}</strong> confirmadas</p><p><strong>{selected.cancelledReservations}</strong> canceladas</p></div><form onSubmit={save}><label className="field">Notas internas<textarea rows="5" maxLength="3000" placeholder="Preferencias u otra información útil para la atención." value={notes} onChange={event=>{setNotes(event.target.value);setNotice('');}} disabled={saving || detailLoading} /></label><p className="hint">Estas notas solo las puede ver el equipo del negocio.</p><button disabled={!dirty || saving || detailLoading}>{saving?'Guardando…':'Guardar notas'}</button></form>{notice && <p className="success" role="status">{notice}</p>}</section><section className="box"><h2>Historial de reservas</h2>{history.length?history.map(reservation=><div className="history" key={reservation.id}><strong>{reservation.date.split('-').reverse().join('/')} · {reservation.time} hs</strong><p>{reservation.partySize} personas{reservation.table?` · ${reservation.table}`:''}<br /><span className="hint">{reservation.status==='cancelled'?'Cancelada':({arrived:'Llegó',completed:'Finalizada',no_show:'No asistió'}[reservation.serviceState] || 'Confirmada')}</span></p></div>):<p>Todavía no hay reservas.</p>}</section></>:<><p className="hint">Cada reserva confirmada crea la ficha del cliente. Las reservas con el mismo correo se agrupan en un único historial.</p><label className="field">Buscar en esta lista<input type="search" placeholder="Nombre, correo o teléfono" value={query} onChange={event=>setQuery(event.target.value)} /></label>{filtered.map(client=><article className="box" key={client.id}><h2>{client.name}</h2><p>{client.email}<br />{client.phone}</p><p className="hint">{client.totalReservations} reservas</p><button className="secondary" disabled={detailLoading} onClick={()=>open(client.id)}>Ver ficha e historial</button></article>)}{!filtered.length && !loading && !error && <section className="box"><p>{query?'No hay coincidencias en esta lista.':'Todavía no hay clientes. Se crearán con las primeras reservas.'}</p></section>}{next && <button className="secondary" disabled={loading} onClick={more}>Cargar más clientes</button>}</>}
      {(loading || detailLoading) && <p role="status">Cargando…</p>}
    </>}{error && <p className="error" role="alert">{error}</p>}
    <style jsx>{`textarea{font:inherit;width:100%;border:1px solid #dfd3c3;border-radius:10px;padding:12px;background:white;color:#281f18;resize:vertical}.history{border-bottom:1px solid #e8dece;padding:16px 0}.history:last-child{border-bottom:0}.history p{margin-bottom:0}`}</style>
  </ReservationLayout>;
}
