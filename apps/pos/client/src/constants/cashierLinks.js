import { ShoppingCart, ClipboardList, FileText, RotateCcw } from 'lucide-react';

/** One item per group so navbar shows separate tabs (not a single dropdown). */
export const CASHIER_NAV_GROUPS = [
  {
    title: 'New Order',
    items: [{ to: '/cashier/order', label: 'New Order', icon: ShoppingCart }],
  },
  {
    title: 'Order Board',
    items: [{ to: '/cashier/orders', label: 'Order Board', icon: ClipboardList }],
  },
  {
    title: 'Orders',
    items: [{ to: '/cashier/order-history', label: 'Orders', icon: RotateCcw }],
  },
  {
    title: 'Day-End',
    items: [{ to: '/cashier/report', label: 'Day-End Report', icon: FileText }],
  },
];
