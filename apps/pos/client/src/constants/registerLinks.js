import { ShoppingCart, ClipboardList, RotateCcw, LayoutDashboard } from 'lucide-react';

/** Manager / merchant_admin register (FOH) — separate from /manager back-office. */
export const REGISTER_NAV_GROUPS = [
  {
    title: 'New Order',
    items: [{ to: '/register/order', label: 'New Order', icon: ShoppingCart }],
  },
  {
    title: 'Order Board',
    items: [{ to: '/register/orders', label: 'Order Board', icon: ClipboardList }],
  },
  {
    title: 'Orders',
    items: [{ to: '/register/order-history', label: 'Orders', icon: RotateCcw }],
  },
  {
    title: 'Management',
    items: [{ to: '/manager/dashboard', label: 'Back to manager', icon: LayoutDashboard }],
  },
];
