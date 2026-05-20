'use strict';

/** Calendar date in the server's local timezone (matches cashier "today"). */
function localDateKey(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as local midnight. */
function parseLocalDateOnly(str) {
  if (!str || typeof str !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

function startOfLocalDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Inclusive calendar days between two local dates. */
function daysInclusive(fromDay, toDay) {
  const a = startOfLocalDay(fromDay);
  const b = startOfLocalDay(toDay);
  return Math.round((b - a) / 86400000) + 1;
}

function parseDateRange(fromQ, toQ) {
  const fromParsed = parseLocalDateOnly(String(fromQ || ''));
  const toParsed = parseLocalDateOnly(String(toQ || ''));
  if (!fromParsed || !toParsed) return { error: 'Invalid from or to date (use YYYY-MM-DD)' };

  let fromDay = startOfLocalDay(fromParsed);
  let toDay = startOfLocalDay(toParsed);
  if (fromDay > toDay) {
    const t = fromDay;
    fromDay = toDay;
    toDay = t;
  }
  const dayCount = daysInclusive(fromDay, toDay);
  const maxDays = 366;
  if (dayCount > maxDays) return { error: `Date range cannot exceed ${maxDays} days` };

  return {
    fromDay,
    toDay,
    dayCount,
    startDate: startOfLocalDay(fromDay),
    endDate: endOfLocalDay(toDay),
    rangeFrom: localDateKey(fromDay),
    rangeTo: localDateKey(toDay),
  };
}

function buildEmptyDailyMap(startDate, dayCount) {
  const dailyMap = {};
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const key = localDateKey(d);
    dailyMap[key] = { date: key, revenue: 0, orders: 0 };
  }
  return dailyMap;
}

module.exports = {
  localDateKey,
  parseLocalDateOnly,
  startOfLocalDay,
  endOfLocalDay,
  daysInclusive,
  parseDateRange,
  buildEmptyDailyMap,
};
