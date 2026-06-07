import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, ShieldCheck, Loader } from 'lucide-react';
import api from '../../api/axios';

export default function ReturnApprovalModal({ open, onClose, onApproved }) {
  const [managerId, setManagerId] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');

  const { data: managers = [], isPending } = useQuery({
    queryKey: ['approval-managers'],
    queryFn: () => api.get('/users/approval-managers').then((r) => r.data),
    enabled: open,
  });

  if (!open) return null;

  const selected = managers.find((m) => String(m._id) === String(managerId));

  const submit = (e) => {
    e.preventDefault();
    setError('');
    if (!managerId) {
      setError('Select a manager');
      return;
    }
    if (!secret.trim()) {
      setError(selected?.hasApprovalPin ? 'Enter the manager passcode' : 'Enter the manager password');
      return;
    }
    onApproved({ managerId, approvalSecret: secret.trim() });
    setSecret('');
  };

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60"
      onClick={(e) => {
        if (window.innerWidth >= 640 && e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-[var(--pos-panel)] border border-slate-600 rounded-2xl w-full max-w-md shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-amber-400" size={22} />
            <h2 className="text-lg font-bold text-[var(--pos-text-primary)]">Manager approval</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          Select an on-duty manager and enter their approval passcode. If they have not set a passcode, use their login
          password.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Manager</label>
            {isPending ? (
              <p className="text-sm text-slate-500 flex items-center gap-2">
                <Loader size={14} className="animate-spin" /> Loading…
              </p>
            ) : (
              <select
                value={managerId}
                onChange={(e) => {
                  setManagerId(e.target.value);
                  setError('');
                }}
                className="w-full border border-slate-600 rounded-lg px-3 py-2.5 text-sm bg-slate-800 text-[var(--pos-text-primary)]"
              >
                <option value="">Choose manager…</option>
                {managers.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name}
                    {m.hasApprovalPin ? ' (passcode)' : ' (password)'}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              {selected?.hasApprovalPin ? 'Approval passcode' : 'Manager password'}
            </label>
            <input
              type="password"
              value={secret}
              onChange={(e) => {
                setSecret(e.target.value);
                setError('');
              }}
              maxLength={128}
              autoComplete="off"
              className="w-full border border-slate-600 rounded-lg px-3 py-2.5 text-sm bg-slate-800 text-[var(--pos-text-primary)]"
              placeholder={selected?.hasApprovalPin ? '4–8 digit passcode' : 'Manager account password'}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-600 text-sm font-medium text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold"
            >
              Approve return
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
