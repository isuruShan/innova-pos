import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Save, Loader, CheckCircle, AlertTriangle, Shield, Eye, EyeOff } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { fieldAttrs, validatePersonName } from '../../utils/formFields';
import PlatformContactSection from '../../components/profile/PlatformContactSection';

export default function ProfilePage() {
  const { user, updateUser, isSuperAdmin } = useAuth();
  const isMerchantAdmin = user?.role === 'merchant_admin';
  const mustChange = Boolean(user?.isTemporaryPassword);

  const [nameForm, setNameForm] = useState({ name: '' });
  const [nameError, setNameError] = useState('');
  const [saved, setSaved] = useState({ name: false });
  const [uploadingImage, setUploadingImage] = useState(false);

  // PIN change state
  const [pinForm, setPinForm] = useState({ currentPassword: '', newPin: '', confirmPin: '' });
  const [pinError, setPinError] = useState('');
  const [pinSaved, setPinSaved] = useState(false);
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    if (user?.name != null) setNameForm({ name: user.name });
  }, [user?.name]);

  const profileMutation = useMutation({
    mutationFn: (payload) => api.put('/auth/me', payload),
    onSuccess: (res) => {
      updateUser(res.data.user, res.data.token, res.data.refreshToken);
      setSaved((s) => ({ ...s, name: true }));
      setTimeout(() => setSaved((s) => ({ ...s, name: false })), 3000);
    },
  });

  const pinMutation = useMutation({
    mutationFn: (payload) => api.put('/auth/me/approval-pin', payload),
    onSuccess: () => {
      setPinForm({ currentPassword: '', newPin: '', confirmPin: '' });
      setPinError('');
      setPinSaved(true);
      setTimeout(() => setPinSaved(false), 3000);
    },
    onError: (err) => {
      setPinError(err.response?.data?.message || 'Failed to update PIN');
    },
  });

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const fd = new FormData();
    fd.append('profileImage', file);
    try {
      const { data } = await api.post('/auth/profile-image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateUser({ ...user, profileImage: data.profileImage, profileImageKey: data.profileImageKey });
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to upload profile image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!confirm('Remove profile image?')) return;
    setUploadingImage(true);
    try {
      const { data } = await api.put('/auth/me', { profileImage: '', profileImageKey: '' });
      updateUser(data.user, data.token, data.refreshToken);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove profile image');
    } finally {
      setUploadingImage(false);
    }
  };

  const nameAttrs = fieldAttrs('personName');

  const handleSaveName = () => {
    const check = validatePersonName(nameForm.name, { label: 'Full name' });
    if (!check.ok) {
      setNameError(check.error);
      return;
    }
    setNameError('');
    profileMutation.mutate({ name: nameForm.name.trim() });
  };

  const handleSavePin = () => {
    setPinError('');
    if (!pinForm.currentPassword) return setPinError('Current password is required');
    if (!pinForm.newPin) return setPinError('New PIN is required');
    if (!/^\d{4,8}$/.test(pinForm.newPin)) return setPinError('PIN must be 4–8 digits (numbers only)');
    if (pinForm.newPin !== pinForm.confirmPin) return setPinError('PINs do not match');
    pinMutation.mutate({ currentPassword: pinForm.currentPassword, newPin: pinForm.newPin });
  };

  const inputClass =
    'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange';

  return (
    <div className={`space-y-6 ${isSuperAdmin ? 'max-w-3xl' : 'max-w-xl'}`}>
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

        {/* Profile Picture Upload Section */}
        <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
          <div className="relative w-16 h-16 rounded-full bg-brand-orange flex items-center justify-center text-xl font-bold text-white overflow-hidden shrink-0">
            {user?.profileImage ? (
              <img src={user.profileImage} className="w-full h-full object-cover" alt="" />
            ) : (
              user?.name?.[0]?.toUpperCase() || 'A'
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-950">Profile Picture</p>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition">
                {uploadingImage ? 'Uploading...' : 'Upload Image'}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} disabled={uploadingImage} />
              </label>
              {user?.profileImage && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  disabled={uploadingImage}
                  className="px-3 py-1.5 rounded-lg border border-red-200 text-xs font-semibold text-red-600 bg-white hover:bg-red-50 transition"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-400">JPG, PNG, or WEBP. Max 2MB.</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="profile-full-name">
            Full name
          </label>
          <input
            id="profile-full-name"
            type="text"
            value={nameForm.name}
            onChange={(e) => {
              setNameForm({ name: e.target.value });
              if (nameError) setNameError('');
            }}
            placeholder={nameAttrs.placeholder}
            maxLength={nameAttrs.maxLength}
            className={`${inputClass} ${nameError ? 'border-red-400' : 'border-gray-300'}`}
            autoComplete="name"
          />
          {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
          <input
            type="email"
            value={user?.email || ''}
            disabled
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
          />
          <p className="text-xs text-gray-400 mt-1">Email cannot be changed here</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <input
            type="text"
            value={user?.role?.replace('_', ' ') || ''}
            disabled
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed capitalize"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveName}
            disabled={profileMutation.isPending}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover disabled:opacity-60"
          >
            {profileMutation.isPending ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
            Save name
          </button>
          {saved.name && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle size={13} /> Saved
            </span>
          )}
          {profileMutation.isError && <span className="text-sm text-red-600">Failed to save</span>}
        </div>
      </div>



      {/* Approval Passcode (merchant_admin only) */}
      {isMerchantAdmin && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-brand-orange" />
            <h3 className="font-semibold text-gray-900">Approval Passcode</h3>
          </div>
          <p className="text-sm text-gray-500">
            This PIN is used to authorise manager actions (e.g. processing returns). It is separate from your login password.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="pin-current-pw">
                Current password
              </label>
              <input
                id="pin-current-pw"
                type="password"
                value={pinForm.currentPassword}
                onChange={(e) => { setPinForm(f => ({ ...f, currentPassword: e.target.value })); if (pinError) setPinError(''); }}
                placeholder="Enter your login password"
                autoComplete="current-password"
                className={`${inputClass} border-gray-300`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="pin-new">
                New PIN (4–8 digits)
              </label>
              <div className="relative">
                <input
                  id="pin-new"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={pinForm.newPin}
                  onChange={(e) => { setPinForm(f => ({ ...f, newPin: e.target.value.replace(/\D/g, '') })); if (pinError) setPinError(''); }}
                  placeholder="e.g. 1234"
                  className={`${inputClass} border-gray-300 pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="pin-confirm">
                Confirm PIN
              </label>
              <input
                id="pin-confirm"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={pinForm.confirmPin}
                onChange={(e) => { setPinForm(f => ({ ...f, confirmPin: e.target.value.replace(/\D/g, '') })); if (pinError) setPinError(''); }}
                placeholder="Re-enter new PIN"
                className={`${inputClass} border-gray-300`}
              />
            </div>
            {pinError && <p className="text-xs text-red-500">{pinError}</p>}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSavePin}
                disabled={pinMutation.isPending}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover disabled:opacity-60"
              >
                {pinMutation.isPending ? <Loader size={14} className="animate-spin" /> : <Shield size={14} />}
                Update PIN
              </button>
              {pinSaved && (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle size={13} /> PIN updated
                </span>
              )}
            </div>
          </div>
        </div>
      )}


      {isSuperAdmin && <PlatformContactSection />}
    </div>
  );
}
