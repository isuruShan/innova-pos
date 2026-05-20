'use strict';

const { BRAND, esc } = require('./emailTheme');
const { ICONS, SOCIAL_KEYS } = require('./socialIcons');

function buildAddressLines(contact) {
  const lines = [];
  if (contact?.addressLine1) lines.push(contact.addressLine1);
  if (contact?.addressLine2) lines.push(contact.addressLine2);
  const cityLine = [contact?.city, contact?.region, contact?.postalCode].filter(Boolean).join(', ');
  if (cityLine) lines.push(cityLine);
  if (contact?.country) lines.push(contact.country);
  return lines;
}

function socialIconRow(contact) {
  const items = [];
  for (const key of SOCIAL_KEYS) {
    const url = String(contact?.social?.[key] || '').trim();
    if (!url || !ICONS[key]) continue;
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    items.push(`
      <td style="padding:0 6px">
        <a href="${esc(url)}" title="${esc(label)}" style="text-decoration:none;display:inline-block">
          <img src="${ICONS[key]}" alt="${esc(label)}" width="36" height="36" style="display:block;border:0;border-radius:50%" />
        </a>
      </td>
    `);
  }
  if (!items.length) return '';
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto">
      <tr>${items.join('')}</tr>
    </table>
  `;
}

/** HTML footer block for transactional emails. */
function buildEmailFooterHtml(contact) {
  const c = contact || {};
  const brand = esc(c.brandName || 'Cafinity POS');
  const website = String(c.publicWebsiteUrl || c.websiteUrl || '').trim();
  const supportEmail = String(c.supportEmail || '').trim();
  const salesEmail = String(c.salesEmail || '').trim();
  const phone = String(c.phonePrimary || '').trim();
  const phone2 = String(c.phoneSecondary || '').trim();
  const addressLines = buildAddressLines(c);
  const social = socialIconRow(c);
  const year = new Date().getFullYear();

  const addressBlock =
    addressLines.length > 0
      ? addressLines.map((line) => `<p style="margin:0 0 4px;font-size:13px;line-height:1.5;color:rgba(255,255,255,0.88)">${esc(line)}</p>`).join('')
      : '';

  const contactRows = [];
  if (website) {
    contactRows.push(`
      <p style="margin:0 0 8px;font-size:13px">
        <a href="${esc(website)}" style="color:${BRAND.accent};text-decoration:none;font-weight:600">${esc(website.replace(/^https?:\/\//, ''))}</a>
      </p>
    `);
  }
  if (supportEmail) {
    contactRows.push(`
      <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.88)">
        <span style="color:rgba(255,255,255,0.55)">Support</span>
        <a href="mailto:${esc(supportEmail)}" style="color:${BRAND.white};text-decoration:none;margin-left:6px">${esc(supportEmail)}</a>
      </p>
    `);
  }
  if (salesEmail && salesEmail !== supportEmail) {
    contactRows.push(`
      <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.88)">
        <span style="color:rgba(255,255,255,0.55)">Sales</span>
        <a href="mailto:${esc(salesEmail)}" style="color:${BRAND.white};text-decoration:none;margin-left:6px">${esc(salesEmail)}</a>
      </p>
    `);
  }
  if (phone) {
    contactRows.push(`<p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.88)"><span style="color:rgba(255,255,255,0.55)">Tel</span> ${esc(phone)}</p>`);
  }
  if (phone2) {
    contactRows.push(`<p style="margin:0;font-size:13px;color:rgba(255,255,255,0.88)">${esc(phone2)}</p>`);
  }

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BRAND.primary};border-radius:0 0 12px 12px;overflow:hidden">
      <tr>
        <td style="height:4px;background:${BRAND.accent};font-size:0;line-height:0">&nbsp;</td>
      </tr>
      <tr>
        <td style="padding:28px 32px 20px;text-align:center">
          <p style="margin:0;font-size:18px;font-weight:700;color:${BRAND.white};letter-spacing:0.02em">${brand}</p>
          <p style="margin:8px 0 0;font-size:12px;color:rgba(255,255,255,0.6)">Modern point of sale for cafés &amp; restaurants</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 24px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td valign="top" style="width:50%;padding-right:12px">
                ${addressBlock || '<p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5)">&nbsp;</p>'}
              </td>
              <td valign="top" style="width:50%;padding-left:12px;text-align:right">
                ${contactRows.join('') || ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>
      ${
        social
          ? `<tr><td style="padding:0 32px 20px;text-align:center">${social}</td></tr>`
          : ''
      }
      <tr>
        <td style="padding:16px 32px 24px;text-align:center;border-top:1px solid rgba(255,255,255,0.12)">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.45);line-height:1.5">
            © ${year} ${brand}. All rights reserved.
          </p>
        </td>
      </tr>
    </table>
  `.trim();
}

function buildEmailHeaderHtml(contact) {
  const brand = esc(contact?.brandName || 'Cafinity POS');
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="background:${BRAND.primary};padding:32px 28px;text-align:center;border-radius:12px 12px 0 0">
          <p style="margin:0;font-size:24px;font-weight:700;color:${BRAND.white};letter-spacing:-0.02em">${brand}</p>
          <p style="margin:10px 0 0;font-size:13px;color:rgba(255,255,255,0.75)">Point of sale for cafés &amp; restaurants</p>
        </td>
      </tr>
    </table>
  `.trim();
}

/** Wrap inner email HTML with branded shell + footer. */
function wrapEmailHtml(innerHtml, contact) {
  const header = buildEmailHeaderHtml(contact);
  const footer = buildEmailFooterHtml(contact);
  const body = String(innerHtml || '').trim();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Cafinity</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bgPage};font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BRAND.bgPage};padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;margin:0 auto">
          <tr>
            <td>${header}</td>
          </tr>
          <tr>
            <td style="background:${BRAND.bgCard};padding:36px 32px;color:${BRAND.text};font-size:15px;line-height:1.65;border-left:1px solid ${BRAND.border};border-right:1px solid ${BRAND.border}">
              ${body}
            </td>
          </tr>
          <tr>
            <td>${footer}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

module.exports = {
  buildEmailFooterHtml,
  buildEmailHeaderHtml,
  wrapEmailHtml,
  buildAddressLines,
};
