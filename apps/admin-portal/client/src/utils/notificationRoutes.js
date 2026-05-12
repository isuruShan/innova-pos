/** In-app path for a notification (merchant admin portal). */
export function notificationPathForAdmin(n) {
  const type = n?.type;
  const resourceId = n?.meta?.resourceId || '';
  if (type === 'promotion_pending') return '/promotions?focus=pending';
  if (type === 'promotion_approved' || type === 'promotion_rejected') return '/promotions';
  if (type === 'reward_pending' || type === 'reward_approved' || type === 'reward_rejected') {
    return '/loyalty?tab=rewards';
  }
  if (type === 'loyalty_retention_review') return '/loyalty';
  if (type === 'loyalty_points_adjusted') return '/customers';
  if (type === 'payment_receipt_submitted' || type === 'payment_receipt_verified') return '/payments';
  if (type === 'subscription_deactivated' || type === 'temporary_activation_requested') {
    return resourceId ? `/merchants/${resourceId}` : '/merchants';
  }
  if (type === 'subscription_due_soon') {
    return resourceId ? `/merchants/${resourceId}` : '/merchants';
  }
  return '/notifications';
}
