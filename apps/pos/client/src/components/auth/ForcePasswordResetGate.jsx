import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { Eye, EyeOff, Lock, ShieldAlert } from 'lucide-react';

/**
 * Gate component that forces users with temporary passwords to reset them
 * before accessing the POS application.
 */
export default function ForcePasswordResetGate({ children }) {
  const { user, updateUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If user doesn't have a temporary password, render children normally
  if (!user?.isTemporaryPassword) {
    return children;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!currentPassword) {
      setError('Please enter your current temporary password');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (currentPassword === newPassword) {
      setError('New password must be different from your temporary password');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.put('/auth/me', { currentPassword, newPassword });
      // Update user state and token
      updateUser(data.user, data.token);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--pos-page-bg,#0f172a)] p-4">
      <div className="bg-[var(--pos-panel,#1e293b)] rounded-2xl shadow-xl p-8 max-w-md w-full border border-slate-700">
        <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-amber-500/10 border border-amber-500/20 mx-auto mb-6">
          <ShieldAlert className="text-amber-400" size={28} />
        </div>
        
        <h1 className="text-xl font-bold text-[var(--pos-text-primary,#f1f5f9)] text-center mb-2">
          Set Your New Password
        </h1>
        <p className="text-sm text-slate-400 text-center mb-6">
          You're using a temporary password. For security, please create your own password to continue.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Current (Temporary) Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-[var(--pos-surface-inset,#0f172a)] border border-slate-600 rounded-xl pl-10 pr-10 py-2.5 text-sm text-[var(--pos-text-primary,#f1f5f9)] focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 placeholder-slate-500"
                placeholder="Enter the password from your welcome email"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
              >
                {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-[var(--pos-surface-inset,#0f172a)] border border-slate-600 rounded-xl pl-10 pr-10 py-2.5 text-sm text-[var(--pos-text-primary,#f1f5f9)] focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 placeholder-slate-500"
                placeholder="Create a strong password (min 8 characters)"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
              >
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">Must be at least 8 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[var(--pos-surface-inset,#0f172a)] border border-slate-600 rounded-xl pl-10 pr-10 py-2.5 text-sm text-[var(--pos-text-primary,#f1f5f9)] focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 placeholder-slate-500"
                placeholder="Re-enter your new password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
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
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2 shadow-lg shadow-amber-500/20"
          >
            {loading ? 'Updating Password...' : 'Set Password & Continue'}
          </button>
        </form>

        <p className="text-xs text-slate-500 text-center mt-6">
          You won't be asked to do this again after setting your new password.
        </p>
      </div>
    </div>
  );
}
