/** In-app path for a notification (POS manager / merchant_admin / cashier / kitchen). */
export function notificationPathForPos(n, userRole) {
  const role = String(userRole || '').trim().toLowerCase();
  const type = n?.type;
  const meta = n?.meta || {};
  const resourceType = meta.resourceType || '';
  const resourceId = meta.resourceId || '';

  if (resourceType === 'order' && resourceId) {
    if (role === 'kitchen') return `/kitchen?order=${encodeURIComponent(resourceId)}`;
    if (role === 'manager' || role === 'merchant_admin') {
      return `/register/orders?order=${encodeURIComponent(resourceId)}`;
    }
    return `/cashier/orders?order=${encodeURIComponent(resourceId)}`;
  }

  if (resourceType === 'promotion' && resourceId) {
    return `/manager/promotions?edit=${encodeURIComponent(resourceId)}`;
  }
  if (resourceType === 'loyalty_reward' && resourceId) {
    return `/manager/loyalty/rewards?reward=${encodeURIComponent(resourceId)}`;
  }

  if (type === 'promotion_pending' || type === 'reward_pending') {
    if (role === 'merchant_admin') return '/manager/approvals';
    return '/manager/notifications';
  }
  if (type === 'promotion_approved' || type === 'promotion_rejected') {
    return resourceId ? `/manager/promotions?edit=${encodeURIComponent(resourceId)}` : '/manager/promotions';
  }
  if (type === 'reward_approved' || type === 'reward_rejected') {
    return resourceId ? `/manager/loyalty/rewards?reward=${encodeURIComponent(resourceId)}` : '/manager/loyalty/rewards';
  }
  if (type === 'loyalty_retention_review' || type === 'loyalty_points_adjusted') {
    return '/manager/customers';
  }
  if (type === 'order_status_changed') {
    if (role === 'kitchen') return resourceId ? `/kitchen?order=${encodeURIComponent(resourceId)}` : '/kitchen';
    if (role === 'manager' || role === 'merchant_admin') {
      return resourceId ? `/register/orders?order=${encodeURIComponent(resourceId)}` : '/register/orders';
    }
    return resourceId ? `/cashier/orders?order=${encodeURIComponent(resourceId)}` : '/cashier/orders';
  }
  if (type === 'table_waiter_call' || type === 'qr_order_updated') {
    if (role === 'manager' || role === 'merchant_admin') {
      return resourceId ? `/register/orders?order=${encodeURIComponent(resourceId)}` : '/register/orders';
    }
    return resourceId ? `/cashier/orders?order=${encodeURIComponent(resourceId)}` : '/cashier/orders';
  }
  return '/manager/notifications';
}
