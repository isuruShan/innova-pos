import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';

export default function ResetPasswordPage() {
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
      setMsg('Password reset successful. Redirecting to login...');
      setTimeout(() => navigate('/login', { replace: true }), 1200);
    } catch (err) {
      setMsg(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-brown-deep px-4">
      <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-6">
        <h1 className="text-xl font-bold text-white">Reset Password</h1>
        <p className="text-xs text-gray-400 mt-1">Set a new password for your admin account.</p>
        <form onSubmit={submit} className="space-y-3 mt-5">
          <label className="block text-sm text-gray-300">New password</label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white" />
          <label className="block text-sm text-gray-300">Confirm password</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white" />
          <button className="w-full mt-2 py-2.5 rounded-lg bg-brand-orange text-white text-sm font-semibold" disabled={loading}>
            {loading ? 'Resetting...' : 'Reset password'}
          </button>
          {msg && <p className="text-xs text-teal-200">{msg}</p>}
          <Link to="/login" className="block text-xs text-gray-300 underline mt-1">Back to login</Link>
        </form>
      </div>
    </div>
  );
}
