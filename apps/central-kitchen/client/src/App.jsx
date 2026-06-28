import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StoreProvider } from './context/StoreContext';
import { TenantCurrencyProvider } from '../../../admin-portal/client/src/context/TenantCurrencyContext';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import VarianceAnalyticsPage from './pages/VarianceAnalyticsPage';
import Layout from './components/layout/Layout';

// Shared Page components from admin-portal
// Note: Vite aliases in vite.config.js redirect all */StoreContext, */AuthContext, */api/axios
// imports inside these components to the CK's own implementations automatically.
import InventoryManagement from '../../../admin-portal/client/src/pages/admin/InventoryManagement';
import SupplierManagement from '../../../admin-portal/client/src/pages/admin/SupplierManagement';
import PurchaseOrders from '../../../admin-portal/client/src/pages/admin/PurchaseOrders';
import GoodsReceipts from '../../../admin-portal/client/src/pages/admin/GoodsReceipts';

const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
};

const RootRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to="/dashboard" replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StoreProvider>
          <TenantCurrencyProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route
                path="/dashboard"
                element={
                  <PrivateRoute>
                    <DashboardPage />
                  </PrivateRoute>
                }
              />

              {/* Inventory Management Tabs */}
              <Route path="/inventory" element={<Navigate to="/inventory/stock" replace />} />
              <Route
                path="/inventory/:tab"
                element={
                  <PrivateRoute>
                    <InventoryManagement embedded={true} />
                  </PrivateRoute>
                }
              />

              {/* Transfers shortcuts → Inventory transfers tab */}
              <Route path="/transfers" element={<Navigate to="/inventory/transfers" replace />} />
              <Route path="/transfers/:tab" element={<Navigate to="/inventory/transfers" replace />} />

              {/* Procurement */}
              <Route
                path="/suppliers"
                element={
                  <PrivateRoute>
                    <SupplierManagement embedded={true} />
                  </PrivateRoute>
                }
              />
              <Route
                path="/purchase-orders"
                element={
                  <PrivateRoute>
                    <PurchaseOrders embedded={true} />
                  </PrivateRoute>
                }
              />
              {/* GRN: component navigates internally to /goods-receipts/:tab */}
              <Route path="/goods-receipts" element={<Navigate to="/goods-receipts/receipts" replace />} />
              <Route
                path="/goods-receipts/:tab"
                element={
                  <PrivateRoute>
                    <GoodsReceipts embedded={true} />
                  </PrivateRoute>
                }
              />

              {/* Auditing & Analytics */}
              <Route
                path="/variance-analytics"
                element={
                  <PrivateRoute>
                    <VarianceAnalyticsPage />
                  </PrivateRoute>
                }
              />

              {/* Catch-all */}
              <Route path="/" element={<RootRedirect />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </TenantCurrencyProvider>
        </StoreProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
