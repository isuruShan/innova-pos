'use strict';

const { tenantPlanAudience } = require('./planAudience');

function isLocalMerchant(countryIso) {
  return tenantPlanAudience(countryIso) === 'local';
}

/** International merchants may pay subscription/add-ons/stores via PayPal only. */
function filterPaymentOptionsForMerchant(options, countryIso) {
  if (isLocalMerchant(countryIso)) return { ...options, billingRegion: 'local' };
  return {
    billingRegion: 'international',
    internationalOnly: true,
    bankAccounts: [],
    stripe: {
      enabled: false,
      publishableKey: '',
      imageUrl: options?.stripe?.imageUrl || '',
    },
    paypal: options?.paypal || { enabled: false, clientId: '' },
  };
}

module.exports = { isLocalMerchant, filterPaymentOptionsForMerchant };
