import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Save, Loader, CheckCircle, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [searchParams] = useSearchParams();
  const mustChange = searchParams.get('changePassword') === '1';

  const [nameForm, setNameForm] = useState({ name: user?.name || '' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });
  const [pwErrors, setPwErrors] = useState({});
  const [saved, setSaved] = useState({ name: false, password: false });

  const profileMutation = useMutation({
    mutationFn: (payload) => api.put('/auth/me', payload),
    onSuccess: (res) => {
      updateUser(res.data.user, res.data.token);
      setSaved(s => ({ ...s, name: true }));
      setTimeout(() => setSaved(s => ({ ...s, name: false })), 3000);
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (payload) => api.put('/auth/me', payload),
    onSuccess: (res) => {
      updateUser(res.data.user, res.data.token);
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
      setSaved(s => ({ ...s, password: true }));
      setTimeout(() => setSaved(s => ({ ...s, password: false })), 3000);
    },
    onError: (err) => setPwErrors({ api: err.response?.data?.message || 'Failed to update password' }),
  });

  const validatePassword = () => {
    const e = {};
    if (!pwForm.currentPassword) e.currentPassword = 'Current password required';
    if (!pwForm.newPassword || pwForm.newPassword.length < 8) e.newPassword = 'New password must be at least 8 characters';
    if (pwForm.newPassword !== pwForm.confirm) e.confirm = 'Passwords do not match';
    return e;
  };

  const handleSaveName = () => {
    if (!nameForm.name.trim()) return;
    profileMutation.mutate({ name: nameForm.name });
  };

  const handleSavePassword = () => {
    const errs = validatePassword();
    if (Object.keys(errs).length) { setPwErrors(errs); return; }
    passwordMutation.mutate({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
  };

  const FieldRow = ({ label, value, onChange, type = 'text', error, show, onToggle }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input type={type === 'password' ? (show ? 'text' : 'password') : type}
          value={value} onChange={e => onChange(e.target.value)}
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 ${error ? 'border-red-400' : 'border-gray-300'} ${type === 'password' ? 'pr-10' : ''}`} />
        {type === 'password' && (
          <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">My Profile</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account settings</p>
      </div>

      {mustChange && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-sm text-amber-700">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>You're using a temporary password. Please change it before continuing.</span>
        </div>
      )}

      {/* Profile */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Account Information</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
          <input type="text" value={nameForm.name} onChange={e => setNameForm({ name: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
          <input type="email" value={user?.email || ''} disabled
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
          <p className="text-xs text-gray-400 mt-1">Email cannot be changed here</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <input type="text" value={user?.role?.replace('_', ' ') || ''} disabled
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed capitalize" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSaveName} disabled={profileMutation.isPending}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover disabled:opacity-60"
          >
            {profileMutation.isPending ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
            Save name
          </button>
          {saved.name && <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle size={13} /> Saved</span>}
          {profileMutation.isError && <span className="text-sm text-red-600">Failed to save</span>}
        </div>
      </div>

      {/* Password change */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Change Password</h3>

        <FieldRow label="Current password" value={pwForm.currentPassword}
          onChange={v => { setPwForm(f => ({ ...f, currentPassword: v })); setPwErrors(e => ({ ...e, currentPassword: '' })); }}
          type="password" error={pwErrors.currentPassword}
          show={showPw.current} onToggle={() => setShowPw(s => ({ ...s, current: !s.current }))} />

        <FieldRow label="New password" value={pwForm.newPassword}
          onChange={v => { setPwForm(f => ({ ...f, newPassword: v })); setPwErrors(e => ({ ...e, newPassword: '' })); }}
          type="password" error={pwErrors.newPassword}
          show={showPw.new} onToggle={() => setShowPw(s => ({ ...s, new: !s.new }))} />

        <FieldRow label="Confirm new password" value={pwForm.confirm}
          onChange={v => { setPwForm(f => ({ ...f, confirm: v })); setPwErrors(e => ({ ...e, confirm: '' })); }}
          type="password" error={pwErrors.confirm}
          show={showPw.confirm} onToggle={() => setShowPw(s => ({ ...s, confirm: !s.confirm }))} />

        {pwErrors.api && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{pwErrors.api}</p>}

        <div className="flex items-center gap-3">
          <button onClick={handleSavePassword} disabled={passwordMutation.isPending}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover disabled:opacity-60"
          >
            {passwordMutation.isPending ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
            Update password
          </button>
          {saved.password && <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle size={13} /> Updated</span>}
        </div>
      </div>
    </div>
  );
}
