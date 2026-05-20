'use strict';

/** Brand-colored circular social icons as data URIs (email-safe img src). */
function svgDataUri(svg) {
  return `data:image/svg+xml,${encodeURIComponent(svg.trim())}`;
}

const CIRCLE = '#16213e';
const ICON = '#ffffff';

const ICONS = {
  facebook: svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="18" fill="${CIRCLE}"/>
      <path fill="${ICON}" d="M19.2 13.5h2.1V10h-2.1c-2.2 0-3.6 1.4-3.6 3.5V15h-2v2.8h2V26h3.2v-8.2h2.2l.4-2.8h-2.6v-1.5c0-.7.4-1.2 1.2-1.2z"/>
    </svg>
  `),
  instagram: svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="18" fill="${CIRCLE}"/>
      <rect x="11" y="11" width="14" height="14" rx="4" fill="none" stroke="${ICON}" stroke-width="1.8"/>
      <circle cx="18" cy="18" r="3.2" fill="none" stroke="${ICON}" stroke-width="1.8"/>
      <circle cx="22.8" cy="13.2" r="1.2" fill="${ICON}"/>
    </svg>
  `),
  linkedin: svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="18" fill="${CIRCLE}"/>
      <path fill="${ICON}" d="M13 14h2.8v12H13V14zm1.4-4.5a1.6 1.6 0 110 3.2 1.6 1.6 0 010-3.2zM16.8 14H19v1.6c.6-1 1.8-1.8 3.4-1.8 3.2 0 4 2.1 4 5.4V26h-2.8v-6.8c0-2-.7-3-2.4-3-1.3 0-2.1.9-2.4 2.1-.1.3-.1.7-.1 1.1V26H16.8V14z"/>
    </svg>
  `),
  twitter: svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="18" fill="${CIRCLE}"/>
      <path fill="${ICON}" d="M21.5 12h2.4l-5.2 6 6.1 8H19l-4.8-6.3-5.5 6.3h-2.4l5.6-6.4-5.9-7.6h5.1l4.3 5.7 5-5.7zm-2.1 13.2h1.3L14.8 13.6h-1.4l5.9 11.6z"/>
    </svg>
  `),
  youtube: svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="18" fill="${CIRCLE}"/>
      <path fill="${ICON}" d="M26.5 14.2c.2.8.2 2.5.2 2.5s0 1.7-.2 2.5c-.1.8-.6 1.3-1.3 1.4-1 .2-5.2.2-5.2.2s-4.2 0-5.2-.2c-.7-.1-1.2-.6-1.3-1.4-.2-.8-.2-2.5-.2-2.5s0-1.7.2-2.5c.1-.8.6-1.3 1.3-1.4 1-.2 5.2-.2 5.2-.2s4.2 0 5.2.2c.7.1 1.2.6 1.3 1.4zM16 21.5l4.5-2.5-4.5-2.5v5z"/>
    </svg>
  `),
  tiktok: svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="18" fill="${CIRCLE}"/>
      <path fill="${ICON}" d="M20.5 12h2.2c.2 1.4.9 2.6 2.2 3.2v2.4c-1.3 0-2.2-.4-2.2-.4v5.8c0 2.4-1.9 4.2-4.5 4.2s-4.5-1.8-4.5-4.2 1.9-4.2 4.2-4.2c.4 0 .8.1 1.1.2v2.3c-.2-.1-.5-.2-.8-.2-1.2 0-2.1 1-2.1 2.2s1 2.2 2.1 2.2 2.1-1 2.1-2.2V12z"/>
    </svg>
  `),
};

const SOCIAL_KEYS = ['facebook', 'instagram', 'linkedin', 'twitter', 'youtube', 'tiktok'];

module.exports = { ICONS, SOCIAL_KEYS };
