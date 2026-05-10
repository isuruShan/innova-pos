import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', {
        email: email.trim().toLowerCase(),
      });
      setMessage(data.message || 'If an account exists, a reset email was sent.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to request reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--pos-page-bg)] px-4">
      <div className="w-full max-w-md bg-[var(--pos-panel)] rounded-2xl p-8 shadow-2xl border border-slate-700/50">
        <h1 className="text-2xl font-bold text-[var(--pos-text-primary)] tracking-tight">Forgot Password</h1>
        <p className="text-slate-400 mt-1 text-sm">Enter your email to receive a reset link.</p>

        <form onSubmit={handleSubmit} className="space-y-5 mt-6">
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

          {message && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl px-4 py-3 text-sm">
              {message}
            </div>
          )}
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
            {loading ? 'Sending link...' : 'Send reset link'}
          </button>
        </form>

        <Link to="/login" className="inline-block mt-5 text-xs text-amber-400 hover:text-amber-300 underline">
          Back to login
        </Link>
      </div>
    </div>
  );
}
