/**
 * Apply tenant theme preset tokens to document CSS variables (dark + light chrome).
 * @param {Record<string, string>} branding
 * @param {'light'|'dark'} themeMode
 */
export function applyBrandingThemeToDocument(branding, themeMode) {
  const root = document.documentElement;
  const bodyBg = branding.bodyColor || branding.primaryColor || '#0b1220';
  const headerBg = branding.headerBarColor || branding.sidebarColor || '#151f2e';
  const buttonBg = branding.buttonColor || branding.accentColor || '#e94560';
  const hoverBg = branding.hoverColor || buttonBg;
  const selectionBg = branding.selectionHighlightColor || buttonBg;
  const bodyText = branding.bodyTextColor || branding.textColor || '#e2e8f0';
  const headerText = branding.headerBarTextColor || bodyText;
  const buttonText = branding.buttonTextColor || '#f8fafc';
  const selectionText = branding.selectionTextColor || buttonText;

  root.style.setProperty('--pos-page-bg', bodyBg);
  root.style.setProperty('--pos-panel', branding.panelColor || blendPanel(bodyBg));
  root.style.setProperty('--pos-surface-inset', branding.surfaceInsetColor || darken(bodyBg, 0.04));
  root.style.setProperty('--pos-text-primary', bodyText);
  root.style.setProperty('--pos-text-secondary', mixHex(bodyText, '#94a3b8', 0.35));
  root.style.setProperty('--pos-text-muted', mixHex(bodyText, '#64748b', 0.5));
  root.style.setProperty('--pos-selection-text', selectionText);
  root.style.setProperty('--color-header-text', headerText);
  root.style.setProperty('--color-button-text', buttonText);
  root.style.setProperty('--color-hover', hoverBg);
  root.style.setProperty('--color-selection', selectionBg);

  if (themeMode === 'dark') {
    root.style.setProperty('--color-primary', bodyBg);
    root.style.setProperty('--color-accent', buttonBg);
    root.style.setProperty('--color-sidebar', headerBg);
    root.style.setProperty('--color-text', bodyText);
  } else {
    root.style.setProperty('--color-primary', '#1e293b');
    root.style.setProperty('--color-accent', '#c2410c');
    root.style.setProperty('--color-sidebar', '#ffffff');
    root.style.setProperty('--color-text', '#0f172a');
  }
}

function parseHex(hex) {
  const h = String(hex || '').replace('#', '').trim();
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  if (h.length !== 6) return [11, 18, 32];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex([r, g, b]) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mixHex(a, b, w) {
  const c1 = parseHex(a);
  const c2 = parseHex(b);
  return toHex([
    c1[0] * (1 - w) + c2[0] * w,
    c1[1] * (1 - w) + c2[1] * w,
    c1[2] * (1 - w) + c2[2] * w,
  ]);
}

function darken(hex, amount) {
  const c = parseHex(hex);
  return toHex(c.map((v) => v * (1 - amount)));
}

function blendPanel(body) {
  return mixHex(body, '#ffffff', 0.06);
}
