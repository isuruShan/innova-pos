/** In-app path for a notification (POS manager / merchant_admin). */
export function notificationPathForPos(n, userRole) {
  const role = String(userRole || '').trim().toLowerCase();
  const type = n?.type;
  if (type === 'promotion_pending' || type === 'reward_pending') {
    if (role === 'merchant_admin') return '/manager/approvals';
    return '/manager/notifications';
  }
  if (type === 'promotion_approved' || type === 'promotion_rejected') return '/manager/promotions';
  if (type === 'reward_approved' || type === 'reward_rejected') return '/manager/loyalty/rewards';
  if (type === 'loyalty_retention_review') return '/manager/customers';
  if (type === 'loyalty_points_adjusted') return '/manager/customers';
  return '/manager/notifications';
}
