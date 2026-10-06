import Head from 'next/head';
import {useEffect,useRef,useState} from 'react';
import logo from '../../public/logo.jpg';
import favicon from '../../public/favicon-square.png';
import {loadFirebaseClient} from '../../lib/client';
import {argentinaToday,slotsForDate} from '../../lib/reservations.mjs';
import {tableLayout,serviceState,reservationsForView,tableReservations} from '../../lib/guest-center.mjs';
export function getServerSideProps({params}) {
  if(!/^[a-z0-9][a-z0-9-]{0,59}$/.test(params.tenantId))return {notFound:true};
  return {props:{tenantId:params.tenantId,today:argentinaToday()}};
}
const stateLabels={waiting:'Por llegar',arrived:'Llegó',completed:'Finalizada',no_show:'No asistió'};
export default function GuestCenter({tenantId,today}) {
  const [user,setUser]=useState(null),[client,setClient]=useState(null),[authLoading,setAuthLoading]=useState(true),[connecting,setConnecting]=useState(false);
  const [date,setDate]=useState(today),[time,setTime]=useState(''),[sector,setSector]=useState(''),[query,setQuery]=useState(''),[selected,setSelected]=useState('');
  const [data,setData]=useState(null),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[refresh,setRefresh]=useState(0),[cancelId,setCancelId]=useState(null);
  const version=useRef(0),tenantName=tenantId==='pulpo'?'Pulpo Sushi':tenantId;
  useEffect(()=>{
    let stopped=false,unsubscribe;
    loadFirebaseClient().then(mod=>{if(stopped)return;setClient(mod);unsubscribe=mod.onAuthStateChanged(mod.auth,current=>{setUser(current);setAuthLoading(false);});}).catch(()=>{if(!stopped){setAuthLoading(false);setError('No pudimos cargar el acceso. Recargá la página.');}});
    return()=>{stopped=true;unsubscribe?.();};
  },[]);
  useEffect(()=>{
    if(!user){++version.current;setData(null);return;}
    let stopped=false;
    const fetchDay=async()=>{
      const current=++version.current;setLoading(true);
      try{
        const token=await user.getIdToken();const res=await fetch(`/api/tenants/${tenantId}/guestcenter?date=${date}`,{headers:{Authorization:`Bearer ${token}`}});
        const result=await res.json();if(!res.ok)throw new Error(result.error);
        if(!stopped && current===version.current){setData(result);setError('');}
      }catch(err){if(!stopped && current===version.current){setError(err.message);setData(null);}}
      finally{if(!stopped && current===version.current)setLoading(false);}
    };
    fetchDay();const poll=setInterval(fetchDay,30000);
    return()=>{stopped=true;clearInterval(poll);};
  },[user,tenantId,date,refresh]);
  async function login(){setConnecting(true);setError('');try{await client.signInWithPopup(client.auth,client.provider);}catch(err){if(err.code!=='auth/popup-closed-by-user')setError('No pudimos ingresar. Permití la ventana de Google y volvé a intentar.');}finally{setConnecting(false);}}
  async function logout(){try{await client.signOut(client.auth);}catch{setError('No pudimos cerrar la sesión.');}}
  async function update(reservation,next){
    setBusy(true);setError('');setNotice('');
    try{
      const token=await user.getIdToken();const cancellation=next==='cancelled';
      const res=await fetch(`/api/tenants/${tenantId}/${cancellation?'reservations':'guestcenter'}`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({id:reservation.id,...(!cancellation?{serviceState:next}:{})})});
      const result=await res.json();if(!res.ok)throw new Error(result.error);
      setNotice(cancellation?'Reserva cancelada. Lugar liberado.':next==='completed'?'Mesa liberada.':next==='no_show'?'Inasistencia registrada. Lugar liberado.':'Llegada registrada.');setCancelId(null);setRefresh(value=>value+1);
    }catch(err){setError(err.message);}finally{setBusy(false);}
  }
  const settings=data?.availability;
  const tables=settings?.tables || [];
  const sectors=[...new Set(tables.map(table=>table.sector || 'Sin sector'))];
  const times=settings?[...new Set([...slotsForDate(settings,date).map(slot=>slot.time),...data.reservations.filter(r=>r.date===date).map(r=>r.time)])].sort():[];
  const inView=settings?reservationsForView(data.reservations,settings,date,time):[];
  const visibleTables=tables.filter(table=>!sector || (table.sector || 'Sin sector')===sector);
  const view=inView.filter(reservation=>{
    const table=tables.find(table=>table.name===reservation.table);
    return (!sector || (table?.sector || 'Sin sector')===sector) && (!selected || reservation.table===selected) && `${reservation.name} ${reservation.phone}`.toLowerCase().includes(query.toLowerCase());
  });
  const active=inView.filter(r=>r.status!=='cancelled' && !['completed','no_show'].includes(serviceState(r)));
  return <><Head><title>Guest Center · {tenantName} · Hay Lugar</title><meta name="robots" content="noindex,nofollow" /><link rel="icon" href={favicon.src} /></Head>
    <header><img src={logo.src} alt="Hay Lugar" /><div><small>GUEST CENTER</small><strong>{tenantName}</strong></div><a href={`/admin/${tenantId}`}>Admin</a>{user && <button className="secondary" onClick={logout}>Cerrar sesión</button>}</header>
    <main>{authLoading?<p role="status">Verificando acceso…</p>:!user?<section className="login"><h1>Guest Center</h1><p>Ingresá para gestionar el servicio de {tenantName}.</p><button disabled={!client || connecting} onClick={login}>{connecting?'Conectando…':'Ingresar con Google'}</button></section>:<>
      <div className="toolbar"><h1>Servicio del día</h1><label>Fecha<input type="date" value={date} required disabled={busy} onChange={e=>{setDate(e.target.value);setTime('');setSelected('');setData(null);setNotice('');}} /></label><label>Horario<select value={time} disabled={busy || !data} onChange={e=>{setTime(e.target.value);setSelected('');}}><option value="">Todo el día</option>{times.map(t=><option key={t}>{t}</option>)}</select></label><label>Sector<select value={sector} disabled={busy || !data} onChange={e=>{setSector(e.target.value);setSelected('');}}><option value="">Todos</option>{sectors.map(s=><option key={s}>{s}</option>)}</select></label><button className="secondary" onClick={()=>setRefresh(value=>value+1)} disabled={loading || busy}>Actualizar</button></div>
      {data && <><div className="summary"><span><strong>{active.length}</strong> reservas activas</span><span><strong>{active.reduce((total,r)=>total+r.partySize,0)}</strong> personas</span>{!data.configured && <span>Plano inicial · pendiente de guardar en Admin</span>}</div><div className="workspace"><aside><div className="list-head"><h2>Reservas</h2><input type="search" aria-label="Buscar por nombre o teléfono" placeholder="Nombre o teléfono" value={query} onChange={e=>setQuery(e.target.value)} />{selected && <button className="secondary" onClick={()=>setSelected('')}>Mesa {selected} · Ver todas ×</button>}</div><div className="reservation-list">{!view.length && <p className="hint">No hay reservas para esta selección.</p>}{view.map(reservation=>{
        const state=serviceState(reservation),cancelled=reservation.status==='cancelled',terminal=cancelled || ['completed','no_show'].includes(state);
        return <article key={reservation.id} className={selected===reservation.table?'highlight':''}><div className="reservation-head"><strong>{reservation.name}</strong><span>{reservation.time} hs</span></div><p>{reservation.partySize} personas · {reservation.table?`Mesa ${reservation.table}`:'Cupo sin mesa'}</p><p className="hint">{reservation.phone}</p><span className={`badge ${cancelled?'cancelled':state}`}>{cancelled?'Cancelada':stateLabels[state]}</span><div className="actions">{!terminal && state==='waiting' && <><button disabled={busy || loading} onClick={()=>update(reservation,'arrived')}>Llegó</button><button disabled={busy || loading} className="secondary" onClick={()=>update(reservation,'no_show')}>No asistió</button></>}{!terminal && state==='arrived' && <button disabled={busy || loading} onClick={()=>update(reservation,'completed')}>Finalizar y liberar</button>}{!terminal && <>{cancelId===reservation.id?<><p>¿Cancelar y liberar el lugar?</p><button disabled={busy || loading} onClick={()=>update(reservation,'cancelled')}>Confirmar cancelación</button><button disabled={busy} className="secondary" onClick={()=>setCancelId(null)}>Volver</button></>:<button disabled={busy || loading} className="secondary" onClick={()=>setCancelId(reservation.id)}>Cancelar</button>}</>}</div></article>;
      })}</div></aside><section className="floor-section"><div className="floor-head"><h2>Plano de mesas</h2><div className="legend"><span className="free">{time?'Sin reservas en el horario':'Sin reservas'}</span><span className="reserved">Con reservas</span><span className="arrived">Llegaron</span></div></div>{settings.mode==='capacity' && <p className="hint">Modalidad por cupos: {settings.capacity} personas. Las reservas sin mesa se muestran en la lista.</p>}{!tables.length?<p className="hint">Configurá las mesas y su posición desde el Admin.</p>:<div className="floor-scroll"><div className="floor" style={{height:tenantId==='pulpo' && tables.length<=12?620:Math.max(620,Math.ceil(tables.length/5)*130)}}>{visibleTables.map(table=>{
        const i=tables.indexOf(table),layout=tableLayout(tenantId,table,i,tables.length),reservations=tableReservations(inView,table.name),occupied=reservations.some(r=>serviceState(r)==='arrived'),state=occupied?'arrived':reservations.length?'reserved':'free';
        return <div className="table" key={table.name} style={{left:`${layout.x}%`,top:`${layout.y}%`}}><button disabled={busy} aria-pressed={selected===table.name} aria-label={`Mesa ${table.name}, ${table.seats} lugares, ${occupied?'llegaron':reservations.length?'con reservas':'sin reservas'}`} className={`table-button ${layout.shape} ${state} ${selected===table.name?'selected':''}`} onClick={()=>setSelected(selected===table.name?'':table.name)}><strong>{table.name}</strong>{reservations.length>0 && <small>{reservations.length} {reservations.length===1?'reserva':'reservas'}</small>}</button><span className="capacity">{table.seats} lugares</span></div>;
      })}</div></div>}</section></div></>}
      {loading && <p role="status">Actualizando el turno…</p>}
    </>}{error && <p className="error" role="alert">{error}</p>}{notice && <p className="success" role="status">{notice}</p>}</main>
    <style jsx global>{`
      :root{color-scheme:light;font-family:system-ui,sans-serif;color:#281f18;background:#faf6eb}*{box-sizing:border-box}body{margin:0}button,input,select{font:inherit}button{cursor:pointer;min-height:44px;border:1px solid #281f18;background:#281f18;color:white;border-radius:9px;padding:10px 14px;font-weight:600}button:disabled{opacity:.5;cursor:default}.secondary{background:transparent;color:#281f18;border-color:#dfd3c3}input,select{min-height:44px;border:1px solid #dfd3c3;border-radius:9px;padding:8px 12px;background:white;color:#281f18;max-width:100%}header{display:flex;align-items:center;gap:16px;background:#faf6eb;padding:10px 24px;border-bottom:1px solid #e8dece}header img{width:90px;height:60px;object-fit:contain}header small,header strong{display:block}header small{font-size:10px;letter-spacing:1px;color:#796b60;margin-bottom:5px}header a{margin-left:auto;color:#281f18}main{padding:24px;max-width:1500px;margin:auto}h1{font-size:25px;margin:0}h2{font-size:18px;margin:0 0 12px}.toolbar{display:flex;align-items:end;flex-wrap:wrap;gap:16px}.toolbar h1{margin-right:auto;align-self:center}.toolbar label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600}.summary{display:flex;gap:24px;flex-wrap:wrap;font-size:14px;margin:22px 0}.workspace{display:grid;grid-template-columns:330px minmax(0,1fr);border:1px solid #e8dece;border-radius:16px;background:#fffdf8;overflow:hidden}aside{border-right:1px solid #e8dece}.list-head{padding:20px;background:#fffdf8;border-bottom:1px solid #e8dece}.list-head input{width:100%;margin-bottom:10px}.reservation-list{max-height:700px;overflow:auto;padding:0 20px}.reservation-list article{padding:20px 0;border-bottom:1px solid #e8dece}.reservation-list p{line-height:1.5;font-size:14px;margin:8px 0}.reservation-head{display:flex;gap:10px;justify-content:space-between}.reservation-head span{white-space:nowrap;font-size:13px}.hint{color:#796b60;line-height:1.6}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.actions button{font-size:12px;padding:8px 10px}.badge{display:inline-block;padding:4px 8px;border-radius:6px;font-size:12px;background:#f2ece0}.badge.arrived{background:#ffdbdc}.badge.completed{background:#e3f1e8}.floor-section{padding:20px;min-width:0}.floor-head{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}.legend{display:flex;gap:12px;flex-wrap:wrap;font-size:12px}.legend span:before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;background:#41755c}.legend .reserved:before{background:#bd862d}.legend .arrived:before{background:#dd6e78}.floor-scroll{overflow:auto}.floor{position:relative;min-width:700px;width:100%;margin:12px 0 35px;background:radial-gradient(#e8dece 1px,transparent 1px);background-size:24px 24px}.table{position:absolute;transform:translate(-50%,-50%);width:90px;text-align:center}.table-button{width:82px;height:82px;padding:8px;border:2px solid #abc2b5;background:#edf4ef;color:#281f18;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:5px;min-height:0}.table-button strong{font-size:20px}.table-button small{font-size:10px;font-weight:400}.table-button.round{border-radius:50%}.table-button.square{border-radius:9px}.table-button.reserved{border-color:#cba353;background:#fff1d9}.table-button.arrived{border-color:#dd6e78;background:#ffe0e2}.table-button.selected{outline:3px solid #281f18;outline-offset:4px}.capacity{display:block;font-size:12px;margin-top:8px;color:#796b60}.error{color:#94392f}.success{color:#32623b}.login{max-width:500px;padding:28px;border:1px solid #e8dece;border-radius:16px;margin:60px auto}.login p{line-height:1.6}:focus-visible{outline:3px solid #f2737a;outline-offset:3px}@media(max-width:950px){.workspace{grid-template-columns:1fr}aside{border-right:0;border-bottom:1px solid #e8dece}.reservation-list{max-height:420px}.toolbar h1{width:100%;margin-bottom:10px}main{padding:16px}header{padding:10px 16px;gap:10px}header button{font-size:12px}.floor-section{padding:16px}}
    `}</style>
  </>;
}
