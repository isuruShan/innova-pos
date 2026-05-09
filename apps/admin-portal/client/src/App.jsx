import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import Layout from './components/layout/Layout';

// Superadmin pages
import MerchantsPage from './pages/superadmin/MerchantsPage';
import ApplicationsPage from './pages/superadmin/ApplicationsPage';
import ApplicationDetailPage from './pages/superadmin/ApplicationDetailPage';
import PaymentsPage from './pages/superadmin/PaymentsPage';

// Merchant admin pages
import DashboardPage from './pages/admin/DashboardPage';
import BrandingPage from './pages/admin/BrandingPage';
import UsersPage from './pages/admin/UsersPage';
import SubscriptionPage from './pages/admin/SubscriptionPage';
import ProfilePage from './pages/admin/ProfilePage';

const PrivateRoute = ({ children, roles }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

const RootRedirect = () => {
  const { user, isSuperAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (isSuperAdmin) return <Navigate to="/merchants" replace />;
  return <Navigate to="/dashboard" replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RootRedirect />} />

          {/* Superadmin routes */}
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

          {/* Merchant admin routes */}
          <Route path="/dashboard" element={
            <PrivateRoute roles={['merchant_admin']}>
              <Layout><DashboardPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/branding" element={
            <PrivateRoute roles={['merchant_admin']}>
              <Layout><BrandingPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/users" element={
            <PrivateRoute roles={['merchant_admin']}>
              <Layout><UsersPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/subscription" element={
            <PrivateRoute roles={['merchant_admin']}>
              <Layout><SubscriptionPage /></Layout>
            </PrivateRoute>
          } />
          <Route path="/profile" element={
            <PrivateRoute roles={['merchant_admin', 'superadmin']}>
              <Layout><ProfilePage /></Layout>
            </PrivateRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
