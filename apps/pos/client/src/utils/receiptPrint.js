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

/**
 * Lightweight Code-128 B barcode generator (inline SVG, no external deps).
 * Returns an <img> tag with a data-URI SVG barcode for the given text.
 */
function generateBarcodeSVG(text) {
  // Code 128 B character set (space=32 to DEL=127)
  const CODE128B_PATTERNS = [
    '11011001100','11001101100','11001100110','10010011000','10010001100',
    '10001001100','10011001000','10011000100','10001100100','11001001000',
    '11001000100','11000100100','10110011100','10011011100','10011001110',
    '10111001100','10011101100','10011100110','11001110010','11001011100',
    '11001001110','11011100100','11001110100','11101101110','11101001100',
    '11100101100','11100100110','11101100100','11100110100','11100110010',
    '11011011000','11011000110','11000110110','10100011000','10001011000',
    '10001000110','10110001000','10001101000','10001100010','11010001000',
    '11000101000','11000100010','10110111000','10110001110','10001101110',
    '10111011000','10111000110','10001110110','11101110110','11010001110',
    '11000101110','11011101000','11011100010','11011101110','11101011000',
    '11101000110','11100010110','11101101000','11101100010','11100011010',
    '11101111010','11001000010','11110001010','10100110000','10100001100',
    '10010110000','10010000110','10000101100','10000100110','10110010000',
    '10110000100','10011010000','10011000010','10000110100','10000110010',
    '11000010010','11001010000','11110111010','11000010100','10001111010',
    '10100111100','10010111100','10010011110','10111100100','10011110100',
    '10011110010','11110100100','11110010100','11110010010','11011011110',
    '11011110110','11110110110','10101111000','10100011110','10001011110',
    '10111101000','10111100010','11110101000','11110100010','10111011110',
    '10111101110','11101011110','11110101110','11010000100','11010010000',
    '11010011100','1100011101011',
  ];
  const START_B = '11010010000';
  const STOP    = '1100011101011';

  const chars = String(text);
  let checksum = 104; // START B value
  let bars = START_B;

  for (let i = 0; i < chars.length; i++) {
    const code = chars.charCodeAt(i) - 32;
    if (code < 0 || code > 95) continue;
    checksum += (i + 1) * code;
    bars += CODE128B_PATTERNS[code];
  }
  bars += CODE128B_PATTERNS[checksum % 103];
  bars += STOP;

  const barW = 1.8;
  const height = 40;
  const quietZone = 10;
  const totalWidth = bars.length * barW + quietZone * 2;

  let x = quietZone;
  let rects = '';
  let i = 0;
  while (i < bars.length) {
    const bit = bars[i];
    let w = 0;
    while (i < bars.length && bars[i] === bit) { w++; i++; }
    if (bit === '1') {
      rects += `<rect x="${x.toFixed(1)}" y="0" width="${(w * barW).toFixed(1)}" height="${height}" fill="#000"/>`;
    }
    x += w * barW;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}">${rects}</svg>`;
  const dataUri = `data:image/svg+xml;base64,${btoa(svg)}`;
  return `<img src="${dataUri}" alt="Barcode for ${escapeAttr(text)}" style="display:block;height:${height}px;max-width:100%;" />`;
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
    let nameHtml = `<span class="name-clamp">${escapeHtml(rawName)}</span>`;
    if (i.variantName) {
      nameHtml += `<span style="display: block; font-size: 9px; color: #555; padding-top: 1px;">↳ ${escapeHtml(i.variantName)}</span>`;
    }
    const qty = escapeHtml(String(i.qty));
    const lineAmt = Number(i.price) * Number(i.qty);
    return `
    <tr>
      <td class="col-code">${escapeHtml(code)}</td>
      <td class="col-name">${nameHtml}</td>
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
  .barcode-section { text-align: center; margin-top: 12px; padding-top: 8px; border-top: 1px dashed #ccc; }
  .barcode-section img { display: inline-block; max-width: 100%; }
  .barcode-label { font-size: 9px; color: #666; margin-top: 3px; letter-spacing: 0.1em; }
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
  <div class="barcode-section">
    ${generateBarcodeSVG(String(order.orderNumber).padStart(3, '0'))}
    <div class="barcode-label">#${escapeHtml(String(order.orderNumber).padStart(3, '0'))}</div>
  </div>
  <footer class="ftr">${escapeHtml(branding.receiptFooter || 'Thank you for your visit!')}</footer>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=380,height=720');
  if (!w) {
    console.warn('[Receipt Print] Popup blocked or failed to open');
    return;
  }
  
  try {
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  } catch (err) {
    console.error('[Receipt Print] Error during print:', err);
    w.close();
  }
}

/**
 * Print kitchen ticket (order preparation slip)
 * Simpler format focused on items, quantities, and prep notes
 */
export function printKitchenTicket(order, { branding, store }) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Kitchen Ticket #${escapeHtml(String(order.orderNumber))}</title>
<style>
  @page { margin: 4mm; size: auto; }
  * { box-sizing: border-box; }
  body {
    font-family: ui-monospace, 'Cascadia Code', 'Segoe UI', Arial, sans-serif;
    font-size: 12px;
    line-height: 1.3;
    color: #111;
    max-width: 72mm;
    margin: 0 auto;
    padding: 8px;
  }
  .hdr { text-align: center; margin-bottom: 8px; border-bottom: 2px solid #000; padding-bottom: 6px; }
  .biz { font-size: 16px; font-weight: 700; margin: 0; }
  .store-line { margin: 2px 0 0; font-size: 11px; color: #333; }
  .ticket-label { font-size: 14px; font-weight: 700; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
  .meta { text-align: center; font-size: 11px; margin: 8px 0; padding: 6px 0; border-bottom: 1px solid #333; }
  .meta p { margin: 2px 0; }
  .order-num { font-size: 28px; font-weight: 900; margin: 8px 0; letter-spacing: 0.02em; }
  .order-type { display: inline-block; background: #000; color: #fff; padding: 4px 12px; border-radius: 6px; font-weight: 700; font-size: 11px; text-transform: uppercase; }
  .items { margin-top: 12px; }
  .item { padding: 8px 0; border-bottom: 1px dashed #999; }
  .item:last-child { border-bottom: 2px solid #000; }
  .item-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
  .item-name { font-size: 14px; font-weight: 700; }
  .item-qty { font-size: 18px; font-weight: 900; background: #000; color: #fff; padding: 2px 8px; border-radius: 4px; }
  .item-variant { font-size: 11px; color: #333; margin-top: 2px; padding-left: 8px; }
  .item-variant::before { content: '↳ '; }
  .notes { margin-top: 12px; padding: 8px; background: #f0f0f0; border: 1px solid #999; border-radius: 4px; }
  .notes-title { font-weight: 700; font-size: 11px; text-transform: uppercase; margin-bottom: 4px; }
  .notes-text { font-size: 11px; }
  .ftr { text-align: center; font-size: 10px; margin-top: 12px; padding-top: 8px; border-top: 1px dashed #999; color: #666; }
  .timestamp { text-align: center; font-size: 10px; color: #666; margin-top: 8px; }
  .barcode-section { text-align: center; margin: 6px 0 4px; }
  .barcode-section img { display: inline-block; max-width: 100%; }
  .barcode-label { font-size: 9px; color: #666; margin-top: 2px; letter-spacing: 0.1em; }
</style>
</head>
<body>
  <header class="hdr">
    <p class="biz">${escapeHtml(branding.businessName || 'POS')}</p>
    ${store?.name ? `<p class="store-line">${escapeHtml(store.name)}</p>` : ''}
    <p class="ticket-label">Kitchen Ticket</p>
  </header>
  <div class="meta">
    <p class="order-num">#${escapeHtml(String(order.orderNumber).padStart(3, '0'))}</p>
    <div class="barcode-section">
      ${generateBarcodeSVG(String(order.orderNumber).padStart(3, '0'))}
      <div class="barcode-label">#${escapeHtml(String(order.orderNumber).padStart(3, '0'))}</div>
    </div>
    <p><span class="order-type">${escapeHtml(String(order.orderType || 'dine-in').replace(/-/g, ' '))}</span></p>
    ${order.tableNumber ? `<p style="font-weight: 700; font-size: 13px; margin-top: 4px;">TABLE ${escapeHtml(order.tableNumber)}</p>` : ''}
    ${order.reference ? `<p style="font-size: 11px; margin-top: 2px;">Ref: ${escapeHtml(order.reference)}</p>` : ''}
    ${order.customerName ? `<p style="font-size: 11px;">Customer: ${escapeHtml(order.customerName)}</p>` : ''}
  </div>
  <div class="items">
    ${(order.items || []).map((item) => {
      const variantHtml = item.variantName 
        ? `<div class="item-variant">${escapeHtml(item.variantName)}</div>` 
        : '';
      const comboHtml = item.isCombo && item.comboItems?.length 
        ? `<div class="item-variant">Combo: ${item.comboItems.map(c => `${escapeHtml(c.name)} x${c.qty}`).join(', ')}</div>`
        : '';
      return `
    <div class="item">
      <div class="item-header">
        <div class="item-name">${escapeHtml(item.name)}</div>
        <div class="item-qty">×${escapeHtml(String(item.qty))}</div>
      </div>
      ${variantHtml}
      ${comboHtml}
    </div>`;
    }).join('')}
  </div>
  ${order.notes ? `
  <div class="notes">
    <div class="notes-title">Special Instructions</div>
    <div class="notes-text">${escapeHtml(order.notes)}</div>
  </div>` : ''}
  <div class="timestamp">
    Printed: ${escapeHtml(new Date().toLocaleString())}
  </div>
  <footer class="ftr">Prepare with care</footer>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=380,height=720');
  if (!w) {
    console.warn('[Kitchen Ticket Print] Popup blocked or failed to open');
    return;
  }
  
  try {
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  } catch (err) {
    console.error('[Kitchen Ticket Print] Error during print:', err);
    w.close();
  }
}

export function printSplitReceipt(order, splitPayment, { branding, store }) {
  const isItemSplit = Array.isArray(splitPayment.itemsPaid) && splitPayment.itemsPaid.length > 0;
  
  let filteredItems = [];
  let subtotal = 0;
  let discount = 0;
  let tax = 0;
  let fee = 0;
  let totalNum = splitPayment.amount;

  if (isItemSplit) {
    const originalSub = order.subtotal || order.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    splitPayment.itemsPaid.forEach(ip => {
      const match = order.items.find(i => (i.menuItem || i._id) === ip.itemId);
      if (match) {
        const lineSub = match.price * ip.qty;
        subtotal += lineSub;
        filteredItems.push({
          ...match,
          qty: ip.qty,
        });
      }
    });
    const ratio = originalSub > 0 ? subtotal / originalSub : 0;
    discount = (order.discountTotal || 0) * ratio;
    tax = (order.taxAmount || 0) * ratio;
    fee = (order.serviceFeeAmount || 0) * ratio;
  } else {
    const ratio = order.totalAmount > 0 ? splitPayment.amount / order.totalAmount : 0;
    subtotal = (order.subtotal || 0) * ratio;
    discount = (order.discountTotal || 0) * ratio;
    tax = (order.taxAmount || 0) * ratio;
    fee = (order.serviceFeeAmount || 0) * ratio;
    filteredItems = order.items.map(i => ({
      ...i,
      qty: i.qty * ratio,
    }));
  }

  const lines = filteredItems.map((i) => {
    const code = receiptItemCode(i.menuItem);
    const rawName = truncateReceiptName(i.name, RECEIPT_MAX_ITEM_NAME_CHARS);
    let nameHtml = `<span class="name-clamp">${escapeHtml(rawName)}</span>`;
    if (i.variantName) {
      nameHtml += `<span style="display: block; font-size: 9px; color: #555; padding-top: 1px;">↳ ${escapeHtml(i.variantName)}</span>`;
    }
    const qty = Number(i.qty).toFixed(isItemSplit ? 0 : 2).replace(/\.00$/, '');
    const lineAmt = Number(i.price) * Number(i.qty);
    return `
    <tr>
      <td class="col-code">${escapeHtml(code)}</td>
      <td class="col-name">${nameHtml}</td>
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

  const payLabel = String(splitPayment.paymentType || 'cash').replace(/_/g, ' ');
  const payPretty = payLabel.charAt(0).toUpperCase() + payLabel.slice(1);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Receipt #${escapeHtml(String(order.orderNumber))} (Split)</title>
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
  .sum-val { text-align: right; font-weight: 600; white-space: nowrap; }
  .total-sep { border-top: 2px solid #111; margin: 10px 0 6px; }
  .total-row td { padding-top: 10px; padding-bottom: 4px; font-size: 14px; font-weight: 700; letter-spacing: 0.03em; }
  .total-row td.sum-val { font-size: 15px; }
  .pay { text-align: center; font-size: 11px; margin-top: 10px; }
  .ftr { text-align: center; font-size: 10px; margin-top: 14px; padding-top: 10px; border-top: 1px dashed #999; color: #333; }
</style>
</head>
<body>
  <header class="hdr">
    <p class="biz">${escapeHtml(branding.businessName || 'POS')}</p>
    ${store?.name ? `<p class="store-line">${escapeHtml(store.name)}</p>` : ''}
    <p style="font-size: 11px; font-weight: bold; margin: 2px 0 0; color: #555;">SPLIT BILL PAYMENT</p>
  </header>
  <div class="meta">
    <p><strong>#${escapeHtml(String(order.orderNumber))}</strong></p>
    <p>${escapeHtml(new Date().toLocaleString())}</p>
    <p>${escapeHtml(String(order.orderType || '').replace(/-/g, ' '))}${order.tableNumber ? ` · Table ${escapeHtml(order.tableNumber)}` : ''}</p>
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
    </tbody>
  </table>
  <div class="total-sep"></div>
  <table class="summary" cellspacing="0" cellpadding="0">
    <tbody>
      <tr class="total-row">
        <td class="sum-label">PAID</td>
        <td class="sum-val">${escapeHtml(receiptMoney(branding, totalNum))}</td>
      </tr>
    </tbody>
  </table>
  <p class="pay"><strong>${escapeHtml(payPretty)}</strong></p>
  <footer class="ftr">${escapeHtml(branding.receiptFooter || 'Thank you for your visit!')}</footer>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=380,height=720');
  if (!w) {
    console.warn('[Receipt Print] Popup blocked or failed to open');
    return;
  }
  
  try {
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  } catch (err) {
    console.error('[Receipt Print] Error during print:', err);
    w.close();
  }
}
