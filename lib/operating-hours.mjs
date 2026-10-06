const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const validDate = value => typeof value === 'string' && datePattern.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export function timeMinutes(value) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value) && value !== '24:00') return NaN;
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}
export function validateOperatingHours(input) {
  // Null means that this existing tenant has not configured this new module.
  if (input == null) return null;
  if (!Array.isArray(input) || input.length > 100) throw new Error('Revisá los horarios de apertura y cierre.');
  const ids = new Set();
  return input.map(rule => {
    if (!rule || typeof rule.id !== 'string' || !/^[a-zA-Z0-9-]{1,60}$/.test(rule.id) || ids.has(rule.id)) throw new Error('Revisá el identificador del horario.');
    ids.add(rule.id);
    if (typeof rule.name !== 'string' || !rule.name.trim() || rule.name.trim().length > 100 || !['opening', 'closure'].includes(rule.type) || typeof rule.enabled !== 'boolean') throw new Error('Cada horario necesita un nombre y un tipo válido.');
    if (!Array.isArray(rule.ranges) || !rule.ranges.length || rule.ranges.length > 20) throw new Error('Agregá al menos un rango de apertura o cierre.');
    const ranges = rule.ranges.map(range => {
      const start = timeMinutes(range?.from), end = timeMinutes(range?.to);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw new Error('Cada rango debe comenzar antes de terminar. Para medianoche usá 24:00.');
      return { from: range.from, to: range.to };
    }).sort((a, b) => timeMinutes(a.from) - timeMinutes(b.from));
    if (ranges.some((range, i) => i > 0 && timeMinutes(range.from) < timeMinutes(ranges[i - 1].to))) throw new Error('Hay rangos superpuestos dentro del mismo horario.');
    if (!Array.isArray(rule.days) || new Set(rule.days).size !== rule.days.length || rule.days.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error('Revisá los días de atención.');
    if (!Array.isArray(rule.dates) || rule.dates.length > 366 || rule.dates.some(date => !validDate(date))) throw new Error('Revisá las fechas puntuales del horario.');
    if (!rule.days.length && !rule.dates.length) throw new Error('Elegí días semanales o fechas puntuales.');
    const startDate = rule.startDate || null, endDate = rule.endDate || null;
    if (startDate && !validDate(startDate) || endDate && !validDate(endDate) || startDate && endDate && startDate > endDate) throw new Error('Revisá las fechas de inicio y fin.');
    return { id: rule.id, name: rule.name.trim(), type: rule.type, enabled: rule.enabled, ranges, days: [...rule.days].sort(), dates: [...new Set(rule.dates)].sort(), startDate, endDate };
  });
}
export function permitsArrival(rules, date, time) {
  if (rules == null) return true;
  const minute = timeMinutes(time), day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const applicable = rules.filter(rule => rule.enabled && (!rule.startDate || date >= rule.startDate) && (!rule.endDate || date <= rule.endDate) && (rule.days.includes(day) || rule.dates.includes(date)));
  const contains = rule => rule.ranges.some(range => minute >= timeMinutes(range.from) && minute < timeMinutes(range.to));
  return applicable.some(rule => rule.type === 'opening' && contains(rule)) && !applicable.some(rule => rule.type === 'closure' && contains(rule));
}
