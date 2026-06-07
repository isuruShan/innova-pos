import { useEffect, useState } from 'react';
import { LogOut, AlertOctagon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function SubscriptionBlocked() {
  const { logout } = useAuth();
  const [supportPhone, setSupportPhone] = useState('+94 77 123 4567'); // fallback

  useEffect(() => {
    api.get('/platform-contact/public')
      .then((res) => {
        if (res.data?.primaryPhone) {
          setSupportPhone(res.data.primaryPhone);
        }
      })
      .catch(() => {
        // fallback remains
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
      <div className="max-w-md w-full bg-slate-900 rounded-3xl border border-red-500/20 shadow-2xl p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-950/50 border border-red-500/30 flex items-center justify-center text-red-500 animate-pulse">
          <AlertOctagon size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight text-white">Subscription Over</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Your subscription has ended. Please contact your administrator or support for assistance.
          </p>
        </div>
        
        <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 text-left">
          <span className="text-xs text-slate-500 block uppercase tracking-wider font-bold mb-1">Cafinity Support</span>
          <a href={`tel:${supportPhone}`} className="text-red-400 font-semibold hover:text-red-300 transition-colors">
            {supportPhone}
          </a>
        </div>

        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-lg shadow-red-600/20 transition-all active:scale-[0.98]"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  );
}
