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
  .brand-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e94560; padding-bottom: 8px; margin-bottom: 20px; }
  .brand-logo { font-size: 20px; font-weight: 800; color: #e94560; letter-spacing: -0.02em; }
  .footer { margin-top: 16px; color: #999; font-size: 9px; text-align: center; border-top: 1px solid #eee; padding-top: 8px; }
  @media print { body { padding: 12px 16px; } }
</style>
</head>
<body>
  <div class="brand-header">
    <div class="brand-logo">Cafinity</div>
    <div style="text-align: right; font-size: 9px; color: #666; font-weight: 600; text-transform: uppercase;">Day-End Report</div>
  </div>
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

  <div class="footer">Cafinity POS · Day-End Report · ${displayDate}</div>
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

/**
 * Prints a cashier session report after session close.
 * Uses the closed session data returned by POST /cashier-sessions/:id/close
 *
 * @param {object} session - Closed session document (with sessionCloseBreakdown populated)
 * @param {string} storeName
 * @param {string} currencySymbol - e.g. 'Rs.'
 */
export function printSessionReport(session, storeName, currencySymbol = 'Rs.') {
  const fmt = (n) => `${currencySymbol} ${Number(n || 0).toFixed(2)}`;
  const bd = session?.sessionCloseBreakdown || {};

  const fmtDt = (d) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
    catch { return String(d); }
  };

  const cashierName = session?.cashierId?.name || session?.cashierId || 'Cashier';
  const openedAt = fmtDt(session?.openedAt);
  const closedAt = fmtDt(session?.closedAt);
  const openingBalance = fmt(session?.openingCashBalance);
  const closingCounted = fmt(session?.closingCountedCash);
  const expectedCash = fmt(session?.expectedCashInDrawer);
  const variance = Number(session?.varianceAmount || 0);
  const varianceSign = variance >= 0 ? '+' : '';
  const varianceColor = variance > 0 ? '#166534' : variance < 0 ? '#991b1b' : '#555';
  const floatAmount = session?.floatAmount != null ? fmt(session.floatAmount) : null;

  const salesByType = (bd.salesByPaymentType || [])
    .map((row) => `<tr><td>${escHtml(String(row.paymentType || ''))}</td><td class="num">${row.orders ?? 0}</td><td class="num">${fmt(row.revenue)}</td></tr>`)
    .join('');

  const movements = (bd.cashMovements || session?.cashMovements || [])
    .map((m) => {
      const isIn = (m.kind || '') === 'cash_in';
      const color = isIn ? '#166534' : '#92400e';
      const sign = isIn ? '+' : '−';
      return `<tr>
        <td>${escHtml(isIn ? 'Cash In' : 'Cash Out')}</td>
        <td>${escHtml(m.notes || '—')}</td>
        <td class="num" style="color:${color}">${sign} ${fmt(m.amount)}</td>
        <td class="num">${fmtDt(m.createdAt)}</td>
      </tr>`;
    }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Session Report – ${closedAt}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 24px 28px; }
  h1 { font-size: 18px; font-weight: 700; margin-bottom: 2px; }
  .sub { color: #555; font-size: 11px; margin-bottom: 20px; }
  h2 { font-size: 13px; font-weight: 700; margin-bottom: 8px; border-bottom: 1px solid #e5e5e5; padding-bottom: 5px; margin-top: 18px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  thead tr { background: #f5f5f5; }
  th { text-align: left; padding: 6px 8px; font-size: 9px; text-transform: uppercase; letter-spacing: .05em; color: #555; border-bottom: 1px solid #ddd; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .num { text-align: right; font-weight: 600; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 18px; }
  .info-row { display: flex; justify-content: space-between; padding: 5px 10px; background: #f9f9f9; border-radius: 6px; }
  .info-label { color: #666; }
  .info-val { font-weight: 600; }
  .variance { font-weight: 700; color: ${varianceColor}; }
  .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
  .stat { border: 1px solid #ddd; border-radius: 6px; padding: 10px 12px; }
  .stat-label { color: #666; font-size: 9px; text-transform: uppercase; letter-spacing: .05em; }
  .stat-val { font-size: 15px; font-weight: 700; margin-top: 2px; }
  .brand-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e94560; padding-bottom: 8px; margin-bottom: 20px; }
  .brand-logo { font-size: 20px; font-weight: 800; color: #e94560; letter-spacing: -0.02em; }
  .footer { margin-top: 16px; color: #999; font-size: 9px; text-align: center; border-top: 1px solid #eee; padding-top: 8px; }
  @media print { body { padding: 12px 16px; } }
</style>
</head>
<body>
  <div class="brand-header">
    <div class="brand-logo">Cafinity</div>
    <div style="text-align: right; font-size: 9px; color: #666; font-weight: 600; text-transform: uppercase;">Session Report</div>
  </div>
  <h1>Cashier Session Report</h1>
  <p class="sub">${escHtml(storeName || '')}${storeName ? ' · ' : ''}Closed: ${closedAt} · Generated ${new Date().toLocaleTimeString()}</p>

  <h2>Session Details</h2>
  <div class="info-grid">
    <div class="info-row"><span class="info-label">Cashier</span><span class="info-val">${escHtml(cashierName)}</span></div>
    <div class="info-row"><span class="info-label">Opened</span><span class="info-val">${openedAt}</span></div>
    <div class="info-row"><span class="info-label">Closed</span><span class="info-val">${closedAt}</span></div>
    <div class="info-row"><span class="info-label">Total Orders</span><span class="info-val">${bd.orderCount ?? 0}</span></div>
  </div>

  <h2>Sales Summary</h2>
  <div class="summary-grid">
    <div class="stat"><div class="stat-label">Cash Sales</div><div class="stat-val">${fmt(bd.cashSales)}</div></div>
    <div class="stat"><div class="stat-label">Card Sales</div><div class="stat-val">${fmt(bd.cardSales)}</div></div>
    <div class="stat"><div class="stat-label">Discounts</div><div class="stat-val">${fmt(bd.totalDiscounts)}</div></div>
  </div>

  ${salesByType ? `<h2>Sales by Payment Type</h2>
  <table>
    <thead><tr><th>Method</th><th style="text-align:right">Orders</th><th style="text-align:right">Revenue</th></tr></thead>
    <tbody>${salesByType}</tbody>
  </table>` : ''}

  <h2>Cash Drawer Reconciliation</h2>
  <table>
    <tbody>
      <tr><td>Opening Balance</td><td class="num">${openingBalance}</td></tr>
      <tr><td>Cash Sales</td><td class="num">${fmt(bd.cashSales)}</td></tr>
      ${bd.cashInTotal > 0 ? `<tr><td>Cash In (movements)</td><td class="num">+ ${fmt(bd.cashInTotal)}</td></tr>` : ''}
      ${bd.cashOutTotal > 0 ? `<tr><td>Cash Out (movements)</td><td class="num">− ${fmt(bd.cashOutTotal)}</td></tr>` : ''}
      <tr style="background:#f5f5f5"><td style="font-weight:700">Expected in Drawer</td><td class="num" style="font-weight:700">${expectedCash}</td></tr>
      <tr><td>Counted Cash</td><td class="num">${closingCounted}</td></tr>
      <tr><td>Variance</td><td class="num variance">${varianceSign}${fmt(variance)}</td></tr>
      ${floatAmount ? `<tr><td>Float for next session</td><td class="num">${floatAmount}</td></tr>` : ''}
    </tbody>
  </table>

  ${movements ? `<h2>Cash Movements</h2>
  <table>
    <thead><tr><th>Type</th><th>Notes</th><th style="text-align:right">Amount</th><th style="text-align:right">Time</th></tr></thead>
    <tbody>${movements}</tbody>
  </table>` : ''}

  ${session?.varianceNotes ? `<h2>Notes</h2><p style="color:#444;padding:6px 0">${escHtml(session.varianceNotes)}</p>` : ''}

  <div class="footer">Cafinity POS · Session Report · ${closedAt}</div>
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
  setTimeout(() => { w.print(); }, 400);
}
