/** Small date helpers. Dates for days are local yyyy-mm-dd strings. */

export function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fromIsoDay(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function today() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Whole days from today until the given yyyy-mm-dd (negative = overdue). */
export function daysUntil(day: string) {
  return Math.round((fromIsoDay(day).getTime() - today().getTime()) / 86_400_000);
}

export function nextDays(n: number, from = today()) {
  return Array.from({ length: n }, (_, i) => addDays(from, i));
}

export const shortDay = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(d);

export const longDay = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);

export const clock = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

/** "in 4 days", "tomorrow", "today", "2 days overdue". */
export function relativeDays(n: number) {
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n > 1) return `in ${n} days`;
  return n === -1 ? '1 day overdue' : `${-n} days overdue`;
}
