import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useStoreContext } from '../context/StoreContext';
import { Utensils } from 'lucide-react';
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
  const { stores, selectedStoreId } = useStoreContext();
  const role = normalizePosRole(user?.role);
  const isRegister = pathname.startsWith('/register');
  const isCashierRole = role === 'cashier';

  const selectedStore = stores.find((s) => String(s._id) === String(selectedStoreId));
  const tableMgmt = selectedStore?.tableManagementEnabled === true;

  const navGroups = useMemo(() => {
    const base = isRegister ? [...REGISTER_NAV_GROUPS] : [...CASHIER_NAV_GROUPS];
    if (tableMgmt) {
      const tableItem = {
        title: 'Tables',
        items: [{
          to: isRegister ? '/register/tables' : '/cashier/tables',
          label: 'Tables',
          icon: Utensils
        }]
      };
      if (isRegister) {
        const mgmtIndex = base.findIndex(g => g.title === 'Management');
        if (mgmtIndex !== -1) {
          const next = [...base];
          next.splice(mgmtIndex, 0, tableItem);
          return next;
        }
        return [...base, tableItem];
      } else {
        return [...base, tableItem];
      }
    }
    return base;
  }, [isRegister, tableMgmt]);

  return useMemo(
    () => ({
      mode: isRegister ? 'register' : 'cashier',
      isRegister,
      isCashierRole,
      navGroups,
      /** Open drawer session before taking orders (cashiers + managers on register). */
      requireCashierSession: isCashierRole || isRegister,
      /** Order board lists only current session for cashiers; managers see all active orders. */
      orderBoardScopeSession: isCashierRole && !isRegister,
      ordersPath: isRegister ? '/register/orders' : '/cashier/orders',
      newOrderPath: isRegister ? '/register/order' : '/cashier/order',
      orderHistoryPath: isRegister ? '/register/order-history' : '/cashier/order-history',
    }),
    [isRegister, isCashierRole, navGroups],
  );
}
