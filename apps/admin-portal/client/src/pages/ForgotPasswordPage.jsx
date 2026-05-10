import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader } from 'lucide-react';
import api from '../api/axios';

export default function ForgotPasswordPage() {
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
    <div className="min-h-screen flex items-center justify-center px-4 bg-brand-brown-deep">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/cafinity-logo.png" alt="Cafinity" className="h-14 w-auto mx-auto mb-5 rounded-xl shadow-lg" />
          <h1 className="text-2xl font-bold text-white">Forgot password</h1>
          <p className="text-gray-400 text-sm mt-1">Enter your admin email — we will send a reset link if the account exists.</p>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="admin@yourbusiness.com"
                  className="w-full bg-white/10 border border-white/20 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-teal"
                />
              </div>
            </div>

            {message && (
              <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-lg p-3 text-sm text-emerald-200">
                {message}
              </div>
            )}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader size={15} className="animate-spin" /> Sending…
                </>
              ) : (
                'Send reset link'
              )}
            </button>
          </form>

          <Link to="/login" className="block text-center text-sm text-gray-400 hover:text-white mt-6 transition-colors">
            ← Back to sign in
          </Link>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          This portal is restricted to authorized administrators only.
        </p>
      </div>
    </div>
  );
}
