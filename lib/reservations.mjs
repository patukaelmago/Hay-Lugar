export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function argentinaToday(now = new Date()) { return new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10); }
export function validateRequest(input) {
  if (!input || !validDate(input.date) || typeof input.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) throw new Error('Revisá la fecha y el horario.');
  if (!Number.isInteger(input.partySize) || input.partySize < 1 || input.partySize > 100) throw new Error('Elegí entre 1 y 100 personas.');
  if (typeof input.name !== 'string' || input.name.trim().length < 2 || input.name.trim().length > 100) throw new Error('Ingresá tu nombre.');
  if (typeof input.email !== 'string' || input.email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error('Ingresá un correo válido.');
  if (typeof input.phone !== 'string' || input.phone.length > 40 || !/^[+\d\s()-]+$/.test(input.phone) || input.phone.replace(/\D/g, '').length < 8 || input.phone.replace(/\D/g, '').length > 15) throw new Error('Ingresá un teléfono válido.');
  if (typeof input.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId)) throw new Error('Recargá la página para iniciar la reserva.');
  if (input.table != null && (typeof input.table !== 'string' || input.table.length > 60)) throw new Error('Revisá la mesa.');
  return { date: input.date, time: input.time, partySize: input.partySize, name: input.name.trim(), email: input.email.trim().toLowerCase(), phone: input.phone.trim(), table: input.table || null, requestId: input.requestId };
}
export function slotsForDate(settings, date) {
  if (!validDate(date) || settings.closedDates.includes(date)) return [];
  const specials = settings.slots.filter(s => s.type === 'date' && s.date === date);
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const slots = specials.length ? specials : settings.slots.filter(s => s.type === 'weekly' && s.days.includes(day));
  return slots.map(s => ({ time: s.time, duration: s.duration, start: Date.parse(`${date}T${s.time}:00-03:00`), end: Date.parse(`${date}T${s.time}:00-03:00`) + s.duration * 60000 })).sort((a,b) => a.start - b.start);
}
export function remaining(settings, slot, entries, partySize) {
  const overlapping = entries.filter(e => e.start < slot.end && e.end > slot.start);
  if (settings.mode === 'capacity') {
    // Peak concurrent occupancy, rather than adding non-overlapping groups.
    const events = new Map();
    for (const e of overlapping) {
      const start = Math.max(e.start, slot.start), end = Math.min(e.end, slot.end);
      events.set(start, (events.get(start) || 0) + e.partySize);
      events.set(end, (events.get(end) || 0) - e.partySize);
    }
    let total = 0, peak = 0;
    for (const [, delta] of [...events].sort((a,b) => a[0] - b[0])) { total += delta; peak = Math.max(peak, total); }
    return { available: settings.capacity - peak >= partySize, tables: [] };
  }
  // Existing cupo reservations cannot be assigned to a table safely after a mode switch.
  if (overlapping.some(e => !e.table)) return { available: false, tables: [] };
  const tables = settings.tables.filter(t => t.seats >= partySize && !overlapping.some(e => e.table === t.name)).map(t => ({ name: t.name, sector: t.sector, seats: t.seats }));
  return { available: tables.length > 0, tables };
}
export function nearbyDates(date) {
  return [-1,0,1].map(delta => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + delta); return d.toISOString().slice(0,10); });
}
