'use strict';

let geoip;
try {
  // eslint-disable-next-line global-require
  geoip = require('geoip-lite');
} catch {
  geoip = null;
}

const HEADER_COUNTRY_KEYS = [
  'cf-ipcountry',
  'cloudfront-viewer-country',
  'x-vercel-ip-country',
  'x-country-code',
  'x-appengine-country',
];

function normalizeCountryCode(raw) {
  if (raw == null) return null;
  const cc = String(raw).trim().toUpperCase();
  if (cc.length !== 2 || cc === 'XX' || cc === 'T1') return null;
  return cc;
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  const ip = req.ip || req.socket?.remoteAddress || '';
  return String(ip).replace(/^::ffff:/, '');
}

function countryCodeFromRequest(req) {
  for (const key of HEADER_COUNTRY_KEYS) {
    const cc = normalizeCountryCode(req.headers[key]);
    if (cc) return cc;
  }

  if (!geoip) return null;
  const ip = clientIp(req);
  if (!ip || ip === '127.0.0.1' || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) {
    return null;
  }
  const hit = geoip.lookup(ip);
  return hit?.country ? normalizeCountryCode(hit.country) : null;
}

function audienceFromCountryCode(countryCode) {
  if (!countryCode) return null;
  return countryCode === 'LK' ? 'local' : 'international';
}

/**
 * Resolve pricing catalogue: Sri Lanka → local, elsewhere → international.
 * Explicit ?audience= wins; else geo from proxy headers / IP lookup.
 */
function planAudienceFromRequest(req, queryAudience) {
  const q = String(queryAudience || '').toLowerCase();
  if (q === 'local' || q === 'international') return { audience: q, countryCode: countryCodeFromRequest(req) };

  const cc = countryCodeFromRequest(req);
  const fromGeo = audienceFromCountryCode(cc);
  if (fromGeo) return { audience: fromGeo, countryCode: cc };

  return { audience: 'international', countryCode: null };
}

module.exports = {
  planAudienceFromRequest,
  countryCodeFromRequest,
  clientIp,
};
