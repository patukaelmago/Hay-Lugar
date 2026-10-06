import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyAvailability, validateAvailability } from '../lib/availability.mjs';
const base = () => ({ ...emptyAvailability(), capacity: 40, tables: [{ name: 'Mesa 1', sector: 'Salón', seats: 4 }], slots: [{ type: 'weekly', days: [5, 6], time: '20:30', duration: 90 }] });
test('both modes preserve capacity and tables when switching', () => {
  for (const mode of ['capacity', 'tables']) { const result = validateAvailability({ ...base(), mode }); assert.equal(result.mode, mode); assert.equal(result.capacity, 40); assert.equal(result.tables[0].name, 'Mesa 1'); assert.equal(result.tables[0].seats, 4); assert.equal(result.slots[0].time, '20:30'); assert.deepEqual(result.layouts, []); assert.equal(result.booking.publicEnabled, true); }
});
test('reject malformed dates, days, capacities and table duplicates', () => {
  for (const input of [{ ...base(), capacity: -1 }, { ...base(), tables: [...base().tables, { name: 'mesa 1', sector: '', seats: 2 }] }, { ...base(), slots: [{ type: 'date', date: '2026-02-30', time: '20:30', duration: 90 }] }, { ...base(), slots: [{ type: 'weekly', days: [7], time: '20:30', duration: 90 }] }]) assert.throws(() => validateAvailability(input));
});
test('reject duplicate weekly occurrences even with different day groups', () => {
  const input = base(); input.slots.push({ type: 'weekly', days: [6], time: '20:30', duration: 60 });
  assert.throws(() => validateAvailability(input), /repetidos/);
});
test('support exact dates and deduplicate closures', () => {
  const input = base(); input.slots.push({ type: 'date', date: '2026-10-10', time: '21:30', duration: 120 }); input.closedDates = ['2026-10-12', '2026-10-12'];
  assert.deepEqual(validateAvailability(input).closedDates, ['2026-10-12']);
});
