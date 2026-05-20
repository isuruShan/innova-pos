'use strict';

/** @typedef {{ id: string, name: string, base: string }} PresetDef */

/** @type {PresetDef[]} */
const PRESET_DEFS = [
  { id: 'default', name: 'Default / Base', base: '#0B1220' },
  { id: 'espresso', name: 'Espresso', base: '#C17C54' },
  { id: 'matcha', name: 'Matcha', base: '#8FBF81' },
  { id: 'rose-latte', name: 'Rose Latte', base: '#D98FA3' },
  { id: 'caramel', name: 'Caramel', base: '#D8A47F' },
  { id: 'mocha-gold', name: 'Mocha Gold', base: '#D4A657' },
  { id: 'midnight', name: 'Midnight', base: '#6366F1' },
  { id: 'ocean-brew', name: 'Ocean Brew', base: '#06B6D4' },
  { id: 'olive', name: 'Olive', base: '#A3B18A' },
  { id: 'ivory-sage', name: 'Ivory Sage', base: '#B7C4A8' },
  { id: 'dusty-pink', name: 'Dusty Pink', base: '#C98C9E' },
  { id: 'champagne', name: 'Champagne', base: '#E0C097' },
];

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
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

function blend(hexA, hexB, weightB) {
  const a = parseHex(hexA);
  const b = parseHex(hexB);
  const w = Math.max(0, Math.min(1, weightB));
  return toHex([
    a[0] * (1 - w) + b[0] * w,
    a[1] * (1 - w) + b[1] * w,
    a[2] * (1 - w) + b[2] * w,
  ]);
}

function relativeLuminance(hex) {
  const [r, g, b] = parseHex(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function textOn(bg) {
  return relativeLuminance(bg) > 0.42 ? '#0F172A' : '#F8FAFC';
}

/**
 * Build full POS palette from a theme base swatch.
 * @param {string} presetId
 * @param {string} name
 * @param {string} baseColor
 */
function buildThemeFromBase(presetId, name, baseColor) {
  const base = baseColor.toUpperCase();
  const bodyColor = blend('#0B1220', base, presetId === 'default' ? 0 : 0.14);
  const headerBarColor = blend(bodyColor, base, 0.22);
  const buttonColor = base;
  const hoverColor = blend(buttonColor, '#FFFFFF', 0.18);
  const selectionHighlightColor = blend(bodyColor, buttonColor, 0.38);

  return {
    themePresetId: presetId,
    themePresetName: name,
    themeBaseColor: base,
    bodyColor,
    headerBarColor,
    buttonColor,
    selectionHighlightColor,
    hoverColor,
    buttonTextColor: textOn(buttonColor),
    headerBarTextColor: textOn(headerBarColor),
    bodyTextColor: '#E2E8F0',
    selectionTextColor: textOn(selectionHighlightColor),
    primaryColor: bodyColor,
    accentColor: buttonColor,
    sidebarColor: headerBarColor,
    textColor: '#E2E8F0',
  };
}

const PRESETS = Object.fromEntries(
  PRESET_DEFS.map((d) => [d.id, buildThemeFromBase(d.id, d.name, d.base)]),
);

function getPreset(id) {
  return PRESETS[id] || PRESETS.default;
}

function listPresets() {
  return PRESET_DEFS.map((d) => ({
    id: d.id,
    name: d.name,
    base: d.base,
    ...PRESETS[d.id],
  }));
}

module.exports = {
  PRESET_DEFS,
  PRESETS,
  buildThemeFromBase,
  getPreset,
  listPresets,
};
