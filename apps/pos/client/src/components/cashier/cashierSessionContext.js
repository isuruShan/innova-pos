import { createContext, useContext } from 'react';

export const CASHIER_SESSION_QUERY_KEY = 'cashier-session';

export const CashierSessionContext = createContext(null);

export function useCashierSession() {
  return useContext(CashierSessionContext);
}
