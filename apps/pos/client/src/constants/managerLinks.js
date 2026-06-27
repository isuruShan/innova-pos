import {
  LayoutDashboard, UtensilsCrossed, Package, Truck, ClipboardList, Tag, Wallet,
  Users, Gift, Inbox, Table, Bell, ShoppingCart, Grid3X3, CalendarDays, UserPlus, BarChart3,
  FileText, FileCheck, Phone,
} from 'lucide-react';

/** Grouped nav for the top bar (dropdowns). `roles` on an item = restrict to those roles. */
export const MANAGER_NAV_GROUPS = [
  {
    title: 'Overview',
    items: [
      { to: '/manager/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['merchant_admin', 'manager'] },
      { to: '/manager/notifications', label: 'Notifications', icon: Bell, roles: ['merchant_admin', 'manager'] },
    ],
  },
  {
    title: 'Reporting',
    items: [
      { to: '/manager/reports/menu-mix', label: 'Menu Mix', icon: ClipboardList, roles: ['merchant_admin', 'manager'] },
      { to: '/manager/reports/cogs', label: 'COGS & Margins', icon: ClipboardList, roles: ['merchant_admin', 'manager'] },
      { to: '/manager/reports/wastage', label: 'Inventory Wastage', icon: ClipboardList, roles: ['merchant_admin', 'manager', 'inventory_clerk', 'commissary_operator'] },
      { to: '/manager/reports/loyalty', label: 'Loyalty Report', icon: Gift, addon: 'loyalty', roles: ['merchant_admin', 'manager'] },
      { to: '/manager/reports/order-distribution', label: 'Order Distribution', icon: BarChart3, roles: ['merchant_admin', 'manager'] },
      { to: '/manager/reports/hourly-sales', label: 'Hourly Trends', icon: BarChart3, roles: ['merchant_admin', 'manager'] },
      { to: '/manager/reports/refunds', label: 'Returns & Refunds', icon: ClipboardList, roles: ['merchant_admin', 'manager'] },
      { to: '/manager/reports/cash-sessions', label: 'Drawer Cash Sessions', icon: Wallet, roles: ['merchant_admin', 'manager'] },
    ],
  },
  {
    title: 'Menu & stock',
    items: [
      { to: '/manager/menu', label: 'Menu', icon: UtensilsCrossed, roles: ['merchant_admin', 'manager'] },
      { to: '/manager/whatsapp-catalog', label: 'WhatsApp Catalog', icon: Phone, addon: 'whatsapp', roles: ['merchant_admin', 'manager'] },
      { to: '/manager/inventory', label: 'Inventory', icon: Package, roles: ['merchant_admin', 'manager', 'inventory_clerk', 'commissary_operator'] },
      { to: '/manager/purchase-orders', label: 'Purchase Orders', icon: FileText, roles: ['merchant_admin', 'manager', 'purchasing_officer'] },
      { to: '/manager/goods-receipts', label: 'Goods Receipts', icon: FileCheck, roles: ['merchant_admin', 'manager', 'purchasing_officer'] },
      { to: '/manager/suppliers', label: 'Suppliers', icon: Truck, roles: ['merchant_admin', 'manager', 'purchasing_officer'] },
      { to: '/manager/wastage', label: 'Wastage', icon: ClipboardList, roles: ['merchant_admin', 'manager', 'inventory_clerk', 'commissary_operator'] },
    ],
  },
  {
    title: 'Table Management',
    addon: 'tableManagement',
    items: [
      { to: '/manager/floor-plan', label: 'Floor plan', icon: Grid3X3, roles: ['merchant_admin', 'manager'] },
      { to: '/manager/reservations', label: 'Reservations', icon: CalendarDays, roles: ['merchant_admin', 'manager'] },
      { to: '/manager/waitlist', label: 'Waitlist', icon: UserPlus, roles: ['merchant_admin', 'manager'] },
      { to: '/manager/table-analytics', label: 'Table analytics', icon: BarChart3, roles: ['merchant_admin', 'manager'] },
    ],
  },
  {
    title: 'Sales',
    items: [
      { to: '/manager/orders', label: 'Orders', icon: ClipboardList, roles: ['merchant_admin', 'manager'] },
    ],
  },
  {
    title: 'Customers & loyalty',
    items: [
      { to: '/manager/customers', label: 'Customers', icon: Users, roles: ['merchant_admin', 'manager'] },
      { to: '/manager/loyalty/rewards', label: 'Loyalty rewards', icon: Gift, addon: 'loyalty', roles: ['merchant_admin', 'manager'] },
      { to: '/manager/promotions', label: 'Promotions', icon: Tag, roles: ['merchant_admin', 'manager'] },
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
      { to: '/register/order', label: 'New Order', icon: ShoppingCart, roles: ['merchant_admin', 'manager', 'cashier', 'steward', 'kitchen'] },
      { to: '/register/orders', label: 'Order Board', icon: ClipboardList, roles: ['merchant_admin', 'manager', 'cashier', 'steward', 'kitchen'] },
      { to: '/register/tables', label: 'Table View', icon: Table, addon: 'tableManagement', roles: ['merchant_admin', 'manager', 'cashier', 'steward', 'kitchen'] },
    ],
  },
];

/** Flat list for legacy callers / quick iteration */
export const MANAGER_LINKS = MANAGER_NAV_GROUPS.flatMap((g) => g.items);
