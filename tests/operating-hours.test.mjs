import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOperatingHours, permitsArrival } from '../lib/operating-hours.mjs';
import { validateAvailability, emptyAvailability } from '../lib/availability.mjs';
import { slotsForDate } from '../lib/reservations.mjs';
const opening = () => ({ id: 'opening-1', name: 'Cena', type: 'opening', enabled: true, ranges: [{ from: '19:00', to: '24:00' }], days: [6], dates: [], startDate: '2026-10-01', endDate: '2026-10-31' });
test('legacy settings preserve availability until opening hours are configured', () => {
  const settings = { ...emptyAvailability(), slots: [{ type: 'weekly', days: [6], time: '20:00', duration: 90 }] };
  delete settings.operatingHours;
  assert.equal(validateAvailability(settings).operatingHours, null);
  assert.equal(slotsForDate(settings, '2026-10-10').length, 1);
  settings.operatingHours = [];
  assert.equal(slotsForDate(settings, '2026-10-10').length, 0);
});
test('opening intervals use Argentina service dates and exclude closing boundary', () => {
  const rules = [opening()];
  assert.equal(permitsArrival(rules, '2026-10-10', '19:00'), true);
  assert.equal(permitsArrival(rules, '2026-10-10', '23:59'), true);
  assert.equal(permitsArrival(rules, '2026-10-10', '18:59'), false);
  rules[0].ranges[0].to = '22:00';
  assert.equal(permitsArrival(rules, '2026-10-10', '22:00'), false);
  assert.equal(permitsArrival(rules, '2026-11-07', '20:00'), false);
});
test('specific dates add occurrences while disabled rules and validity limits apply', () => {
  const rule = opening(); rule.dates = ['2026-10-12'];
  assert.equal(permitsArrival([rule], '2026-10-12', '20:00'), true);
  rule.enabled = false;
  assert.equal(permitsArrival([rule], '2026-10-12', '20:00'), false);
  rule.enabled = true; rule.endDate = '2026-10-11';
  assert.equal(permitsArrival([rule], '2026-10-12', '20:00'), false);
});
test('partial closures override opening and filter the actual public booking slots', () => {
  const closure = { ...opening(), id: 'close-1', type: 'closure', days: [], dates: ['2026-10-10'], ranges: [{ from: '20:00', to: '21:00' }] };
  const settings = { ...emptyAvailability(), operatingHours: [opening(), closure], slots: ['19:30', '20:00', '20:30', '21:00'].map(time => ({ type: 'date', date: '2026-10-10', time, duration: 90 })) };
  assert.deepEqual(slotsForDate(settings, '2026-10-10').map(slot => slot.time), ['19:30', '21:00']);
  closure.enabled = false;
  assert.equal(slotsForDate(settings, '2026-10-10').length, 4);
});
test('reject malformed rules, reversed/overlapping ranges and impossible dates', () => {
  for (const patch of [{ ranges: [{ from: '24:00', to: '24:00' }] }, { ranges: [{ from: '20:00', to: '19:00' }] }, { ranges: [{ from: '19:00', to: '22:00' }, { from: '21:00', to: '24:00' }] }, { dates: ['2026-02-30'] }, { days: [7] }, { days: [], dates: [] }, { endDate: '2026-09-01' }, { enabled: 'true' }]) assert.throws(() => validateOperatingHours([{ ...opening(), ...patch }]));
  assert.throws(() => validateOperatingHours([opening(), opening()]));
  assert.equal(validateOperatingHours([opening()])[0].ranges[0].to, '24:00');
});
