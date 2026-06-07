import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { Eye, EyeOff, Lock, KeyRound, ShieldAlert } from 'lucide-react';

export default function ForcePinSetupGate({ children }) {
  const { user, updateUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Checks if user role is manager or admin, and doesn't have an approval pin configured.
  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'merchant_admin';
  const needsPinSetup = isManagerOrAdmin && !user?.hasApprovalPin;

  // If user is not manager/admin, or already has approval pin set, bypass gate.
  if (!needsPinSetup) {
    return children;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!currentPassword) {
      setError('Please enter your account password to verify your identity');
      return;
    }

    const pinStr = pin.trim();
    if (!/^\d{4,8}$/.test(pinStr)) {
      setError('Passcode must be between 4 and 8 digits');
      return;
    }

    if (pinStr !== confirmPin.trim()) {
      setError('Passcodes do not match');
      return;
    }

    setLoading(true);
    try {
      await api.put('/users/me/approval-pin', {
        currentPassword: currentPassword.trim(),
        pin: pinStr,
      });

      // Update user state locally to skip the gate
      updateUser({ ...user, hasApprovalPin: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update passcode. Please check your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--pos-page-bg,#0b1220)] p-4">
      <div className="bg-[var(--pos-panel,#151f2e)] rounded-2xl shadow-2xl p-8 max-w-md w-full border border-slate-700/60 transition-all duration-300">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 mx-auto mb-6">
          <KeyRound className="text-amber-400" size={28} />
        </div>
        
        <h1 className="text-xl font-bold text-[var(--pos-text-primary,#e2e8f0)] text-center mb-2">
          Set Return Approval Passcode
        </h1>
        <p className="text-sm text-slate-400 text-center mb-6 leading-relaxed">
          As a {user?.role === 'merchant_admin' ? 'Merchant Admin' : 'Manager'}, you are required to set a secure 4–8 digit PIN. This passcode will be used to authorize customer returns and perform other high-privilege operations on the register.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Confirm Account Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-[var(--pos-surface-inset,#0b1220)] border border-slate-700/80 rounded-xl pl-10 pr-10 py-3 text-sm text-[var(--pos-text-primary,#e2e8f0)] focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 placeholder-slate-600 transition"
                placeholder="Enter your login password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 p-1"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <hr className="border-slate-800 my-2" />

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              New Approval Passcode (4–8 digits)
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              className="w-full bg-[var(--pos-surface-inset,#0b1220)] border border-slate-700/80 rounded-xl px-4 py-3 text-center text-lg font-mono tracking-widest text-[var(--pos-text-primary,#e2e8f0)] focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 placeholder-slate-600 transition"
              placeholder="••••"
              required
              maxLength={8}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Confirm Approval Passcode
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              className="w-full bg-[var(--pos-surface-inset,#0b1220)] border border-slate-700/80 rounded-xl px-4 py-3 text-center text-lg font-mono tracking-widest text-[var(--pos-text-primary,#e2e8f0)] focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 placeholder-slate-600 transition"
              placeholder="••••"
              required
              maxLength={8}
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm flex items-start gap-2.5">
              <ShieldAlert className="text-red-400 flex-shrink-0 mt-0.5" size={16} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-amber-500/10 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none mt-2"
          >
            {loading ? 'Saving Passcode...' : 'Save Passcode & Continue'}
          </button>
        </form>

        <p className="text-[11px] text-slate-500 text-center mt-6">
          This passcode configuration is required to access the POS register system.
        </p>
      </div>
    </div>
  );
}
