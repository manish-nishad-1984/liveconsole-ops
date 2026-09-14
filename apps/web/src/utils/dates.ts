/** Today in India as "YYYY-MM-DD" — the value an `<input type="date">` expects. */
export const todayIso = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

/** First day of the current month, "YYYY-MM-01". */
export const monthStartIso = (): string => `${todayIso().slice(0, 8)}01`;

/** "2026-09-14" → "14 Sep 2026", without the time-zone shift `new Date()` would add. */
export const formatDateOnly = (value: string | null | undefined): string => {
  if (!value) return '—';
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
};
