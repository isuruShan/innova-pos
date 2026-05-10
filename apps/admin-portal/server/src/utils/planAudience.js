/** Sri Lanka merchants → local subscription catalogue; all others → international. */
function tenantPlanAudience(countryIso) {
  return String(countryIso || '').toUpperCase() === 'LK' ? 'local' : 'international';
}

module.exports = { tenantPlanAudience };
