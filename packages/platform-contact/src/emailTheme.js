'use strict';

/** Cafinity brand palette for transactional email HTML. */
const BRAND = {
  primary: '#16213e',
  primaryDark: '#0f1729',
  accent: '#e94560',
  accentSoft: '#fce8ec',
  text: '#334155',
  textMuted: '#64748b',
  textLight: '#94a3b8',
  white: '#ffffff',
  bgPage: '#eef2f7',
  bgCard: '#ffffff',
  bgSoft: '#f8fafc',
  border: '#e2e8f0',
};

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function emailHeading(title, subtitle = '') {
  const sub = subtitle
    ? `<p style="margin:8px 0 0;font-size:14px;color:${BRAND.textMuted};line-height:1.5">${esc(subtitle)}</p>`
    : '';
  return `
    <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:${BRAND.primary};line-height:1.3;letter-spacing:-0.02em">
      ${esc(title)}
    </h1>
    ${sub}
  `.trim();
}

function emailParagraph(text) {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${BRAND.text}">${text}</p>`;
}

function emailButton(href, label) {
  const url = esc(href);
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0 8px">
      <tr>
        <td style="border-radius:8px;background:${BRAND.accent}">
          <a href="${url}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:${BRAND.white};text-decoration:none;border-radius:8px">
            ${esc(label)}
          </a>
        </td>
      </tr>
    </table>
  `.trim();
}

function emailPanel(innerHtml) {
  return `
    <div style="background:${BRAND.bgSoft};border:1px solid ${BRAND.border};border-left:4px solid ${BRAND.accent};border-radius:8px;padding:20px 22px;margin:20px 0">
      ${innerHtml}
    </div>
  `.trim();
}

function emailAlert(innerHtml, variant = 'warning') {
  const styles =
    variant === 'error'
      ? { bg: '#fff1f2', border: '#fecdd3', accent: BRAND.accent }
      : { bg: BRAND.accentSoft, border: '#f9a8b4', accent: BRAND.accent };
  return `
    <div style="background:${styles.bg};border:1px solid ${styles.border};border-radius:8px;padding:16px 18px;margin:20px 0">
      ${innerHtml}
    </div>
  `.trim();
}

function emailLabelValue(label, value) {
  return `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:${BRAND.text}">
      <span style="color:${BRAND.textMuted};font-weight:600">${esc(label)}:</span>
      ${value}
    </p>
  `.trim();
}

module.exports = {
  BRAND,
  esc,
  emailHeading,
  emailParagraph,
  emailButton,
  emailPanel,
  emailAlert,
  emailLabelValue,
};
