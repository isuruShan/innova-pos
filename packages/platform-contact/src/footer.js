'use strict';

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildAddressLines(contact) {
  const lines = [];
  if (contact?.addressLine1) lines.push(contact.addressLine1);
  if (contact?.addressLine2) lines.push(contact.addressLine2);
  const cityLine = [contact?.city, contact?.region, contact?.postalCode].filter(Boolean).join(', ');
  if (cityLine) lines.push(cityLine);
  if (contact?.country) lines.push(contact.country);
  return lines;
}

function socialLinks(contact) {
  const items = [];
  const map = [
    ['facebook', 'Facebook'],
    ['instagram', 'Instagram'],
    ['linkedin', 'LinkedIn'],
    ['twitter', 'X'],
    ['youtube', 'YouTube'],
    ['tiktok', 'TikTok'],
  ];
  for (const [key, label] of map) {
    const url = String(contact?.social?.[key] || '').trim();
    if (url) items.push({ label, url });
  }
  return items;
}

/** HTML footer block for transactional emails. */
function buildEmailFooterHtml(contact) {
  const c = contact || {};
  const brand = esc(c.brandName || 'Cafinity POS');
  const website = String(c.publicWebsiteUrl || c.websiteUrl || '').trim();
  const supportEmail = String(c.supportEmail || '').trim();
  const phone = String(c.phonePrimary || '').trim();
  const addressLines = buildAddressLines(c);
  const social = socialLinks(c);

  const parts = [];
  parts.push(`<div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;line-height:1.6">`);
  parts.push(`<p style="margin:0 0 8px 0;font-weight:600;color:#374151">${brand}</p>`);
  if (website) {
    parts.push(
      `<p style="margin:0 0 6px 0"><a href="${esc(website)}" style="color:#e94560;text-decoration:none">${esc(website)}</a></p>`,
    );
  }
  for (const line of addressLines) {
    parts.push(`<p style="margin:0">${esc(line)}</p>`);
  }
  if (supportEmail) {
    parts.push(
      `<p style="margin:8px 0 0 0">Email: <a href="mailto:${esc(supportEmail)}" style="color:#e94560">${esc(supportEmail)}</a></p>`,
    );
  }
  if (phone) {
    parts.push(`<p style="margin:4px 0 0 0">Phone: ${esc(phone)}</p>`);
  }
  if (social.length) {
    const links = social
      .map((s) => `<a href="${esc(s.url)}" style="color:#e94560;text-decoration:none;margin-right:10px">${esc(s.label)}</a>`)
      .join('');
    parts.push(`<p style="margin:10px 0 0 0">${links}</p>`);
  }
  parts.push(`<p style="margin:16px 0 0 0;color:#9ca3af">© ${new Date().getFullYear()} ${brand}. All rights reserved.</p>`);
  parts.push('</div>');
  return parts.join('\n');
}

/** Wrap inner email HTML with standard shell + footer. */
function wrapEmailHtml(innerHtml, contact) {
  const footer = buildEmailFooterHtml(contact);
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
      ${innerHtml}
      ${footer}
    </div>
  `.trim();
}

module.exports = {
  buildEmailFooterHtml,
  wrapEmailHtml,
  buildAddressLines,
};
