import Head from 'next/head';
import { useEffect, useState } from 'react';
import ReservationLayout from '../../../components/ReservationLayout';
import { loadFirebaseClient } from '../../../lib/client';
import { argentinaToday } from '../../../lib/reservations.mjs';
export function getServerSideProps({ params }) {
  if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(params.tenantId)) return { notFound: true };
  return { props: { tenantId: params.tenantId, today: argentinaToday() } };
}
export default function Reservations({tenantId,today}) {
  const [user,setUser]=useState(null),[date,setDate]=useState(today),[reservations,setReservations]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0),[cancelId,setCancelId]=useState(null);
  const tenantName=tenantId==='pulpo'?'Pulpo Sushi':tenantId;
  useEffect(()=>{
    let stopped=false,unsubscribe;
    loadFirebaseClient().then(mod=>{if(!stopped)unsubscribe=mod.onAuthStateChanged(mod.auth,current=>{setUser(current);setLoading(Boolean(current));});}).catch(()=>{setError('No pudimos verificar el acceso.');setLoading(false);});
    return()=>{stopped=true;unsubscribe?.();};
  },[]);
  useEffect(()=>{
    if(!user)return;
    let stopped=false;
    setLoading(true);setError('');setReservations([]);setCancelId(null);
    user.getIdToken().then(token=>fetch(`/api/tenants/${tenantId}/reservations?admin=true&date=${encodeURIComponent(date)}`,{headers:{Authorization:`Bearer ${token}`}})).then(async res=>{const data=await res.json();if(!res.ok)throw new Error(data.error);if(!stopped)setReservations(data.reservations);}).catch(err=>{if(!stopped)setError(err.message);}).finally(()=>{if(!stopped)setLoading(false);});
    return()=>{stopped=true;};
  },[user,date,tenantId,refresh]);
  async function cancel(id){
    setBusy(true);setError('');
    try{const token=await user.getIdToken();const res=await fetch(`/api/tenants/${tenantId}/reservations`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({id})});const data=await res.json();if(!res.ok)throw new Error(data.error);setRefresh(value=>value+1);setCancelId(null);}
    catch(err){setError(err.message);}finally{setBusy(false);}
  }
  return <ReservationLayout title="Reservas" tenantName={tenantName}><Head><meta name="robots" content="noindex,nofollow" /></Head><nav className="links"><a href={`/admin/${tenantId}/clientes`}>Clientes</a><a href={`/admin/${tenantId}`}>Disponibilidad</a><a href={`/reservar/${tenantId}`} target="_blank" rel="noopener noreferrer">Link público de reserva ↗</a></nav>{user?<><label className="field">Fecha<input type="date" required value={date} onChange={e=>setDate(e.target.value)} disabled={busy} /></label><button className="secondary" onClick={()=>setRefresh(value=>value+1)} disabled={busy || loading}>Actualizar</button>{loading?<p role="status">Cargando reservas…</p>:!error && !reservations.length?<section className="box"><p>No hay reservas para esta fecha.</p></section>:reservations.map(reservation=><article className="box" key={reservation.id}><h2>{reservation.time} hs · {reservation.name}</h2><p>{reservation.partySize} personas{reservation.table?` · ${reservation.table}`:''}<br />{reservation.phone}<br />{reservation.email}</p><p className="hint">Código: {reservation.id.slice(0,8).toUpperCase()} · {reservation.status==='cancelled'?'Cancelada':'Confirmada'}</p>{reservation.status!=='cancelled' && (cancelId===reservation.id?<><p>¿Cancelar esta reserva y liberar el lugar?</p><div className="row"><button disabled={busy} onClick={()=>cancel(reservation.id)}>Confirmar cancelación</button><button disabled={busy} className="secondary" onClick={()=>setCancelId(null)}>Volver</button></div></>:<button disabled={busy} className="secondary" onClick={()=>setCancelId(reservation.id)}>Cancelar reserva</button>)}</article>)}</>:loading?<p role="status">Verificando sesión…</p>:<section className="box"><p>Ingresá para ver las reservas.</p><a href={`/admin/${tenantId}`}>Ingresar con Google</a></section>}{error && <p className="error" role="alert">{error}</p>}</ReservationLayout>;
}
