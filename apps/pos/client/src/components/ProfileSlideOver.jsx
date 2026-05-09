import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Camera, Save, X } from 'lucide-react';
import api from '../api/axios';
import SlideOver from './SlideOver';
import { useAuth } from '../context/AuthContext';

const ROLE_COLORS = {
  cashier: 'bg-amber-500',
  kitchen: 'bg-green-500',
  manager: 'bg-purple-500',
};

const ROLE_BADGE = {
  cashier: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  kitchen: 'bg-green-500/20 text-green-400 border-green-500/30',
  manager: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function AvatarDisplay({ user, size = 'md', className = '' }) {
  const sz = {
    xs: 'w-7 h-7 text-xs',
    sm: 'w-9 h-9 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-base',
  }[size] || 'w-9 h-9 text-xs';

  const imgSrc = user?.profileImage || null;

  if (imgSrc) {
    return (
      <img
        src={imgSrc}
        alt={user.name}
        className={`${sz} rounded-full object-cover flex-shrink-0 ${className}`}
        onError={e => { e.target.style.display = 'none'; }}
      />
    );
  }

  return (
    <div className={`${sz} rounded-full ${ROLE_COLORS[user?.role] || 'bg-slate-600'} flex items-center justify-center font-bold text-white flex-shrink-0 ${className}`}>
      {getInitials(user?.name)}
    </div>
  );
}

export default function ProfileSlideOver({ open, onClose }) {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (open) { setName(user?.name || ''); setError(''); setSaved(false); }
  }, [open, user?.name]);

  const saveMutation = useMutation({
    mutationFn: (data) => api.put('/auth/me', data),
    onSuccess: ({ data }) => {
      updateUser(data.user, data.token);
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1200);
    },
    onError: (e) => setError(e.response?.data?.message || 'Failed to save'),
  });

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await api.post('/upload', fd);
      // Save profile image immediately
      saveMutation.mutate({ profileImage: data.url });
    } catch {
      setError('Image upload failed. Please try again.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSaveName = () => {
    setError('');
    if (!name.trim()) return setError('Name cannot be empty');
    if (name.trim() === user?.name) return onClose();
    saveMutation.mutate({ name: name.trim() });
  };

  if (!user) return null;

  return (
    <SlideOver open={open} onClose={onClose} title="My Profile">
      <div className="space-y-6">
        {/* Avatar section */}
        <div className="flex flex-col items-center gap-3 pt-2">
          <div className="relative">
            <AvatarDisplay user={user} size="lg" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-amber-500 hover:bg-amber-400 rounded-full flex items-center justify-center text-white transition shadow-lg disabled:opacity-60"
              title="Upload photo"
            >
              <Camera size={13} />
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          <p className="text-xs text-slate-500">{uploading ? 'Uploading…' : 'Tap camera to change photo'}</p>
        </div>

        {/* Info (read-only) */}
        <div className="bg-[#0f172a] border border-slate-700/50 rounded-xl px-4 py-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Email</span>
            <span className="text-slate-300">{user.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Role</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${ROLE_BADGE[user.role]}`}>
              {user.role}
            </span>
          </div>
        </div>

        {/* Editable name */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Display Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveName()}
            placeholder="Your name"
            className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600"
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 rounded-xl transition text-sm">
            Cancel
          </button>
          <button
            onClick={handleSaveName}
            disabled={saveMutation.isPending || uploading}
            className={`flex-1 flex items-center justify-center gap-2 font-semibold py-2.5 rounded-xl transition text-sm ${
              saved ? 'bg-green-500 text-white' : 'bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white'
            }`}
          >
            <Save size={14} />
            {saveMutation.isPending ? 'Saving…' : saved ? 'Saved ✓' : 'Save Name'}
          </button>
        </div>
      </div>
    </SlideOver>
  );
}
