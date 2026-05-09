function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}

function buildMobileE164(countryDialDigits, nationalDigits) {
  const cc = digitsOnly(countryDialDigits);
  let nat = digitsOnly(nationalDigits);
  if (nat.startsWith('0')) nat = nat.slice(1);
  if (!cc || nat.length < 6 || nat.length > 14) return '';
  return `+${cc}${nat}`;
}

function formatMobileDisplay(e164) {
  if (!e164 || e164.length < 4) return e164;
  const d = digitsOnly(e164);
  const cc = d.slice(0, d.length > 9 ? 2 : 1);
  const rest = d.slice(cc.length);
  return `+${cc} ${rest.replace(/(\d{3})(?=\d)/g, '$1 ').trim()}`;
}

module.exports = { digitsOnly, buildMobileE164, formatMobileDisplay };
