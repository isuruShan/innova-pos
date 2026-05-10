/**
 * WCAG-style helpers to pick readable foreground hex for arbitrary backgrounds.
 * Used when highlights use translucent / mixed colors so a fixed “selection text”
 * color cannot stay readable on both dark solids and light tints.
 */

function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return { r: 255, g: 255, b: 255 };
  let h = hex.trim().replace('#', '');
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  if (h.length !== 6) return { r: 255, g: 255, b: 255 };
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return { r: 255, g: 255, b: 255 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function srgbChannelToLinear(c) {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance [0, 1] */
export function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const R = srgbChannelToLinear(r);
  const G = srgbChannelToLinear(g);
  const B = srgbChannelToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** Linear blend: result is `t` of `a` plus `(1-t)` of `b` (t in [0,1]). */
export function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const clamp = (x) => Math.max(0, Math.min(255, Math.round(x)));
  const mix = (x, y) => clamp(x * t + y * (1 - t));
  const r = mix(A.r, B.r);
  const g = mix(A.g, B.g);
  const bl = mix(A.b, B.b);
  return `#${[r, g, bl].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Near-black on light backgrounds, near-white on dark backgrounds.
 */
export function contrastForegroundForBackground(bgHex) {
  const L = relativeLuminance(bgHex);
  return L > 0.45 ? '#0f172a' : '#f8fafc';
}

/**
 * Navbar active pill ≈ color-mix(accent 22%, transparent) over the nav bar surface.
 * Pass the accent + sidebar hex **as rendered** for the current theme (see BrandingContext).
 */
export function navActiveLinkTextColor(accentHex, sidebarHex, mixRatio = 0.22) {
  const accent = accentHex || '#e94560';
  const surface = sidebarHex || '#ffffff';
  const blended = mixHex(accent, surface, mixRatio);
  return contrastForegroundForBackground(blended);
}

/** Row highlight like bg-amber-500/15 over a surface (approx 15% tint color). */
export function tintedRowTextColor(tintHex, surfaceHex, tintAmount = 0.15) {
  const tint = tintHex || '#f59e0b';
  const surface = surfaceHex || '#ffffff';
  const blended = mixHex(tint, surface, tintAmount);
  return contrastForegroundForBackground(blended);
}
