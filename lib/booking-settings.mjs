export function validateBookingSettings(input = {}) {
  const number = (key, fallback, min, max) => {
    const value = input[key] ?? fallback;
    if (!Number.isInteger(value) || value < min || value > max) throw new Error('Revisá los límites de reserva.');
    return value;
  };
  if (input.publicEnabled !== undefined && typeof input.publicEnabled !== 'boolean') throw new Error('Revisá el estado del link público.');
  if (input.policy !== undefined && (typeof input.policy !== 'string' || input.policy.length > 2000)) throw new Error('La política admite hasta 2000 caracteres.');
  return { publicEnabled: input.publicEnabled ?? true, maxAdvanceDays: number('maxAdvanceDays', 90, 1, 365), minNoticeMinutes: number('minNoticeMinutes', 0, 0, 10080), maxPartySize: number('maxPartySize', 100, 1, 100), policy: input.policy?.trim() || '' };
}
export function withinBookingWindow(settings, slot, partySize, now = Date.now()) {
  const rules = validateBookingSettings(settings.booking);
  return rules.publicEnabled && partySize <= rules.maxPartySize && slot.start > now + rules.minNoticeMinutes * 60000 && slot.start <= now + rules.maxAdvanceDays * 86400000;
}
export function tablesForSlot(settings, slot) {
  const layout = slot.layoutId ? settings.layouts?.find(value => value.id === slot.layoutId && value.enabled) : null;
  if (slot.layoutId && !layout) return [];
  return settings.tables.filter(table => table.enabled !== false && (!layout || layout.tables.includes(table.name)));
}
