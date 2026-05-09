import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Loader, CheckCircle, Clock, AlertTriangle, ExternalLink, FileText } from 'lucide-react';
import api from '../../api/axios';

export default function SubscriptionPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [form, setForm] = useState({ amount: '', bankReference: '', bankName: '', paymentDate: '', notes: '' });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const { data } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: async () => { const { data } = await api.get('/subscriptions/my'); return data; },
  });

  const uploadMutation = useMutation({
    mutationFn: (fd) => api.post('/subscriptions/receipts', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
      setSubmitted(true);
      setForm({ amount: '', bankReference: '', bankName: '', paymentDate: '', notes: '' });
      setFile(null);
    },
    onError: (err) => setErrors({ api: err.response?.data?.message || 'Upload failed' }),
  });

  const validate = () => {
    const e = {};
    if (!form.amount || isNaN(form.amount) || parseFloat(form.amount) <= 0) e.amount = 'Valid amount required';
    if (!form.bankReference.trim()) e.bankReference = 'Bank reference required';
    if (!form.paymentDate) e.paymentDate = 'Payment date required';
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
    if (file) fd.append('receipt', file);
    uploadMutation.mutate(fd);
  };

  const tenant = data?.tenant;
  const receipts = data?.receipts || [];

  const trialDaysLeft = tenant?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(tenant.trialEndsAt) - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Subscription & Billing</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage your subscription and upload payment receipts</p>
      </div>

      {/* Current status */}
      {tenant && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Current Plan</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-400">Status</p>
              <p className="font-semibold capitalize text-gray-900 mt-0.5">{tenant.subscriptionStatus}</p>
            </div>
            {tenant.subscriptionStatus === 'trial' && (
              <div>
                <p className="text-xs text-gray-400">Trial ends</p>
                <p className="font-semibold text-gray-900 mt-0.5">
                  {new Date(tenant.trialEndsAt).toLocaleDateString()} ({trialDaysLeft} days left)
                </p>
              </div>
            )}
          </div>

          {tenant.subscriptionStatus === 'trial' && trialDaysLeft <= 5 && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-sm text-amber-700">
              <AlertTriangle size={15} />
              Your trial expires soon. Upload a payment receipt to continue.
            </div>
          )}
        </div>
      )}

      {/* Upload payment receipt */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Upload Payment Receipt</h3>

        {submitted ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
            <p className="font-semibold text-green-800">Receipt uploaded!</p>
            <p className="text-sm text-green-600 mt-1">Our team will verify your payment within 1–2 business days.</p>
            <button onClick={() => setSubmitted(false)} className="mt-3 text-sm text-green-700 underline">
              Upload another receipt
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (LKR) *</label>
                <input type="number" value={form.amount} onChange={e => { setForm(f => ({ ...f, amount: e.target.value })); setErrors(e2 => ({ ...e2, amount: '' })); }}
                  placeholder="4990"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 ${errors.amount ? 'border-red-400' : 'border-gray-300'}`} />
                {errors.amount && <p className="text-xs text-red-500 mt-0.5">{errors.amount}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment date *</label>
                <input type="date" value={form.paymentDate} onChange={e => { setForm(f => ({ ...f, paymentDate: e.target.value })); setErrors(e2 => ({ ...e2, paymentDate: '' })); }}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 ${errors.paymentDate ? 'border-red-400' : 'border-gray-300'}`} />
                {errors.paymentDate && <p className="text-xs text-red-500 mt-0.5">{errors.paymentDate}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank reference / transaction ID *</label>
              <input type="text" value={form.bankReference} onChange={e => { setForm(f => ({ ...f, bankReference: e.target.value })); setErrors(e2 => ({ ...e2, bankReference: '' })); }}
                placeholder="TXN12345678"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 ${errors.bankReference ? 'border-red-400' : 'border-gray-300'}`} />
              {errors.bankReference && <p className="text-xs text-red-500 mt-0.5">{errors.bankReference}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank name</label>
              <input type="text" value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))}
                placeholder="Commercial Bank"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Receipt photo (optional)</label>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files[0])} className="hidden" />
              {file ? (
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <FileText size={16} className="text-green-600 shrink-0" />
                  <span className="text-sm text-green-700 flex-1 truncate">{file.name}</span>
                  <button type="button" onClick={() => setFile(null)} className="text-gray-400 hover:text-gray-600 text-xs">Remove</button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-sm text-gray-500 hover:border-brand-orange hover:text-brand-orange transition-colors flex items-center justify-center gap-2">
                  <Upload size={16} /> Click to upload receipt
                </button>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 resize-none" />
            </div>

            {errors.api && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{errors.api}</p>}

            <button type="submit" disabled={uploadMutation.isPending}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover disabled:opacity-60"
            >
              {uploadMutation.isPending ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
              Submit receipt
            </button>
          </form>
        )}
      </div>

      {/* Payment history */}
      {receipts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Payment History</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {receipts.map(r => (
              <div key={r._id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">Rs. {r.amount?.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">{r.bankReference} · {new Date(r.paymentDate).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {r.receiptFileUrl && (
                    <a href={r.receiptFileUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                      <ExternalLink size={11} /> View
                    </a>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                    r.status === 'verified' ? 'bg-green-100 text-green-700'
                    : r.status === 'rejected' ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
                  }`}>{r.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
