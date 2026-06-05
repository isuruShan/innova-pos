import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { BrandingProvider } from './context/BrandingContext';
import { StoreProvider } from './context/StoreContext';
import { CashierDraftOrdersProvider } from './context/CashierDraftOrdersContext';
import { AlertProvider } from './context/AlertContext';
import PosNotificationStream from './components/PosNotificationStream';
import ForcePasswordResetGate from './components/auth/ForcePasswordResetGate';

import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import NewOrder from './pages/cashier/NewOrder';
import DayEndReport from './pages/cashier/DayEndReport';
import CashierOrderHistory from './pages/cashier/CashierOrderHistory';
import OrderBoard from './pages/cashier/OrderBoard';
import CustomerTerminal from './pages/cashier/CustomerTerminal';
import KitchenDisplay from './pages/kitchen/KitchenDisplay';
import Dashboard from './pages/manager/Dashboard';
import MenuManagement from './pages/manager/MenuManagement';
import InventoryManagement from './pages/manager/InventoryManagement';
import PurchaseOrders from './pages/manager/PurchaseOrders';
import GoodsReceipts from './pages/manager/GoodsReceipts';
import SupplierManagement from './pages/manager/SupplierManagement';
import OrdersView from './pages/manager/OrdersView';
import Promotions from './pages/manager/Promotions';
import SettingsPage from './pages/manager/Settings';
import CashierSessionsPage from './pages/manager/CashierSessionsPage';
import CustomersPage from './pages/manager/CustomersPage';
import LoyaltyRewardsPage from './pages/manager/LoyaltyRewardsPage';
import ApprovalsPage from './pages/manager/ApprovalsPage';
import CafeTablesPage from './pages/manager/CafeTablesPage';
import NotificationsPage from './pages/manager/NotificationsPage';
import FloorPlanEditorPage from './pages/manager/FloorPlanEditorPage';
import FloorPlanViewPage from './pages/manager/FloorPlanViewPage';
import ReservationsPage from './pages/manager/ReservationsPage';
import WaitlistPage from './pages/manager/WaitlistPage';
import TableAnalyticsPage from './pages/manager/TableAnalyticsPage';
import ReportsPortal from './pages/manager/ReportsPortal';
import SubscriptionBlocked from './pages/SubscriptionBlocked';
import SubscriptionExpiredPage from './pages/SubscriptionExpiredPage';
import TablesView from './pages/cashier/TablesView';
import WastageManagement from './pages/manager/WastageManagement';
import StockReconciliation from './pages/manager/StockReconciliation';


import StockAudit from './pages/manager/StockAudit';
import WhatsAppProductsPage from './pages/manager/WhatsAppProductsPage';


const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
});

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

const RoleRoute = ({ children, roles }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.subscriptionActive === false) return <SubscriptionBlocked />;
  const r = normalizeRole(user.role);
  if (!roles.some((allowed) => normalizeRole(allowed) === r)) return <Navigate to="/login" replace />;
  return <ForcePasswordResetGate>{children}</ForcePasswordResetGate>;
};

const RootRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.subscriptionActive === false) return <SubscriptionBlocked />;
  const r = normalizeRole(user.role);
  if (r === 'cashier') return <Navigate to="/cashier/order" replace />;
  if (r === 'kitchen') return <Navigate to="/kitchen" replace />;
  if (r === 'manager' || r === 'merchant_admin') return <Navigate to="/manager/dashboard" replace />;
  return <Navigate to="/login" replace />;
};

