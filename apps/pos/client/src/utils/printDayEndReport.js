/**
 * Opens a browser print dialog with a formatted day-end sales report.
 * Uses the browser's native print-to-PDF capability — no extra dependencies.
 *
 * @param {object} data  - Response from GET /reports/day-end
 * @param {string} storeName
 * @param {string} date  - YYYY-MM-DD
 * @param {string} currencySymbol - e.g. 'Rs.'
 */
export function printDayEndReport(data, storeName, date, currencySymbol = 'Rs.') {
  const fmt = (n) => `${currencySymbol} ${Number(n || 0).toFixed(2)}`;

  const summaryRows = [
    ['Total orders', data.totalOrders ?? 0],
    ['Total revenue', fmt(data.totalRevenue)],
    ['Avg order value', fmt(data.avgOrderValue)],
    ['Total discounts', fmt(data.totalDiscounts)],
  ];

  const promoRows = (data.promotionStats || []).map((p) => `
    <tr>
      <td>${escHtml(p.name)}</td>
      <td>${p.uses}</td>
      <td>${fmt(p.totalDiscount)}</td>
    </tr>`).join('');

  const orderRows = (data.orders || []).map((o) => {
    const items = (o.items || []).map((i) => `${escHtml(i.name)} ×${i.qty}`).join(', ');
    const t = new Date(o.createdAt);
    const time = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `
      <tr>
        <td class="mono">#${String(o.orderNumber ?? '').padStart(3, '0')}</td>
        <td>${o.tableNumber != null ? `Table ${o.tableNumber}` : '—'}</td>
        <td class="items">${escHtml(items)}</td>
        <td class="num">${fmt(o.totalAmount)}</td>
        <td><span class="badge ${o.status}">${o.status}</span></td>
        <td class="num">${time}</td>
      </tr>`;
  }).join('');

  const displayDate = (() => {
    try { return new Date(date + 'T00:00:00').toLocaleDateString(undefined, { dateStyle: 'long' }); }
    catch { return date; }
  })();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Day-End Report – ${displayDate}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 24px 28px; }
  h1 { font-size: 18px; font-weight: 700; margin-bottom: 2px; }
  .sub { color: #555; font-size: 11px; margin-bottom: 20px; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 22px; }
  .stat { border: 1px solid #ddd; border-radius: 6px; padding: 10px 12px; }
  .stat-label { color: #666; font-size: 9px; text-transform: uppercase; letter-spacing: .05em; }
  .stat-val { font-size: 15px; font-weight: 700; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 22px; }
  thead tr { background: #f5f5f5; }
  th { text-align: left; padding: 6px 8px; font-size: 9px; text-transform: uppercase; letter-spacing: .05em; color: #555; border-bottom: 1px solid #ddd; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .mono { font-family: monospace; font-weight: 600; color: #b45309; }
  .items { max-width: 280px; }
  .num { text-align: right; font-weight: 600; white-space: nowrap; }
  .badge { padding: 1px 6px; border-radius: 20px; font-size: 9px; font-weight: 600; }
  .badge.completed { background: #dcfce7; color: #166534; }
  .badge.pending { background: #fef9c3; color: #854d0e; }
  .badge.cancelled { background: #fee2e2; color: #991b1b; }
  h2 { font-size: 13px; font-weight: 700; margin-bottom: 8px; border-bottom: 1px solid #e5e5e5; padding-bottom: 5px; }
  .footer { margin-top: 16px; color: #999; font-size: 9px; text-align: center; border-top: 1px solid #eee; padding-top: 8px; }
  @media print { body { padding: 12px 16px; } }
</style>
</head>
<body>
  <h1>Day-End Report</h1>
  <p class="sub">${escHtml(storeName || '')}${storeName ? ' · ' : ''}${displayDate} · Generated ${new Date().toLocaleTimeString()}</p>

  <div class="summary-grid">
    ${summaryRows.map(([label, val]) => `
    <div class="stat">
      <div class="stat-label">${escHtml(label)}</div>
      <div class="stat-val">${val}</div>
    </div>`).join('')}
  </div>

  ${promoRows ? `<h2>Promotions</h2>
  <table>
    <thead><tr><th>Promotion</th><th>Uses</th><th style="text-align:right">Discount</th></tr></thead>
    <tbody>${promoRows}</tbody>
  </table>` : ''}

  <h2>Order Breakdown — ${data.totalOrders ?? 0} orders</h2>
  ${orderRows ? `<table>
    <thead>
      <tr>
        <th>Order #</th><th>Table</th><th>Items</th>
        <th style="text-align:right">Total</th>
        <th>Status</th><th style="text-align:right">Time</th>
      </tr>
    </thead>
    <tbody>${orderRows}</tbody>
  </table>` : '<p style="color:#999; margin-bottom:16px">No orders for this date.</p>'}

  <div class="footer">SplitSecond POS · Day-End Report · ${displayDate}</div>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) {
    alert('Pop-up blocked. Please allow pop-ups to generate the report.');
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  // Small delay so the page renders before print dialog
  setTimeout(() => { w.print(); }, 400);
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
