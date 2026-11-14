/** Date helpers that use the server's local calendar (IST on campus), not UTC */
const pad = (n) => String(n).padStart(2, '0');

function localDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function localTime(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return localDate(new Date(y, m - 1, d + days));
}

/** Whole days between two YYYY-MM-DD dates (b - a) */
function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
}

/** Monday of the week containing `d`, as YYYY-MM-DD */
function weekStart(d = new Date()) {
  const day = (d.getDay() + 6) % 7;
  return localDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - day));
}

module.exports = { localDate, localTime, addDays, daysBetween, weekStart };
