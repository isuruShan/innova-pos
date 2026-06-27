import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getPosUrl } from '@innovapos/app-urls';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StoreProvider } from './context/StoreContext';
import { TenantCurrencyProvider } from './context/TenantCurrencyContext';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SubscriptionExpiredPage from './pages/SubscriptionExpiredPage';
import Layout from './components/layout/Layout';
import ForcePasswordResetGate from './components/auth/ForcePasswordResetGate';
import PushPermissionBanner from './components/PushPermissionBanner';


// Superadmin pages
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard';
import MerchantsPage from './pages/superadmin/MerchantsPage';
import ApplicationsPage from './pages/superadmin/ApplicationsPage';
import ApplicationDetailPage from './pages/superadmin/ApplicationDetailPage';
import PaymentsPage from './pages/superadmin/PaymentsPage';
import PlansPage from './pages/superadmin/PlansPage';
import MerchantWorkspacePage from './pages/superadmin/MerchantWorkspacePage';
import MerchantStoresPage from './pages/superadmin/MerchantStoresPage';
import PaymentProviderSettingsPage from './pages/superadmin/PaymentProviderSettingsPage';
import PaidAddonsPage from './pages/superadmin/PaidAddonsPage';
import PlatformUberSettings from './pages/superadmin/PlatformUberSettings';
import SuspendedActivitiesPage from './pages/superadmin/SuspendedActivitiesPage';
import ScheduledBannersPage from './pages/superadmin/ScheduledBannersPage';
import MigrationsPage from './pages/superadmin/MigrationsPage';
import MerchantSubscriptionGate from './components/MerchantSubscriptionGate';
import TrialMerchantsPage from './pages/superadmin/TrialMerchantsPage';
import ProspectsPage from './pages/superadmin/ProspectsPage';

// Merchant admin pages
import UberConfigPanel from './pages/admin/UberConfigPanel';
import DashboardPage from './pages/admin/DashboardPage';
import AnalyticsPage from './pages/admin/AnalyticsPage';
import OrdersPage from './pages/admin/OrdersPage';
import BrandingPage from './pages/admin/BrandingPage';
import UsersPage from './pages/admin/UsersPage';
import SubscriptionPage from './pages/admin/SubscriptionPage';
import MerchantAddonsPage from './pages/admin/MerchantAddonsPage';
import ProfilePage from './pages/admin/ProfilePage';
import StoresPage from './pages/admin/StoresPage';
import CashierSessionsPage from './pages/admin/CashierSessionsPage';
import LoyaltyProgramPage from './pages/admin/LoyaltyProgramPage';
import AccountingPage from './pages/admin/AccountingPage';
import CustomersAdminPage from './pages/admin/CustomersAdminPage';
import PromotionsAdminPage from './pages/admin/PromotionsAdminPage';
import NotificationsPage from './pages/admin/NotificationsPage';
import FoodmarketPartnersPage from './pages/admin/FoodmarketPartnersPage';
import FoodmarketCommissionsPage from './pages/admin/FoodmarketCommissionsPage';
import SessionReviewPage from './pages/admin/SessionReviewPage';
import ReportsPortal from './pages/admin/ReportsPortal';
import WhatsAppConfigPage from './pages/admin/WhatsAppConfigPage';

// Migrated management pages
import MenuManagement from './pages/admin/MenuManagement';
import InventoryManagement from './pages/admin/InventoryManagement';
import SupplierManagement from './pages/admin/SupplierManagement';
import PurchaseOrders from './pages/admin/PurchaseOrders';
import GoodsReceipts from './pages/admin/GoodsReceipts';
import WastageManagement from './pages/admin/WastageManagement';
import ReservationsPage from './pages/admin/ReservationsPage';
import FloorPlanEditorPage from './pages/admin/FloorPlanEditorPage';
import FloorPlanViewPage from './pages/admin/FloorPlanViewPage';
import TableAnalyticsPage from './pages/admin/TableAnalyticsPage';

const PrivateRoute = ({ children, roles }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return (
    <ForcePasswordResetGate>
      <MerchantSubscriptionGate>{children}</MerchantSubscriptionGate>
    </ForcePasswordResetGate>
  );
};

