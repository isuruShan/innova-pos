import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CASHIER_NAV_GROUPS } from '../constants/cashierLinks';
import { REGISTER_NAV_GROUPS } from '../constants/registerLinks';

export function normalizePosRole(role) {
  return String(role || '').trim().toLowerCase();
}

/**
 * Front-of-house mode from URL: /cashier/* (cashiers, session-scoped board) vs
 * /register/* (manager / merchant_admin, session required, all store orders on board).
 */
export function useFohrMode() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const role = normalizePosRole(user?.role);
  const isRegister = pathname.startsWith('/register');
  const isCashierRole = role === 'cashier';

  return useMemo(
    () => ({
      mode: isRegister ? 'register' : 'cashier',
      isRegister,
      isCashierRole,
      navGroups: isRegister ? REGISTER_NAV_GROUPS : CASHIER_NAV_GROUPS,
      /** Open drawer session before taking orders (cashiers + managers on register). */
      requireCashierSession: isCashierRole || isRegister,
      /** Order board lists only current session for cashiers; managers see all active orders. */
      orderBoardScopeSession: isCashierRole && !isRegister,
      ordersPath: isRegister ? '/register/orders' : '/cashier/orders',
      newOrderPath: isRegister ? '/register/order' : '/cashier/order',
      orderHistoryPath: isRegister ? '/register/order-history' : '/cashier/order-history',
    }),
    [isRegister, isCashierRole],
  );
}
