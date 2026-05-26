import { useEffect, useState } from 'react';
import { LogOut, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

export default function SubscriptionBlockedPopup() {
  const { logout } = useAuth();
  const [supportPhone, setSupportPhone] = useState('+94 77 123 4567');

  useEffect(() => {
    axios.get('/api/platform-contact/public')
      .then((res) => {
        if (res.data?.primaryPhone) {
          setSupportPhone(res.data.primaryPhone);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-2xl shadow-2xl p-6 text-center space-y-6">
        <div className="mx-auto w-12 h-12 rounded-full bg-red-950/50 border border-red-500/40 flex items-center justify-center text-red-500">
          <AlertTriangle size={24} />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white">Subscription Over</h2>
          <p className="text-slate-400 text-sm">
            Your organization's subscription has ended. Please contact your administrator or support to restore access.
          </p>
        </div>
        
        <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 text-left">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">Cafinity Support</span>
          <span className="text-sm font-semibold text-slate-300">{supportPhone}</span>
        </div>

        <button
          type="button"
          onClick={logout}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold shadow-lg shadow-red-600/10 transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  );
}
