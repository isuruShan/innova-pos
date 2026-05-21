'use strict';

/** Cafinity brand palette for transactional email HTML - Modern, vibrant, professional design */
const BRAND = {
  primary: '#16213e',        // Deep navy blue - trustworthy, professional
  primaryLight: '#1e2d4f',   // Lighter navy for hover states
  primaryDark: '#0f1729',    // Darker navy for depth
  accent: '#ff6b35',         // Vibrant coral-orange - energetic, warm
  accentHover: '#ff8555',    // Lighter orange for hover
  accentSoft: '#fff3ed',     // Soft peach background
  accentMuted: '#ffb894',    // Muted orange for secondary elements
  success: '#10b981',        // Fresh green for success states
  successBg: '#d1fae5',      // Light green background
  warning: '#f59e0b',        // Amber for warnings
  warningBg: '#fef3c7',      // Light amber background
  error: '#ef4444',          // Bright red for errors
  errorBg: '#fee2e2',        // Light red background
  text: '#1e293b',           // Rich dark slate for primary text
  textMuted: '#64748b',      // Medium slate for secondary text
  textLight: '#94a3b8',      // Light slate for tertiary text
  white: '#ffffff',
  bgPage: '#f8fafc',         // Very light gray-blue for page background
  bgCard: '#ffffff',         // Pure white for cards
  bgSoft: '#f1f5f9',         // Soft gray-blue for panels
  border: '#e2e8f0',         // Subtle border
  borderStrong: '#cbd5e1',   // Stronger border for emphasis
  gradient: 'linear-gradient(135deg, #16213e 0%, #1e2d4f 100%)', // Gradient for premium feel
  gradientWarm: 'linear-gradient(135deg, #ff6b35 0%, #ff8555 100%)', // Warm gradient for CTAs
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
    ? `<p style="margin:12px 0 0;font-size:15px;color:${BRAND.textMuted};line-height:1.6;font-weight:400">${esc(subtitle)}</p>`
    : '';
  return `
    <div style="margin:0 0 32px;padding:0 0 24px;border-bottom:3px solid ${BRAND.accentSoft}">
      <h1 style="margin:0;font-size:28px;font-weight:800;color:${BRAND.primary};line-height:1.2;letter-spacing:-0.03em">
        ${esc(title)}
      </h1>
      ${sub}
    </div>
  `.trim();
}

function emailParagraph(text) {
  return `<p style="margin:0 0 18px;font-size:16px;line-height:1.75;color:${BRAND.text};font-weight:400">${text}</p>`;
}

function emailButton(href, label) {
  const url = esc(href);
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 12px">
      <tr>
        <td style="border-radius:12px;background:${BRAND.gradientWarm};box-shadow:0 4px 12px rgba(255, 107, 53, 0.3)">
          <a href="${url}" style="display:inline-block;padding:16px 36px;font-size:16px;font-weight:700;color:${BRAND.white};text-decoration:none;border-radius:12px;letter-spacing:0.02em;text-transform:none">
            ${esc(label)}
          </a>
        </td>
      </tr>
    </table>
  `.trim();
}

function emailPanel(innerHtml) {
  return `
    <div style="background:${BRAND.bgSoft};border:2px solid ${BRAND.border};border-left:5px solid ${BRAND.accent};border-radius:12px;padding:24px 26px;margin:24px 0;box-shadow:0 2px 8px rgba(22, 33, 62, 0.06)">
      ${innerHtml}
    </div>
  `.trim();
}

function emailAlert(innerHtml, variant = 'warning') {
  const styles =
    variant === 'error'
      ? { bg: BRAND.errorBg, border: BRAND.error, icon: '⚠️' }
      : variant === 'success'
      ? { bg: BRAND.successBg, border: BRAND.success, icon: '✅' }
      : { bg: BRAND.warningBg, border: BRAND.warning, icon: '💡' };
  return `
    <div style="background:${styles.bg};border:2px solid ${styles.border};border-radius:12px;padding:18px 22px;margin:24px 0">
      <div style="display:flex;align-items:flex-start">
        <span style="font-size:20px;margin-right:12px;line-height:1">${styles.icon}</span>
        <div style="flex:1">${innerHtml}</div>
      </div>
    </div>
  `.trim();
}

function emailLabelValue(label, value) {
  return `
    <div style="margin:0 0 14px;padding:10px 0;border-bottom:1px solid ${BRAND.border}">
      <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:${BRAND.textMuted};font-weight:700">${esc(label)}</p>
      <p style="margin:0;font-size:15px;line-height:1.5;color:${BRAND.text};font-weight:500">${value}</p>
    </div>
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
