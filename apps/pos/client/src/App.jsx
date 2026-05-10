import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BrandingProvider } from './context/BrandingContext';
import { StoreProvider } from './context/StoreContext';

import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import NewOrder from './pages/cashier/NewOrder';
import DayEndReport from './pages/cashier/DayEndReport';
import OrderBoard from './pages/cashier/OrderBoard';
import KitchenDisplay from './pages/kitchen/KitchenDisplay';
import Dashboard from './pages/manager/Dashboard';
import MenuManagement from './pages/manager/MenuManagement';
import InventoryManagement from './pages/manager/InventoryManagement';
import SupplierManagement from './pages/manager/SupplierManagement';
import OrdersView from './pages/manager/OrdersView';
import Promotions from './pages/manager/Promotions';
import SettingsPage from './pages/manager/Settings';
import CashierSessionsPage from './pages/manager/CashierSessionsPage';
import CustomersPage from './pages/manager/CustomersPage';
import LoyaltyRewardsPage from './pages/manager/LoyaltyRewardsPage';
import ApprovalsPage from './pages/manager/ApprovalsPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
});

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

const RoleRoute = ({ children, roles }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const r = normalizeRole(user.role);
  if (!roles.some((allowed) => normalizeRole(allowed) === r)) return <Navigate to="/login" replace />;
  return children;
};

const RootRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const r = normalizeRole(user.role);
  if (r === 'cashier') return <Navigate to="/cashier/order" replace />;
  if (r === 'kitchen') return <Navigate to="/kitchen" replace />;
  if (r === 'manager' || r === 'merchant_admin') return <Navigate to="/manager/dashboard" replace />;
  return <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrandingProvider>
          <StoreProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/" element={<RootRedirect />} />

                <Route path="/cashier/order" element={
                  <RoleRoute roles={['cashier', 'manager', 'merchant_admin']}>
                    <NewOrder />
                  </RoleRoute>
                } />
                <Route path="/cashier/orders" element={
                  <RoleRoute roles={['cashier', 'manager', 'merchant_admin']}>
                    <OrderBoard />
                  </RoleRoute>
                } />
                <Route path="/cashier/report" element={
                  <RoleRoute roles={['cashier', 'manager', 'merchant_admin']}>
                    <DayEndReport />
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
                <Route path="/manager/menu" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <MenuManagement />
                  </RoleRoute>
                } />
                <Route path="/manager/inventory" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <InventoryManagement />
                  </RoleRoute>
                } />
                <Route path="/manager/suppliers" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <SupplierManagement />
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
                <Route path="/manager/users" element={<Navigate to="/manager/settings" replace />} />
                <Route path="/manager/settings" element={
                  <RoleRoute roles={['manager', 'merchant_admin']}>
                    <SettingsPage />
                  </RoleRoute>
                } />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </StoreProvider>
        </BrandingProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
