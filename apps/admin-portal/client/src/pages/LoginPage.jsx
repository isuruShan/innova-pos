import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
export default function LoginPage() {
  const { login, logout, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const u = await login(form.email.trim().toLowerCase(), form.password.trim());
      if (u.isTemporaryPassword) {
        navigate('/profile?changePassword=1', { replace: true });
      } else {
        navigate(u.role === 'superadmin' ? '/merchants' : '/dashboard', { replace: true });
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid credentials';
      setError(msg);
      setToast({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const continueAsCurrentUser = () => {
    if (!user) return;
    if (user.isTemporaryPassword) {
      navigate('/profile?changePassword=1', { replace: true });
      return;
    }
    navigate(user.role === 'superadmin' ? '/merchants' : '/dashboard', { replace: true });
  };

  const switchAccount = () => {
    logout();
    setForm({ email: '', password: '' });
    setError('');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-brand-brown-deep">
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div className="rounded-lg border border-red-500/40 bg-red-900/90 px-4 py-3 text-sm text-red-100 shadow-lg backdrop-blur">
            {toast.message}
          </div>
        </div>
      )}
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/cafinity-logo.png" alt="Cafinity" className="h-14 w-auto mx-auto mb-5 rounded-xl shadow-lg" />
          <h1 className="text-2xl font-bold text-white">Cafinity Admin</h1>
          <p className="text-gray-400 text-sm mt-1">Sign in to manage merchants, plans, and approvals</p>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8">
          {user && (
            <div className="mb-5 rounded-lg border border-brand-teal/40 bg-brand-teal/10 p-3">
              <p className="text-sm text-teal-100">
                You are already signed in as <span className="font-semibold">{user.email}</span>.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={continueAsCurrentUser}
                  className="flex-1 rounded-lg bg-brand-teal px-3 py-2 text-sm font-semibold text-white hover:bg-brand-teal-deep"
                >
                  Continue
                </button>
                <button
                  type="button"
                  onClick={switchAccount}
                  className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-gray-200 hover:bg-white/5"
                >
                  Switch account
                </button>
              </div>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  placeholder="admin@yourbusiness.com"
                  className="w-full bg-white/10 border border-white/20 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-teal"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  placeholder="••••••••"
                  className="w-full bg-white/10 border border-white/20 rounded-lg pl-9 pr-10 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-teal"
                />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-orange text-white text-sm font-semibold transition-all hover:bg-brand-orange-hover disabled:opacity-60"
            >
              {loading ? <><Loader size={15} className="animate-spin" /> Signing in...</> : 'Sign in'}
            </button>
            <Link
              to="/forgot-password"
              className="block text-center text-sm text-gray-400 hover:text-white underline underline-offset-2 transition-colors"
            >
              Forgot password?
            </Link>
          </form>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          This portal is restricted to authorized administrators only.
        </p>
      </div>
    </div>
  );
}
