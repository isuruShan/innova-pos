const RECEIPT_MAX_ITEM_NAME_CHARS = 44;

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function receiptMoney(branding, n) {
  const sym = branding.currencySymbol || 'Rs.';
  return `${sym} ${Number(n || 0).toFixed(2)}`;
}

function receiptItemCode(menuItem) {
  const id = menuItem?.toString?.() ?? String(menuItem ?? '');
  const tail = id.replace(/\s/g, '').slice(-6);
  return tail ? tail.toUpperCase() : '—';
}

function truncateReceiptName(name, maxChars) {
  const t = String(name ?? '').trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}…`;
}

export function printReceipt(order, { branding, store, paymentType, cashTender }) {
  const totalNum = Number(order.totalAmount || 0);
  const subtotal = Number(order.subtotal || 0);
  const discount = Number(order.discountTotal || 0);
  const tax = Number(order.taxAmount || 0);
  const fee = Number(order.serviceFeeAmount || 0);

  const tenderNum =
    typeof cashTender === 'number' && Number.isFinite(cashTender) ? cashTender : null;
  const showCashExtra =
    paymentType === 'cash' && tenderNum != null;
  const changeDue = showCashExtra && tenderNum >= totalNum ? tenderNum - totalNum : null;
  const balanceDue = showCashExtra && tenderNum < totalNum ? totalNum - tenderNum : null;

  const logoBlock = branding.logoUrl
    ? `<div class="logo-wrap"><img class="logo" src="${escapeAttr(branding.logoUrl)}" alt="" /></div>`
    : '';

  const lines = (order.items || []).map((i) => {
    const code = receiptItemCode(i.menuItem);
    const rawName = truncateReceiptName(i.name, RECEIPT_MAX_ITEM_NAME_CHARS);
    const name = escapeHtml(rawName);
    const qty = escapeHtml(String(i.qty));
    const lineAmt = Number(i.price) * Number(i.qty);
    return `
    <tr>
      <td class="col-code">${escapeHtml(code)}</td>
      <td class="col-name"><span class="name-clamp">${name}</span></td>
      <td class="col-qty">${qty}</td>
      <td class="col-amt">${escapeHtml(receiptMoney(branding, lineAmt))}</td>
    </tr>`;
  }).join('');

  const summaryRows = [];
  summaryRows.push(`
    <tr><td class="sum-label">Subtotal</td><td class="sum-val">${escapeHtml(receiptMoney(branding, subtotal))}</td></tr>`);
  if (discount > 0.001) {
    summaryRows.push(`
    <tr><td class="sum-label">Discount</td><td class="sum-val neg">-${escapeHtml(receiptMoney(branding, discount))}</td></tr>`);
  }
  if (fee > 0.001) {
    summaryRows.push(`
    <tr><td class="sum-label">Fees</td><td class="sum-val">${escapeHtml(receiptMoney(branding, fee))}</td></tr>`);
  }
  if (tax > 0.001) {
    summaryRows.push(`
    <tr><td class="sum-label">Tax</td><td class="sum-val">${escapeHtml(receiptMoney(branding, tax))}</td></tr>`);
  }

  const payLabel = String(order.paymentType || paymentType || 'cash').replace(/_/g, ' ');
  const payPretty = payLabel.charAt(0).toUpperCase() + payLabel.slice(1);

  const cashRows = [];
  if (showCashExtra) {
    cashRows.push(`
    <tr><td class="sum-label">Tender</td><td class="sum-val">${escapeHtml(receiptMoney(branding, tenderNum))}</td></tr>`);
    if (changeDue != null && changeDue > 0.001) {
      cashRows.push(`
    <tr><td class="sum-label">Change</td><td class="sum-val">${escapeHtml(receiptMoney(branding, changeDue))}</td></tr>`);
    }
    if (balanceDue != null && balanceDue > 0.001) {
      cashRows.push(`
    <tr><td class="sum-label">Balance due</td><td class="sum-val">${escapeHtml(receiptMoney(branding, balanceDue))}</td></tr>`);
    }
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Receipt #${escapeHtml(String(order.orderNumber))}</title>
<style>
  @page { margin: 4mm; size: auto; }
  * { box-sizing: border-box; }
  body {
    font-family: ui-monospace, 'Cascadia Code', 'Segoe UI', Arial, sans-serif;
    font-size: 11px;
    line-height: 1.25;
    color: #111;
    max-width: 72mm;
    margin: 0 auto;
    padding: 10px 8px 16px;
  }
  .logo-wrap { text-align: center; margin-bottom: 8px; }
  .logo { max-height: 52px; max-width: 160px; object-fit: contain; display: inline-block; }
  .hdr { text-align: center; margin-bottom: 10px; }
  .biz { font-size: 15px; font-weight: 700; margin: 0; letter-spacing: 0.02em; }
  .store-line { margin: 2px 0 0; font-size: 11px; }
  .addr { margin: 2px 0 0; font-size: 10px; color: #333; }
  .meta { text-align: center; font-size: 10px; margin: 10px 0; padding: 6px 0; border-top: 1px dashed #333; border-bottom: 1px dashed #333; }
  .meta p { margin: 2px 0; }
  table.grid { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 6px; }
  table.grid th {
    border-bottom: 1px solid #111;
    padding: 4px 2px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  table.grid td { padding: 5px 2px; vertical-align: top; border-bottom: 1px dotted #bbb; word-break: break-word; }
  .col-code { width: 14%; font-size: 10px; font-weight: 600; }
  .col-name { width: 46%; font-size: 10px; }
  .col-qty { width: 12%; text-align: center; font-weight: 600; }
  .col-amt { width: 28%; text-align: right; font-size: 10px; white-space: nowrap; }
  .name-clamp {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    max-height: 2.6em;
  }
  table.summary { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
  table.summary td { padding: 3px 0; vertical-align: top; }
  table.summary td.sum-label { width: 55%; }
  .sum-label { color: #333; }
  .sum-val { text-align: right; font-weight: 600; white-space: nowrap; }
  .sum-val.neg { color: #0a5d0a; }
  .total-sep { border-top: 2px solid #111; margin: 10px 0 6px; }
  .total-row td { padding-top: 10px; padding-bottom: 4px; font-size: 14px; font-weight: 700; letter-spacing: 0.03em; }
  .total-row td.sum-val { font-size: 15px; }
  .pay { text-align: center; font-size: 11px; margin-top: 10px; }
  .ftr { text-align: center; font-size: 10px; margin-top: 14px; padding-top: 10px; border-top: 1px dashed #999; color: #333; }
</style>
</head>
<body>
  ${logoBlock}
  <header class="hdr">
    <p class="biz">${escapeHtml(branding.businessName || 'POS')}</p>
    ${store?.name ? `<p class="store-line">${escapeHtml(store.name)}</p>` : ''}
    ${store?.address ? `<p class="addr">${escapeHtml(store.address)}</p>` : ''}
  </header>
  <div class="meta">
    <p><strong>#${escapeHtml(String(order.orderNumber))}</strong></p>
    <p>${escapeHtml(new Date(order.createdAt).toLocaleString())}</p>
    <p>${escapeHtml(String(order.orderType || '').replace(/-/g, ' '))}${order.tableNumber ? ` · Table ${escapeHtml(order.tableNumber)}` : ''}${order.reference ? ` · ${escapeHtml(order.reference)}` : ''}</p>
  </div>
  <table class="grid" cellspacing="0" cellpadding="0">
    <thead>
      <tr>
        <th align="left">Code</th>
        <th align="left">Item</th>
        <th align="center">Qty</th>
        <th align="right">Amt</th>
      </tr>
    </thead>
    <tbody>${lines}</tbody>
  </table>
  <table class="summary" cellspacing="0" cellpadding="0">
    <tbody>
      ${summaryRows.join('')}
      ${cashRows.join('')}
    </tbody>
  </table>
  <div class="total-sep"></div>
  <table class="summary" cellspacing="0" cellpadding="0">
    <tbody>
      <tr class="total-row">
        <td class="sum-label">TOTAL</td>
        <td class="sum-val">${escapeHtml(receiptMoney(branding, totalNum))}</td>
      </tr>
    </tbody>
  </table>
  <p class="pay"><strong>${escapeHtml(payPretty)}</strong></p>
  <footer class="ftr">${escapeHtml(branding.receiptFooter || 'Thank you for your visit!')}</footer>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=380,height=720');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}
