import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BrandingProvider } from './context/BrandingContext';

import Login from './pages/Login';
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

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
});

const RoleRoute = ({ children, roles }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/login" replace />;
  return children;
};

const RootRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'cashier') return <Navigate to="/cashier/order" replace />;
  if (user.role === 'kitchen') return <Navigate to="/kitchen" replace />;
  if (user.role === 'manager') return <Navigate to="/manager/dashboard" replace />;
  if (user.role === 'merchant_admin') return <Navigate to="/manager/dashboard" replace />;
  return <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<RootRedirect />} />

            <Route path="/cashier/order" element={
              <RoleRoute roles={['cashier', 'manager']}>
                <NewOrder />
              </RoleRoute>
            } />
            <Route path="/cashier/orders" element={
              <RoleRoute roles={['cashier', 'manager']}>
                <OrderBoard />
              </RoleRoute>
            } />
            <Route path="/cashier/report" element={
              <RoleRoute roles={['cashier', 'manager']}>
                <DayEndReport />
              </RoleRoute>
            } />

            <Route path="/kitchen" element={
              <RoleRoute roles={['kitchen', 'manager']}>
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
            <Route path="/manager/promotions" element={
              <RoleRoute roles={['manager', 'merchant_admin']}>
                <Promotions />
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
      </AuthProvider>
    </QueryClientProvider>
  );
}

export { BrandingProvider };
