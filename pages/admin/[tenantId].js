import Head from 'next/head';
import logo from '../../public/logo.jpg';
import favicon from '../../public/favicon-square.png';
import { loadFirebaseClient } from '../../lib/client';
import { useEffect, useRef, useState } from 'react';
import { emptyAvailability, validateAvailability } from '../../lib/availability.mjs';

const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export function getServerSideProps({ params }) {
  if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(params.tenantId)) return { notFound: true };
  return { props: { tenantId: params.tenantId } };
}
export default function Admin({ tenantId }) {
  const [user, setUser] = useState(null);
  const [availability, setAvailability] = useState(emptyAvailability);
  const [revision, setRevision] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [clientReady, setClientReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [closedDate, setClosedDate] = useState('');
  const client = useRef(null);
  const tenantName = tenantId === 'pulpo' ? 'Pulpo Sushi' : tenantId;
  async function request(currentUser, method = 'GET', body) {
    const token = await currentUser.getIdToken();
    const res = await fetch(`/api/tenants/${tenantId}/availability`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No pudimos completar la operación.');
    return data;
  }
  async function load(currentUser) {
    setLoading(true); setError('');
    try {
      const data = await request(currentUser);
      setAvailability(data.availability); setRevision(data.revision); setAuthorized(true); setDirty(false);
    } catch (err) { setError(err.message); setAuthorized(false); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let stopped = false; let unsubscribe;
    setAuthorized(false); setLoading(true);
    loadFirebaseClient().then(mod => {
      if (stopped) return;
      client.current = mod; setClientReady(true);
      unsubscribe = mod.onAuthStateChanged(mod.auth, currentUser => {
        if (stopped) return;
        setUser(currentUser);
        if (currentUser) load(currentUser);
        else { setAuthorized(false); setLoading(false); }
      });
    }).catch(() => { if (!stopped) { setError('No pudimos cargar el acceso. Recargá la página.'); setLoading(false); } });
    return () => { stopped = true; unsubscribe?.(); };
  }, [tenantId]);
  useEffect(() => {
    const warn = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function change(patch) { setAvailability(value => ({ ...value, ...patch })); setDirty(true); setNotice(''); setError(''); }
  function updateRow(key, index, patch) { change({ [key]: availability[key].map((row, i) => i === index ? { ...row, ...patch } : row) }); }
  async function save(event) {
    event.preventDefault(); setError(''); setNotice(''); setSaving(true);
    try {
      const normalized = validateAvailability(availability);
      await request(user, 'PUT', { availability: normalized, revision });
      setDirty(false);
      setNotice('Configuración guardada.');
      // Fetch the server revision before allowing another edit.
      const data = await request(user);
      setAvailability(data.availability); setRevision(data.revision);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }
  async function login() {
    setConnecting(true); setError('');
    try { await client.current.signInWithPopup(client.current.auth, client.current.provider); }
    catch (err) {
      if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(err.code)) {
        const messages = {
          'auth/popup-blocked': 'Permití la ventana de Google en tu navegador y volvé a intentar.',
          'auth/unauthorized-domain': 'Esta dirección todavía no está autorizada para ingresar con Google.',
          'auth/network-request-failed': 'Revisá tu conexión y volvé a intentar.'
        };
        setError(messages[err.code] || 'No pudimos iniciar sesión. Volvé a intentar.');
      }
    } finally { setConnecting(false); }
  }
  async function logout() {
    try { await client.current.signOut(client.current.auth); window.location.assign('/'); }
    catch { setError('No pudimos cerrar la sesión. Volvé a intentar.'); }
  }
  return <>
    <Head><title>Disponibilidad · {tenantName} · Hay Lugar</title><meta name="robots" content="noindex,nofollow" /><link rel="icon" href={favicon.src} /></Head>
    <div className="admin">
      <header><a className="brand" href="/"><img src={logo.src} alt="Hay Lugar" /></a><div><small>ADMINISTRACIÓN</small><strong>{tenantName}</strong></div>{user && <button type="button" className="secondary logout" onClick={logout}>Cerrar sesión</button>}</header>
      <main>
        <nav style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 20 }}><a href={`/admin/${tenantId}/reservas`}>Reservas</a><a href={`/reservar/${tenantId}`} target="_blank" rel="noopener noreferrer">Link público de reserva ↗</a></nav><h1>Disponibilidad</h1><p className="intro">Definí cómo reservar, los lugares disponibles y los horarios de atención.</p>
        {loading ? <p role="status">Cargando tu panel…</p> : !user ? <section className="box"><h2>Ingresá para continuar</h2><button type="button" onClick={login} disabled={!clientReady || connecting}>{connecting ? 'Conectando…' : 'Ingresar con Google'}</button>{error && <p className="error" role="alert">{error}</p>}{!clientReady && error && <a href={`/admin/${tenantId}`}>Recargar acceso</a>}</section> : !authorized ? <section className="box"><p role="alert">{error}</p><button onClick={() => load(user)}>Volver a intentar</button></section> : <form onSubmit={save}>
          <fieldset disabled={saving}>
            <section className="box"><h2>Modalidad de reserva</h2><div className="modes">
              {[['capacity', 'Cupos por horario', 'Limitá la cantidad de personas para cada horario.'], ['tables', 'Mesas específicas', 'Configurá cada mesa y su capacidad.']].map(([mode, title, description]) => <label className={`mode ${availability.mode === mode ? 'selected' : ''}`} key={mode}><input type="radio" name="mode" value={mode} checked={availability.mode === mode} onChange={() => change({ mode })} /><span><strong>{title}</strong><small>{description}</small></span></label>)}
            </div><p className="hint">Podés cambiar de modalidad conservando los datos de ambas opciones.</p></section>
            {availability.mode === 'capacity' ? <section className="box"><h2>Cupos</h2><label className="field">Personas disponibles por horario<input type="number" min="0" max="10000" required value={availability.capacity} onChange={e => change({ capacity: Number(e.target.value) })} /></label><p className="hint">Con cupo 0, la disponibilidad queda cerrada.</p></section> : <section className="box"><div className="section-head"><h2>Mesas y sectores</h2><button type="button" className="secondary" onClick={() => change({ tables: [...availability.tables, { name: '', sector: 'Salón', seats: 2 }] })}>Agregar mesa</button></div>
              {!availability.tables.length && <p className="hint">Agregá las mesas que podrán recibir reservas.</p>}
              {availability.tables.map((table, i) => <div className="row" key={i}><label className="field">Nombre<input required maxLength="60" placeholder="Mesa 1" value={table.name} onChange={e => updateRow('tables', i, { name: e.target.value })} /></label><label className="field">Sector<input maxLength="60" placeholder="Salón, patio…" value={table.sector} onChange={e => updateRow('tables', i, { sector: e.target.value })} /></label><label className="field narrow">Lugares<input type="number" min="1" max="100" required value={table.seats} onChange={e => updateRow('tables', i, { seats: Number(e.target.value) })} /></label><button type="button" className="remove" aria-label={`Quitar ${table.name || 'mesa'}`} onClick={() => change({ tables: availability.tables.filter((_, index) => index !== i) })}>Quitar</button></div>)}
            </section>}
            <section className="box"><div className="section-head"><h2>Fechas y horarios</h2><button type="button" className="secondary" onClick={() => change({ slots: [...availability.slots, { type: 'weekly', days: [], time: '20:00', duration: 90 }] })}>Agregar horario</button></div><p className="hint">Horarios de Argentina. La duración define cuánto tiempo ocupa lugar cada reserva.</p>
              {!availability.slots.length && <p>Sin horarios configurados todavía.</p>}
              {availability.slots.map((slot, i) => <div className="slot" key={i}><div className="row"><label className="field">Programación<select value={slot.type} onChange={e => updateRow('slots', i, e.target.value === 'weekly' ? { type: 'weekly', days: [] } : { type: 'date', date: '' })}><option value="weekly">Semanal</option><option value="date">Fecha específica</option></select></label>{slot.type === 'date' && <label className="field">Fecha<input type="date" required value={slot.date || ''} onChange={e => updateRow('slots', i, { date: e.target.value })} /></label>}<label className="field">Horario<input type="time" required value={slot.time} onChange={e => updateRow('slots', i, { time: e.target.value })} /></label><label className="field">Duración (min)<input type="number" min="15" max="720" required value={slot.duration} onChange={e => updateRow('slots', i, { duration: Number(e.target.value) })} /></label><button type="button" className="remove" aria-label={`Quitar horario ${slot.time}`} onClick={() => change({ slots: availability.slots.filter((_, index) => index !== i) })}>Quitar</button></div>{slot.type === 'weekly' && <div className="days" aria-label="Días de atención">{days.map((day, d) => <label key={day}><input type="checkbox" checked={slot.days.includes(d)} onChange={e => updateRow('slots', i, { days: e.target.checked ? [...slot.days, d] : slot.days.filter(value => value !== d) })} />{day}</label>)}</div>}</div>)}
            </section>
            <section className="box"><h2>Fechas de cierre</h2><p className="hint">Estas fechas se bloquean aunque tengan un horario semanal o especial.</p><div className="row"><label className="field">Fecha<input type="date" value={closedDate} onChange={e => setClosedDate(e.target.value)} /></label><button type="button" className="secondary" disabled={!closedDate} onClick={() => { change({ closedDates: [...new Set([...availability.closedDates, closedDate])].sort() }); setClosedDate(''); }}>Agregar cierre</button></div><div className="closures">{availability.closedDates.map(date => <button type="button" key={date} className="secondary" aria-label={`Quitar cierre ${date}`} onClick={() => change({ closedDates: availability.closedDates.filter(d => d !== date) })}>{date.split('-').reverse().join('/')} ×</button>)}</div></section>
          </fieldset>
          <div className="save-bar"><div aria-live="polite">{error ? <p className="error" role="alert">{error}</p> : notice ? <p className="success">{notice}</p> : <p>{dirty ? 'Tenés cambios sin guardar.' : 'Configuración de disponibilidad'}</p>}</div><button type="submit" disabled={saving || !dirty}>{saving ? 'Guardando…' : 'Guardar cambios'}</button></div>
        </form>}
      </main><footer>Hay Lugar · {tenantName}</footer>
    </div>
    <style jsx global>{`
      :root { color-scheme: light; font-family: system-ui, sans-serif; color: #281f18; background: #faf6eb; } * { box-sizing: border-box; } body { margin: 0; } button,input,select { font: inherit; } button,a,input,select { touch-action: manipulation; } button { cursor: pointer; border: 1px solid #281f18; background: #281f18; color: #fff; border-radius: 10px; padding: 12px 18px; min-height: 46px; font-weight: 600; } button:disabled { opacity: .5; cursor: default; } button:hover:not(:disabled) { filter: brightness(1.2); } :focus-visible { outline: 3px solid #f2737a; outline-offset: 3px; } a { color: #281f18; } header { display: flex; align-items: center; gap: 18px; padding: 12px max(20px, calc((100vw - 960px)/2)); border-bottom: 1px solid #e8dece; background: #faf6eb; } header strong,header small { display: block; } header small { color: #796b60; font-size: 10px; letter-spacing: 1px; margin-bottom: 4px; } .brand img { width: 100px; height: 66px; object-fit: contain; display: block; } .logout { margin-left: auto; } main { max-width: 1000px; margin: auto; padding: 28px 20px 0; } h1 { font-size: 30px; margin: 0 0 8px; } h2 { font-size: 19px; margin: 0 0 18px; } .intro,.hint { color: #796b60; line-height: 1.6; } .intro { margin: 0 0 28px; } .hint { font-size: 14px; } .box { background: #fffdf8; padding: 24px; border: 1px solid #e8dece; border-radius: 16px; margin-bottom: 20px; } fieldset { border: 0; padding: 0; margin: 0; min-width: 0; } .modes { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; } .mode { display: flex; align-items: flex-start; gap: 10px; border: 1px solid #dfd3c3; border-radius: 12px; padding: 18px; cursor: pointer; } .mode.selected { background: #fff0ef; border-color: #f2737a; } .mode small { display: block; color: #796b60; margin-top: 8px; line-height: 1.5; } input[type=radio],input[type=checkbox] { accent-color: #a84651; width: 18px; height: 18px; } .field { display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 0; font-size: 14px; font-weight: 600; } .field input,.field select { width: 100%; min-width: 0; min-height: 46px; border: 1px solid #dfd3c3; border-radius: 9px; background: #fff; color: #281f18; padding: 10px 12px; } .narrow { flex: .5; } .row { display: flex; align-items: flex-end; gap: 12px; margin-bottom: 16px; } .section-head { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 16px; } .section-head h2 { margin: 0; } .secondary { background: transparent; color: #281f18; border-color: #dfd3c3; } .remove { color: #94392f; background: transparent; border-color: #edd4ce; } .slot { padding-top: 20px; margin-top: 16px; border-top: 1px solid #e8dece; } .days,.closures { display: flex; flex-wrap: wrap; gap: 12px; } .days label { display: flex; align-items: center; gap: 5px; min-height: 44px; } .save-bar { position: sticky; bottom: 0; display: flex; align-items: center; justify-content: space-between; gap: 16px; background: #faf6eb; padding: 16px 0; border-top: 1px solid #e8dece; } .save-bar p { margin: 0; font-size: 14px; } .error { color: #94392f; } .success { color: #32623b; } footer { text-align: center; padding: 26px; font-size: 12px; color: #796b60; } @media(max-width:640px) { header { padding: 10px 16px; gap: 8px; } .brand img { width: 75px; height: 50px; } header strong { font-size: 14px; } .logout { font-size: 12px; padding: 10px; } .box { padding: 18px; } .modes { grid-template-columns: 1fr; } .row { flex-wrap: wrap; } .row .field { flex: 1 1 42%; } .row .remove { margin-left: auto; } .section-head { align-items: flex-start; } .section-head button { font-size: 13px; padding: 10px; } .save-bar button { flex-shrink: 0; font-size: 13px; } }
    `}</style>
  </>;
}
