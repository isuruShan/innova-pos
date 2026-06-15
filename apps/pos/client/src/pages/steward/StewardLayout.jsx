import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogOut, Home, ClipboardList, Calendar } from 'lucide-react';
import PosNotificationStream from '../../components/PosNotificationStream';
import PushPermissionBanner from '../../components/PushPermissionBanner';
import WaiterCallBar from '../../components/WaiterCallBar';

export default function StewardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }) =>
    `flex flex-col items-center justify-center flex-1 py-3 text-sm font-medium ${
      isActive ? 'text-amber-600 border-t-2 border-amber-600' : 'text-gray-500 hover:text-gray-800'
    }`;

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center font-bold">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 leading-tight">{user?.name}</h1>
            <p className="text-xs text-gray-500">Steward</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
          aria-label="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Waiter Calls */}
      <WaiterCallBar />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-gray-50 relative">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-gray-200 flex justify-around shrink-0 pb-safe">
        <NavLink to="/steward/tables" className={navLinkClass}>
          <Home className="w-6 h-6 mb-1" />
          <span>Tables</span>
        </NavLink>
        <NavLink to="/steward/orders" className={navLinkClass}>
          <ClipboardList className="w-6 h-6 mb-1" />
          <span>Orders</span>
        </NavLink>
        <NavLink to="/steward/reservations" className={navLinkClass}>
          <Calendar className="w-6 h-6 mb-1" />
          <span>Bookings</span>
        </NavLink>
      </nav>
    </div>
  );
}
