import { emptyAvailability } from './availability.mjs';

export function initialAvailability(tenantId) {
  if (tenantId !== 'pulpo') return emptyAvailability();
  const tables = [
    ['1', 8], ['2', 4], ['3', 8], ['4', 4],
    ['5', 2], ['6', 2], ['7', 8], ['8', 2],
    ['9', 4], ['10', 4], ['110', 4], ['120', 2]
  ].map(([name, seats]) => ({ name, seats, sector: '' }));
  return { ...emptyAvailability(), mode: 'tables', tables, capacity: tables.reduce((sum, table) => sum + table.seats, 0) };
}
