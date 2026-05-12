import {
  LayoutDashboard, UtensilsCrossed, Package, Truck, ClipboardList, Tag, Wallet,
  Users, Gift, Inbox, Table, Bell,
} from 'lucide-react';

/** Grouped nav for the top bar (dropdowns). `roles` on an item = restrict to those roles. */
export const MANAGER_NAV_GROUPS = [
  {
    title: 'Overview',
    items: [
      { to: '/manager/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/manager/notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    title: 'Menu & stock',
    items: [
      { to: '/manager/menu', label: 'Menu', icon: UtensilsCrossed },
      { to: '/manager/cafe-tables', label: 'Café tables & QR', icon: Table },
      { to: '/manager/inventory', label: 'Inventory', icon: Package },
      { to: '/manager/suppliers', label: 'Suppliers', icon: Truck },
    ],
  },
  {
    title: 'Sales',
    items: [
      { to: '/manager/orders', label: 'Orders', icon: ClipboardList },
      { to: '/manager/cashier-sessions', label: 'Cash sessions', icon: Wallet },
    ],
  },
  {
    title: 'Customers & loyalty',
    items: [
      { to: '/manager/customers', label: 'Customers', icon: Users },
      { to: '/manager/loyalty/rewards', label: 'Loyalty rewards', icon: Gift },
      { to: '/manager/promotions', label: 'Promotions', icon: Tag },
    ],
  },
  {
    title: 'Admin',
    items: [
      { to: '/manager/approvals', label: 'Approvals', icon: Inbox, roles: ['merchant_admin'] },
    ],
  },
];

/** Flat list for legacy callers / quick iteration */
export const MANAGER_LINKS = MANAGER_NAV_GROUPS.flatMap((g) => g.items);