const RootRedirect = () => {
  const { user, isSuperAdmin, logout } = useAuth();
  
  const r = String(user?.role || '').trim().toLowerCase();
  
  useEffect(() => {
    if (user && ['cashier', 'steward', 'kitchen'].includes(r)) {
      logout();
      window.location.href = getPosUrl();
    }
  }, [user, r, logout]);

  if (!user) return <Navigate to="/login" replace />;
  if (isSuperAdmin) return <Navigate to="/superadmin/dashboard" replace />;
  
  if (r === 'merchant_admin') return <Navigate to="/dashboard" replace />;
  if (r === 'manager') return <Navigate to="/accounting" replace />;
  if (r === 'purchasing_officer') return <Navigate to="/purchase-orders" replace />;
  if (r === 'inventory_clerk' || r === 'commissary_operator') return <Navigate to="/inventory" replace />;
  
  if (['cashier', 'steward', 'kitchen'].includes(r)) {
    return (
      <div className="min-h-screen bg-brand-brown-deep flex items-center justify-center text-white">
        Redirecting to POS client...
      </div>
    );
  }
  
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
    <BrowserRouter>
      <AuthProvider>
        <StoreProvider>
          <TenantCurrencyProvider>
          <PushPermissionBanner />
          <Routes>

          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/subscription-expired" element={<SubscriptionExpiredPage />} />
          <Route path="/" element={<RootRedirect />} />

          {/* Superadmin routes */}
          <Route path="/superadmin/dashboard" element={
            <PrivateRoute roles={['superadmin']}>
              <Layout><SuperAdminDashboard /></Layout>
            </PrivateRoute>
          } />
          <Route path="/merchants" element={
            <PrivateRoute roles={['superadmin']}>
              <Layout><MerchantsPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/applications" element={
            <PrivateRoute roles={['superadmin']}>
              <Layout><ApplicationsPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/applications/:id" element={
            <PrivateRoute roles={['superadmin']}>
              <Layout><ApplicationDetailPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/payments" element={
            <PrivateRoute roles={['superadmin']}>
              <Layout><PaymentsPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/prospects" element={
            <PrivateRoute roles={['superadmin']}>
              <Layout><ProspectsPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/plans" element={
            <PrivateRoute roles={['superadmin']}>
              <Layout><PlansPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/payment-setup" element={
            <PrivateRoute roles={['superadmin']}>
              <Layout><PaymentProviderSettingsPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/paid-addons" element={
            <PrivateRoute roles={['superadmin']}>
              <Layout><PaidAddonsPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/uber-setup" element={
            <PrivateRoute roles={['superadmin']}>
              <Layout><PlatformUberSettings /></Layout>
            </PrivateRoute>
          } />
          <Route path="/merchants/:id/stores" element={
            <PrivateRoute roles={['superadmin']}>
              <Layout><MerchantStoresPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/merchants/:id" element={
            <PrivateRoute roles={['superadmin']}>
              <Layout><MerchantWorkspacePage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/superadmin/suspended-activities" element={
            <PrivateRoute roles={['superadmin']}>
              <Layout><SuspendedActivitiesPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/superadmin/banners" element={
            <PrivateRoute roles={['superadmin']}>
              <Layout><ScheduledBannersPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/superadmin/migrations" element={
            <PrivateRoute roles={['superadmin']}>
              <Layout><MigrationsPage /></Layout>
            </PrivateRoute>
          } />

          <Route path="/superadmin/trial-merchants" element={
            <PrivateRoute roles={['superadmin']}>
              <Layout><TrialMerchantsPage /></Layout>
            </PrivateRoute>
          } />

          {/* Merchant admin routes */}
          <Route path="/dashboard" element={
            <PrivateRoute roles={['merchant_admin']}>
              <Layout><DashboardPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/analytics" element={
            <PrivateRoute roles={['merchant_admin']}>
              <Layout><AnalyticsPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/orders" element={
            <PrivateRoute roles={['merchant_admin']}>
              <Layout><OrdersPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/reports/:reportType" element={
            <PrivateRoute roles={['merchant_admin', 'manager']}>
              <Layout><ReportsPortal /></Layout>
            </PrivateRoute>
          } />
          <Route path="/reports" element={<Navigate to="/reports/menu-mix" replace />} />
          <Route path="/branding" element={
            <PrivateRoute roles={['merchant_admin']}>
              <Layout><BrandingPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/users/*" element={
            <PrivateRoute roles={['merchant_admin']}>
              <Layout><UsersPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/subscription/*" element={
            <PrivateRoute roles={['merchant_admin']}>
              <Layout><SubscriptionPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/addons" element={
            <PrivateRoute roles={['merchant_admin', 'manager']}>
              <Layout><MerchantAddonsPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/uber-config" element={
            <PrivateRoute roles={['merchant_admin']}>
              <Layout><UberConfigPanel /></Layout>
            </PrivateRoute>
          } />
          <Route path="/stores/*" element={
            <PrivateRoute roles={['merchant_admin']}>
              <Layout><StoresPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/cashier-sessions" element={
            <PrivateRoute roles={['merchant_admin']}>
              <Layout><CashierSessionsPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/loyalty/*" element={
            <PrivateRoute roles={['merchant_admin', 'manager']}>
              <Layout><LoyaltyProgramPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/accounting/*" element={
            <PrivateRoute roles={['merchant_admin', 'manager']}>
              <Layout><AccountingPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/customers" element={
            <PrivateRoute roles={['merchant_admin']}>
              <Layout><CustomersAdminPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/menu/*" element={
            <PrivateRoute roles={['merchant_admin', 'manager']}>
              <Layout><MenuManagement /></Layout>
            </PrivateRoute>
          } />
          <Route path="/inventory/*" element={
            <PrivateRoute roles={['merchant_admin', 'manager', 'inventory_clerk', 'commissary_operator']}>
              <Layout><InventoryManagement /></Layout>
            </PrivateRoute>
          } />
          <Route path="/suppliers" element={
            <PrivateRoute roles={['merchant_admin', 'manager', 'purchasing_officer']}>
              <Layout><SupplierManagement /></Layout>
            </PrivateRoute>
          } />
          <Route path="/purchase-orders" element={
            <PrivateRoute roles={['merchant_admin', 'manager', 'purchasing_officer']}>
              <Layout><PurchaseOrders /></Layout>
            </PrivateRoute>
          } />
          <Route path="/goods-receipts/*" element={
            <PrivateRoute roles={['merchant_admin', 'manager', 'purchasing_officer']}>
              <Layout><GoodsReceipts /></Layout>
            </PrivateRoute>
          } />
          <Route path="/wastage" element={<Navigate to="/inventory/wastage" replace />} />
          <Route path="/reservations" element={
            <PrivateRoute roles={['merchant_admin', 'manager']}>
              <Layout><ReservationsPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/floor-plan/editor" element={
            <PrivateRoute roles={['merchant_admin', 'manager']}>
              <Layout><FloorPlanEditorPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/floor-plan" element={
            <PrivateRoute roles={['merchant_admin', 'manager']}>
              <Layout><FloorPlanViewPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/table-analytics" element={
            <PrivateRoute roles={['merchant_admin', 'manager']}>
              <Layout><TableAnalyticsPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/promotions" element={
            <PrivateRoute roles={['merchant_admin', 'manager']}>
              <Layout><PromotionsAdminPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/foodmarket-partners" element={
            <PrivateRoute roles={['merchant_admin']}>
              <Layout><FoodmarketPartnersPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/foodmarket-commissions" element={
            <PrivateRoute roles={['merchant_admin']}>
              <Layout><FoodmarketCommissionsPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/notifications" element={
            <PrivateRoute roles={['merchant_admin', 'superadmin', 'manager']}>
              <Layout><NotificationsPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/inventory-sessions" element={
            <PrivateRoute roles={['merchant_admin', 'manager']}>
              <Layout><SessionReviewPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/whatsapp-config" element={
            <PrivateRoute roles={['merchant_admin']}>
              <Layout><WhatsAppConfigPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/profile" element={
            <PrivateRoute roles={['merchant_admin', 'superadmin', 'manager']}>
              <Layout><ProfilePage /></Layout>
            </PrivateRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </TenantCurrencyProvider>
        </StoreProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
