export function fmt(n: number, currency = 'AUD') {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export function fmtFull(n: number, currency = 'AUD') {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(n);
}

export function pctChange(current: number, prev: number) {
  if (prev === 0) return null;
  return ((current - prev) / prev * 100).toFixed(1);
}

export function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export function monthStartStr() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split('T')[0];
}

export function lastMonthRange() {
  const n = new Date();
  const s = new Date(n.getFullYear(), n.getMonth() - 1, 1);
  const e = new Date(n.getFullYear(), n.getMonth(), 0);
  return { from: s.toISOString().split('T')[0], to: e.toISOString().split('T')[0] };
}

export function thisWeekRange() {
  const n = new Date();
  const day = n.getDay();
  const mon = new Date(n);
  mon.setDate(n.getDate() - (day === 0 ? 6 : day - 1));
  return { from: mon.toISOString().split('T')[0], to: todayStr() };
}

export function thisQuarterRange() {
  const n = new Date();
  const q = Math.floor(n.getMonth() / 3);
  return { from: new Date(n.getFullYear(), q * 3, 1).toISOString().split('T')[0], to: todayStr() };
}

export function lastQuarterRange() {
  const n = new Date();
  const q = Math.floor(n.getMonth() / 3);
  const lqs = q === 0 ? new Date(n.getFullYear() - 1, 9, 1) : new Date(n.getFullYear(), (q - 1) * 3, 1);
  const lqe = q === 0 ? new Date(n.getFullYear() - 1, 12, 0) : new Date(n.getFullYear(), q * 3, 0);
  return { from: lqs.toISOString().split('T')[0], to: lqe.toISOString().split('T')[0] };
}

export function thisYearRange() {
  const n = new Date();
  return { from: new Date(n.getFullYear(), 0, 1).toISOString().split('T')[0], to: todayStr() };
}

export const PRESETS = [
  { label: 'Today', fn: () => ({ from: todayStr(), to: todayStr() }) },
  { label: 'This Week', fn: thisWeekRange },
  { label: 'This Month', fn: () => ({ from: monthStartStr(), to: todayStr() }) },
  { label: 'Last Month', fn: lastMonthRange },
  { label: 'This Quarter', fn: thisQuarterRange },
  { label: 'Last Quarter', fn: lastQuarterRange },
  { label: 'This Year', fn: thisYearRange },
];
