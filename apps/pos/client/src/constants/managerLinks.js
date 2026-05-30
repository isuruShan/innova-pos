import {
  LayoutDashboard, UtensilsCrossed, Package, Truck, ClipboardList, Tag, Wallet,
  Users, Gift, Inbox, Table, Bell, ShoppingCart, Grid3X3, CalendarDays, UserPlus, BarChart3,
  FileText, FileCheck,
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
    title: 'Reporting',
    items: [
      { to: '/manager/reports/menu-mix', label: 'Menu Mix', icon: ClipboardList },
      { to: '/manager/reports/order-distribution', label: 'Order Distribution', icon: BarChart3 },
      { to: '/manager/reports/hourly-sales', label: 'Hourly Trends', icon: BarChart3 },
      { to: '/manager/reports/payment-reconciliation', label: 'Payment Reconciliation', icon: Wallet },
      { to: '/manager/reports/refunds', label: 'Returns & Refunds', icon: ClipboardList },
      { to: '/manager/reports/cash-sessions', label: 'Drawer Cash Sessions', icon: Wallet },
    ],
  },
  {
    title: 'Menu & stock',
    items: [
      { to: '/manager/menu', label: 'Menu', icon: UtensilsCrossed },
      { to: '/manager/inventory', label: 'Inventory', icon: Package },
      { to: '/manager/purchase-orders', label: 'Purchase Orders', icon: FileText },
      { to: '/manager/goods-receipts', label: 'Goods Receipts', icon: FileCheck },
      { to: '/manager/suppliers', label: 'Suppliers', icon: Truck },
    ],
  },
  {
    title: 'Table Management',
    addon: 'tableManagement',
    items: [
      { to: '/manager/floor-plan', label: 'Floor plan', icon: Grid3X3 },
      { to: '/manager/reservations', label: 'Reservations', icon: CalendarDays },
      { to: '/manager/waitlist', label: 'Waitlist', icon: UserPlus },
      { to: '/manager/table-analytics', label: 'Table analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'Sales',
    items: [
      { to: '/manager/orders', label: 'Orders', icon: ClipboardList },
    ],
  },
  {
    title: 'Customers & loyalty',
    items: [
      { to: '/manager/customers', label: 'Customers', icon: Users },
      { to: '/manager/loyalty/rewards', label: 'Loyalty rewards', icon: Gift, addon: 'loyalty' },
      { to: '/manager/promotions', label: 'Promotions', icon: Tag },
    ],
  },
  {
    title: 'Admin',
    items: [
      { to: '/manager/approvals', label: 'Approvals', icon: Inbox, roles: ['merchant_admin'] },
    ],
  },
  {
    title: 'POS',
    items: [
      { to: '/register/order', label: 'New Order', icon: ShoppingCart },
      { to: '/register/orders', label: 'Order Board', icon: ClipboardList },
    ],
  },
];

/** Flat list for legacy callers / quick iteration */
export const MANAGER_LINKS = MANAGER_NAV_GROUPS.flatMap((g) => g.items);
