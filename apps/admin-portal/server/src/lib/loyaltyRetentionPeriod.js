'use strict';

function getRetentionPeriodEnd(startDate, mode) {
  if (!startDate || !mode || mode === 'none') return null;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start);
  if (mode === 'monthly') end.setMonth(end.getMonth() + 1);
  else if (mode === 'quarterly') end.setMonth(end.getMonth() + 3);
  else if (mode === 'yearly') end.setFullYear(end.getFullYear() + 1);
  else return null;
  return end;
}

module.exports = { getRetentionPeriodEnd };
