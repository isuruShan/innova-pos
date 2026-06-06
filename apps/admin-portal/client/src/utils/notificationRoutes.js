/** In-app path for a notification (merchant admin portal). */
export function notificationPathForAdmin(n, isSuperAdmin = false) {
  const type = n?.type;
  const meta = n?.meta || {};
  const resourceType = meta.resourceType || '';
  const resourceId = meta.resourceId || '';

  if (resourceType === 'promotion' && resourceId) {
    return `/promotions?edit=${encodeURIComponent(resourceId)}`;
  }
  if (resourceType === 'loyalty_reward' && resourceId) {
    return `/loyalty?tab=rewards&reward=${encodeURIComponent(resourceId)}`;
  }
  if (resourceType === 'customer' && resourceId) {
    return `/customers`;
  }

  if (type === 'promotion_pending') return '/promotions?focus=pending';
  if (type === 'promotion_approved' || type === 'promotion_rejected') {
    return resourceId ? `/promotions?edit=${encodeURIComponent(resourceId)}` : '/promotions';
  }
  if (type === 'reward_pending') return '/loyalty?tab=rewards&focus=pending';
  if (type === 'reward_approved' || type === 'reward_rejected') {
    return resourceId ? `/loyalty?tab=rewards&reward=${encodeURIComponent(resourceId)}` : '/loyalty?tab=rewards';
  }
  if (type === 'loyalty_points_adjusted') return '/customers';
  
  if (type === 'payment_receipt_submitted' || type === 'payment_receipt_verified' || type === 'subscription_payment_completed' || type === 'subscription_approved') {
    if (isSuperAdmin) {
      return meta.receiptId ? `/payments?highlight=${encodeURIComponent(meta.receiptId)}` : '/payments';
    } else {
      return '/subscription/payments';
    }
  }
  if (type === 'subscription_deactivated' || type === 'temporary_activation_requested' || type === 'subscription_due_soon') {
    if (isSuperAdmin) {
      return resourceId ? `/merchants/${resourceId}` : '/merchants';
    } else {
      return '/subscription/overview';
    }
  }
  if (type === 'merchant_application_submitted') {
    if (isSuperAdmin) {
      return resourceId ? `/applications/${resourceId}` : '/applications';
    } else {
      return '/subscription/overview';
    }
  }
  return '/notifications';
}
