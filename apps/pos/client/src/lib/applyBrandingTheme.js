/**
 * Apply tenant theme preset tokens to document CSS variables (dark + light chrome).
 * @param {Record<string, string>} branding
 * @param {'light'|'dark'} themeMode
 */
export function applyBrandingThemeToDocument(branding, themeMode) {
  const root = document.documentElement;

  if (themeMode === 'light') {
    const bodyBg = '#ffffff';
    const panelBg = '#f8fafc';
    const surfaceInset = '#f1f5f9';
    const bodyText = '#0f172a';
    const headerBg = '#ffffff';
    const buttonBg = branding.buttonColor || branding.accentColor || '#c2410c';
    const hoverBg = branding.hoverColor || buttonBg;
    const selectionBg = branding.selectionHighlightColor || buttonBg;
    const bodyTextSecondary = '#475569';
    const bodyTextMuted = '#64748b';
    const selectionText = '#ffffff';
    const headerText = '#0f172a';
    const buttonText = '#ffffff';

    root.style.setProperty('--pos-page-bg', bodyBg);
    root.style.setProperty('--pos-panel', panelBg);
    root.style.setProperty('--pos-surface-inset', surfaceInset);
    root.style.setProperty('--pos-text-primary', bodyText);
    root.style.setProperty('--pos-text-secondary', bodyTextSecondary);
    root.style.setProperty('--pos-text-muted', bodyTextMuted);
    root.style.setProperty('--pos-selection-text', selectionText);
    root.style.setProperty('--color-header-text', headerText);
    root.style.setProperty('--color-button-text', buttonText);
    root.style.setProperty('--color-hover', hoverBg);
    root.style.setProperty('--color-selection', selectionBg);

    root.style.setProperty('--color-primary', bodyBg);
    root.style.setProperty('--color-accent', buttonBg);
    root.style.setProperty('--color-sidebar', headerBg);
    root.style.setProperty('--color-text', bodyText);

    // Scrollbars
    root.style.setProperty('--pos-scrollbar-track', '#e2e8f0');
    root.style.setProperty('--pos-scrollbar-thumb', '#cbd5e1');
    root.style.setProperty('--pos-scrollbar-thumb-hover', '#94a3b8');

    // Tailwind CSS v4 dynamic theme variable overrides for light mode compatibility
    root.style.setProperty('--color-slate-50', '#020617');
    root.style.setProperty('--color-slate-100', '#0f172a');
    root.style.setProperty('--color-slate-200', '#1e293b');
    root.style.setProperty('--color-slate-300', '#334155');
    root.style.setProperty('--color-slate-400', '#475569');
    root.style.setProperty('--color-slate-500', '#64748b');
    root.style.setProperty('--color-slate-600', '#94a3b8');
    root.style.setProperty('--color-slate-700', '#cbd5e1');
    root.style.setProperty('--color-slate-800', '#e2e8f0');
    root.style.setProperty('--color-slate-900', '#f1f5f9');
    root.style.setProperty('--color-slate-950', '#f8fafc');
  } else {
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

    root.style.setProperty('--color-primary', bodyBg);
    root.style.setProperty('--color-accent', buttonBg);
    root.style.setProperty('--color-sidebar', headerBg);
    root.style.setProperty('--color-text', bodyText);

    // Scrollbars
    root.style.setProperty('--pos-scrollbar-track', '#1e293b');
    root.style.setProperty('--pos-scrollbar-thumb', '#475569');
    root.style.setProperty('--pos-scrollbar-thumb-hover', '#64748b');

    // Remove Tailwind slate overrides when in dark mode to restore default tailwind styling
    root.style.removeProperty('--color-slate-50');
    root.style.removeProperty('--color-slate-100');
    root.style.removeProperty('--color-slate-200');
    root.style.removeProperty('--color-slate-300');
    root.style.removeProperty('--color-slate-400');
    root.style.removeProperty('--color-slate-500');
    root.style.removeProperty('--color-slate-600');
    root.style.removeProperty('--color-slate-700');
    root.style.removeProperty('--color-slate-800');
    root.style.removeProperty('--color-slate-900');
    root.style.removeProperty('--color-slate-950');
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
