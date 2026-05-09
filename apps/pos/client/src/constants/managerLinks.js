import { LayoutDashboard, UtensilsCrossed, Package, Truck, ClipboardList, Tag } from 'lucide-react';

export const MANAGER_LINKS = [
  { to: '/manager/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/manager/menu',       label: 'Menu',        icon: UtensilsCrossed },
  { to: '/manager/inventory',  label: 'Inventory',   icon: Package },
  { to: '/manager/suppliers',  label: 'Suppliers',   icon: Truck },
  { to: '/manager/orders',     label: 'Orders',      icon: ClipboardList },
  { to: '/manager/promotions', label: 'Promotions',  icon: Tag },
];
