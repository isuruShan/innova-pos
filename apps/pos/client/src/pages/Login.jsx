import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

export default function Login() {
  const { login, logout, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const r = String(user.role || '').trim().toLowerCase();
    if (r === 'cashier') navigate('/cashier/order', { replace: true });
    else if (r === 'kitchen') navigate('/kitchen', { replace: true });
    else if (r === 'manager' || r === 'merchant_admin') navigate('/manager/dashboard', { replace: true });
    else logout();
  }, [user, navigate, logout]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const u = await login(email.trim().toLowerCase(), password.trim());
      const r = String(u.role || '').trim().toLowerCase();
      if (r === 'cashier') navigate('/cashier/order');
      else if (r === 'kitchen') navigate('/kitchen');
      else if (r === 'manager' || r === 'merchant_admin') navigate('/manager/dashboard');
      else logout();
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[var(--pos-page-bg)] px-4">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle className="border-slate-600/40 bg-[var(--pos-panel)]/80" />
      </div>
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-5">
          <img src="/logo-1.png" alt="Cafinity" className="h-14 w-auto rounded-xl shadow-lg" />
        </div>
        <div className="bg-[var(--pos-panel)] rounded-2xl p-8 shadow-2xl border border-slate-700/50">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-[var(--pos-text-primary)] tracking-tight">Cafinity POS</h1>
            <p className="text-slate-400 mt-1 text-sm">Cafe point of sale — sign in to open your shift</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-slate-500 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-slate-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-amber-500/20 text-sm tracking-wide"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <Link to="/forgot-password" className="block text-xs text-amber-400 hover:text-amber-300 underline">
              Forgot password?
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
}