export default function App() {
  // Prevent scroll from changing number input values
  useEffect(() => {
    const handleWheel = (e) => {
      if (e.target.type === 'number' && document.activeElement === e.target) {
        e.preventDefault();
      }
    };
    document.addEventListener('wheel', handleWheel, { passive: false });
    return () => document.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <BrandingProvider>
            <StoreProvider>
              <AlertProvider>
                <CashierDraftOrdersProvider>
              <PosNotificationStream />
              <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/subscription-expired" element={<SubscriptionExpiredPage />} />
                <Route path="/customer-terminal" element={
                  <RoleRoute roles={['cashier', 'manager', 'merchant_admin']}>
                    <CustomerTerminal />
                  </RoleRoute>
                } />
                <Route path="/" element={<RootRedirect />} />

                <Route path="/cashier/order" element={
                  <RoleRoute roles={['cashier']}>
                    <NewOrder />
                  </RoleRoute>
                } />
                <Route path="/cashier/orders" element={
                  <RoleRoute roles={['cashier']}>
                    <OrderBoard />
                  </RoleRoute>
                } />
                <Route path="/cashier/order-history" element={
                  <RoleRoute roles={['cashier']}>
                    <CashierOrderHistory />
                  </RoleRoute>
                } />
                <Route path="/cashier/report" element={
                  <RoleRoute roles={['cashier']}>
                    <DayEndReport />
                  </RoleRoute>
                } />
                <Route path="/cashier/tables" element={
                  <RoleRoute roles={['cashier']}>
                    <TablesView />
                  </RoleRoute>
                } />

                <Route path="/register/order" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <NewOrder />
                  </RoleRoute>
                } />
                <Route path="/register/orders" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <OrderBoard />
                  </RoleRoute>
                } />
                <Route path="/register/order-history" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <CashierOrderHistory />
                  </RoleRoute>
                } />
                <Route path="/register/tables" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <TablesView />
                  </RoleRoute>
                } />

                <Route path="/kitchen" element={
                  <RoleRoute roles={['kitchen', 'manager', 'merchant_admin']}>
                    <KitchenDisplay />
                  </RoleRoute>
                } />

                <Route path="/manager/dashboard" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <Dashboard />
                  </RoleRoute>
                } />
                <Route path="/manager/reports/:reportType" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <ReportsPortal />
                  </RoleRoute>
                } />
                <Route path="/manager/reports" element={<Navigate to="/manager/reports/menu-mix" replace />} />
                <Route path="/manager/menu" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <MenuManagement />
                  </RoleRoute>
                } />
                <Route path="/manager/whatsapp-catalog" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <WhatsAppProductsPage />
                  </RoleRoute>
                } />
                <Route path="/manager/cafe-tables" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <CafeTablesPage />
                  </RoleRoute>
                } />
                <Route path="/manager/floor-plan" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <FloorPlanViewPage />
                  </RoleRoute>
                } />
                <Route path="/manager/floor-plan/edit" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <FloorPlanEditorPage />
                  </RoleRoute>
                } />
                <Route path="/manager/reservations" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <ReservationsPage />
                  </RoleRoute>
                } />
                <Route path="/manager/waitlist" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <WaitlistPage />
                  </RoleRoute>
                } />
                <Route path="/manager/table-analytics" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <TableAnalyticsPage />
                  </RoleRoute>
                } />
                <Route path="/manager/inventory" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <InventoryManagement />
                  </RoleRoute>
                } />
                <Route path="/manager/purchase-orders" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <PurchaseOrders />
                  </RoleRoute>
                } />
                <Route path="/manager/goods-receipts" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <GoodsReceipts />
                  </RoleRoute>
                } />
                <Route path="/manager/suppliers" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <SupplierManagement />
                  </RoleRoute>
                } />
                <Route path="/manager/wastage" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <WastageManagement />
                  </RoleRoute>
                } />
                <Route path="/manager/reconciliation" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <StockReconciliation />
                  </RoleRoute>
                } />
                <Route path="/manager/stock-audit" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <StockAudit />
                  </RoleRoute>
                } />

                <Route path="/manager/orders" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <OrdersView />
                  </RoleRoute>
                } />
                <Route path="/manager/cashier-sessions" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <CashierSessionsPage />
                  </RoleRoute>
                } />
                <Route path="/manager/promotions" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <Promotions />
                  </RoleRoute>
                } />
                <Route path="/manager/customers" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <CustomersPage />
                  </RoleRoute>
                } />
                <Route path="/manager/loyalty/rewards" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <LoyaltyRewardsPage />
                  </RoleRoute>
                } />
                <Route path="/manager/approvals" element={
                  <RoleRoute roles={['merchant_admin']}>
                    <ApprovalsPage />
                  </RoleRoute>
                } />
                <Route path="/manager/notifications" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <NotificationsPage />
                  </RoleRoute>
                } />
                <Route path="/manager/users" element={<Navigate to="/manager/settings" replace />} />
                <Route path="/manager/settings" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <SettingsPage />
                  </RoleRoute>
                } />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
              </CashierDraftOrdersProvider>
            </AlertProvider>
          </StoreProvider>
        </BrandingProvider>
      </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
}
