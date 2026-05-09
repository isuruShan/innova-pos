import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    if (user.role === 'cashier') navigate('/cashier/order', { replace: true });
    else if (user.role === 'kitchen') navigate('/kitchen', { replace: true });
    else if (user.role === 'manager') navigate('/manager/dashboard', { replace: true });
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const u = await login(email, password);
      if (u.role === 'cashier') navigate('/cashier/order');
      else if (u.role === 'kitchen') navigate('/kitchen');
      else navigate('/manager/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] px-4">
      <div className="w-full max-w-md">
        {/* Logo area */}
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="Burger Joint"
            className="w-28 h-28 rounded-full object-cover mx-auto mb-4 shadow-2xl shadow-black/50 ring-4 ring-amber-500/30"
          />
          <h1 className="text-3xl font-bold text-white tracking-tight">Burger Joint</h1>
          <p className="text-slate-400 mt-1 text-sm">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-[#1e293b] rounded-2xl p-8 shadow-2xl border border-slate-700/50">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full bg-[#0f172a] border border-slate-600 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-slate-500 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-[#0f172a] border border-slate-600 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-slate-500 transition"
              />
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
          </form>

          {/* Demo credentials hint */}
          <div className="mt-6 pt-5 border-t border-slate-700/50">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-3">Demo credentials</p>
            <div className="space-y-2">
              {[
                { role: 'Manager', email: 'manager@pos.com', color: 'text-purple-400' },
                { role: 'Cashier', email: 'cashier@pos.com', color: 'text-amber-400' },
                { role: 'Kitchen', email: 'kitchen@pos.com', color: 'text-green-400' },
              ].map((c) => (
                <button
                  key={c.role}
                  type="button"
                  onClick={() => { setEmail(c.email); setPassword(`${c.role.toLowerCase()}123`); }}
                  className="w-full flex items-center justify-between bg-[#0f172a] hover:bg-slate-800 rounded-lg px-3 py-2 transition cursor-pointer"
                >
                  <span className={`text-xs font-semibold ${c.color}`}>{c.role}</span>
                  <span className="text-xs text-slate-500">{c.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
