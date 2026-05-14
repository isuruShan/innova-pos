const path = require('path');

/** Resolve POS server modules (shared Mongo models + order helpers). */
const posSrc = path.join(__dirname, '../../../pos/server/src');

module.exports = {
  posSrc,
  models: {
    CafeTable: path.join(posSrc, 'models/CafeTable.js'),
    Store: path.join(posSrc, 'models/Store.js'),
    MenuItem: path.join(posSrc, 'models/MenuItem.js'),
    Order: path.join(posSrc, 'models/Order.js'),
    TenantSettings: path.join(posSrc, 'models/TenantSettings.js'),
  },
  orderHelpers: path.join(posSrc, 'utils/orderHelpers.js'),
  notificationHelpers: path.join(posSrc, 'lib/notificationHelpers.js'),
  menuItemImageUrls: path.join(posSrc, 'utils/menuItemImageUrls.js'),
};
