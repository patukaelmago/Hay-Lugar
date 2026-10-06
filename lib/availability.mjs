export const emptyAvailability = () => ({ mode: 'capacity', capacity: 0, tables: [], slots: [], closedDates: [] });
export function validateAvailability(input) {
  if (!input || !['capacity', 'tables'].includes(input.mode)) throw new Error('Elegí mesas o cupos por horario.');
  const integer = (value, min, max, message) => {
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(message);
    return value;
  };
  const capacity = integer(input.capacity, 0, 10000, 'El cupo debe ser un número entero entre 0 y 10000.');
  if (!Array.isArray(input.tables) || input.tables.length > 300) throw new Error('Revisá las mesas.');
  const tables = input.tables.map(table => {
    if (!table || typeof table.name !== 'string' || !table.name.trim() || table.name.trim().length > 60 || typeof table.sector !== 'string' || table.sector.length > 60) throw new Error('Cada mesa necesita un nombre y un sector válido.');
    return { name: table.name.trim(), sector: table.sector.trim(), seats: integer(table.seats, 1, 100, 'Cada mesa debe tener entre 1 y 100 lugares.') };
  });
  if (new Set(tables.map(t => t.name.toLowerCase())).size !== tables.length) throw new Error('Los nombres de las mesas deben ser únicos.');
  if (!Array.isArray(input.slots) || input.slots.length > 100) throw new Error('Revisá los horarios.');
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  const date = /^\d{4}-\d{2}-\d{2}$/;
  const validDate = value => typeof value === 'string' && date.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const slots = input.slots.map(slot => {
    if (!slot || !time.test(slot.time) || !['weekly', 'date'].includes(slot.type)) throw new Error('Revisá el horario de cada turno.');
    const duration = integer(slot.duration, 15, 720, 'La duración debe estar entre 15 y 720 minutos.');
    if (slot.type === 'date') {
      if (!validDate(slot.date)) throw new Error('Revisá la fecha del turno.');
      return { type: 'date', date: slot.date, time: slot.time, duration };
    }
    if (!Array.isArray(slot.days) || !slot.days.length || new Set(slot.days).size !== slot.days.length || slot.days.some(d => !Number.isInteger(d) || d < 0 || d > 6)) throw new Error('Elegí los días de cada turno semanal.');
    return { type: 'weekly', days: [...slot.days].sort(), time: slot.time, duration };
  });
  const keys = new Set();
  for (const slot of slots) {
    const occurrences = slot.type === 'date' ? [slot.date] : slot.days;
    for (const day of occurrences) {
      const key = `${slot.type}:${day}:${slot.time}`;
      if (keys.has(key)) throw new Error('Hay turnos repetidos para el mismo día y horario.');
      keys.add(key);
    }
  }
  if (!Array.isArray(input.closedDates) || input.closedDates.length > 366 || input.closedDates.some(d => !validDate(d))) throw new Error('Revisá las fechas de cierre.');
  return { mode: input.mode, capacity, tables, slots, closedDates: [...new Set(input.closedDates)].sort() };
}
