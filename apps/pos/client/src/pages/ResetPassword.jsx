import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) return setMsg('Password must be at least 8 characters');
    if (newPassword !== confirm) return setMsg('Passwords do not match');
    setLoading(true);
    setMsg('');
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setMsg('Password reset successful. Redirecting...');
      setTimeout(() => navigate('/login', { replace: true }), 1200);
    } catch (err) {
      setMsg(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--pos-page-bg)] px-4">
      <div className="w-full max-w-md bg-[var(--pos-panel)] rounded-2xl p-6 border border-slate-700/50">
        <h1 className="text-xl font-bold text-[var(--pos-text-primary)]">Reset POS Password</h1>
        <p className="text-xs text-slate-400 mt-1">Set a new password for your account.</p>
        <form onSubmit={submit} className="space-y-3 mt-5">
          <label className="block text-sm text-slate-300">New password</label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            className="w-full bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 text-sm" />
          <label className="block text-sm text-slate-300">Confirm password</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            className="w-full bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 text-sm" />
          <button className="w-full py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold" disabled={loading}>
            {loading ? 'Resetting...' : 'Reset password'}
          </button>
          {msg && <p className="text-xs text-emerald-300">{msg}</p>}
          <Link to="/login" className="block text-xs text-slate-300 underline">Back to login</Link>
        </form>
      </div>
    </div>
  );
}
