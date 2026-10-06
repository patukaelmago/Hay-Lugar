import { useEffect, useState } from 'react';
import ReservationLayout from './ReservationLayout';
import { loadFirebaseClient } from '../lib/client';
export default function PrivatePanel({ tenantId, title, children }) {
  const [user,setUser]=useState(null),[client,setClient]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{let stop=false,off;loadFirebaseClient().then(mod=>{if(stop)return;setClient(mod);off=mod.onAuthStateChanged(mod.auth,current=>{setUser(current);setLoading(false);});}).catch(()=>{setLoading(false);setError('No pudimos cargar el acceso.');});return()=>{stop=true;off?.();};},[]);
  async function login(){try{await client.signInWithPopup(client.auth,client.provider);}catch{setError('No pudimos iniciar sesión. Volvé a intentar.');}}
  return <ReservationLayout title={title} tenantName={tenantId==='pulpo'?'Pulpo Sushi':tenantId || 'Administración'}>{tenantId && <nav className="links"><a href={`/admin/${tenantId}/inicio`}>Inicio</a><a href={`/admin/${tenantId}`}>Configuración</a><a href={`/admin/${tenantId}/negocio`}>Datos del negocio</a><a href={`/admin/${tenantId}/clientes`}>Clientes</a><a href={`/dashboard/${tenantId}`}>Dashboard</a><a href={`/reservar/${tenantId}`} target="_blank" rel="noopener noreferrer">Link público ↗</a><a href="/negocios">Mis negocios</a></nav>}{loading?<p role="status">Verificando acceso…</p>:user?children(user):<button disabled={!client} onClick={login}>Ingresar con Google</button>}{error && <p role="alert" className="error">{error}</p>}</ReservationLayout>;
}
