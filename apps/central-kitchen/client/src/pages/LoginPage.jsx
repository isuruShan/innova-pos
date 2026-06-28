import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, logout, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email.trim().toLowerCase(), form.password.trim());
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err.message || err.response?.data?.message || 'Invalid credentials';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const continueAsCurrentUser = () => {
    if (user) {
      navigate('/', { replace: true });
    }
  };

  const switchAccount = () => {
    logout();
    setForm({ email: '', password: '' });
    setError('');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo-2.png" alt="Cafinity" className="h-14 w-auto mx-auto mb-5 rounded-xl shadow-lg animate-pulse" />
          <h1 className="text-2xl font-bold text-white tracking-tight">Central Kitchen</h1>
          <p className="text-slate-400 text-sm mt-1">Commissary & Warehouse Logistics Portal</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-2xl p-8 shadow-2xl">
          {user && (
            <div className="mb-5 rounded-lg border border-teal-500/40 bg-teal-950/20 p-3">
              <p className="text-sm text-teal-200">
                You are already signed in as <span className="font-semibold">{user.email}</span>.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={continueAsCurrentUser}
                  className="flex-1 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition"
                >
                  Continue
                </button>
                <button
                  type="button"
                  onClick={switchAccount}
                  className="flex-1 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-gray-300 hover:bg-slate-800 transition"
                >
                  Switch account
                </button>
              </div>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  placeholder="name@company.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-10 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-teal-600 text-white text-sm font-semibold transition-all hover:bg-teal-700 disabled:opacity-60"
            >
              {loading ? <><Loader size={15} className="animate-spin" /> Signing in...</> : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Access is restricted to Central Kitchen & Procurement roles only.
        </p>
      </div>
    </div>
  );
}
