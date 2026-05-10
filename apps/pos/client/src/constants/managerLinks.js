import {
  LayoutDashboard, UtensilsCrossed, Package, Truck, ClipboardList, Tag, Wallet,
  Users, Gift, Inbox,
} from 'lucide-react';

/** `roles` omitted = all manager-area roles (manager + merchant_admin) */
export const MANAGER_LINKS = [
  { to: '/manager/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/manager/menu', label: 'Menu', icon: UtensilsCrossed },
  { to: '/manager/inventory', label: 'Inventory', icon: Package },
  { to: '/manager/suppliers', label: 'Suppliers', icon: Truck },
  { to: '/manager/orders', label: 'Orders', icon: ClipboardList },
  { to: '/manager/cashier-sessions', label: 'Cash sessions', icon: Wallet },
  { to: '/manager/customers', label: 'Customers', icon: Users },
  { to: '/manager/loyalty/rewards', label: 'Loyalty rewards', icon: Gift },
  { to: '/manager/approvals', label: 'Approvals', icon: Inbox, roles: ['merchant_admin'] },
  { to: '/manager/promotions', label: 'Promotions', icon: Tag },
];
