'use strict';

/** POS-only notification types — hidden in admin-portal UI, still visible in POS. */
const POS_ONLY_NOTIFICATION_TYPES = [
  'order_status_changed',
  'table_waiter_call',
  'qr_order_updated',
];

function isPosOnlyNotificationType(type) {
  return POS_ONLY_NOTIFICATION_TYPES.includes(String(type || ''));
}

function excludePosNotificationsFilter(extra = {}) {
  return {
    ...extra,
    type: { $nin: POS_ONLY_NOTIFICATION_TYPES },
  };
}

module.exports = {
  POS_ONLY_NOTIFICATION_TYPES,
  isPosOnlyNotificationType,
  excludePosNotificationsFilter,
};
