import { ShoppingCart, ClipboardList, FileText } from 'lucide-react';

/** Single group keeps the top bar compact (one dropdown for all cashier routes). */
export const CASHIER_NAV_GROUPS = [
  {
    title: 'POS',
    items: [
      { to: '/cashier/order', label: 'New Order', icon: ShoppingCart },
      { to: '/cashier/orders', label: 'Order Board', icon: ClipboardList },
      { to: '/cashier/report', label: 'Day-End Report', icon: FileText },
    ],
  },
];
