import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, CheckCircle, XCircle, RefreshCw, Sparkles,
  Building2, User, MapPin, FileText, Phone, Mail, ExternalLink, Loader
} from 'lucide-react';
import api from '../../api/axios';

const formatBusinessAddress = (b) => {
  if (!b) return '';
  if (b.street1) {
    const line1 = [b.street1, b.street2].filter(Boolean).join(', ');
    const line2 = [b.city, b.state, b.zipCode, b.country].filter(Boolean).join(', ');
    return [line1, line2].filter(Boolean).join('\n');
  }
  if (b.address) {
    return [b.address, b.city, b.country].filter(Boolean).join(', ');
  }
  return '';
};

const DetailRow = ({ icon: Icon, label, value }) =>
  value ? (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
        <Icon size={15} className="text-gray-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className="text-sm font-medium text-gray-800 whitespace-pre-line">{value}</p>
      </div>
    </div>
  ) : null;

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const [action, setAction] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [notes, setNotes] = useState('');

  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [emailStatusMessage, setEmailStatusMessage] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');

  const { data: app, isLoading } = useQuery({
    queryKey: ['application', id],
    queryFn: async () => {
      const { data } = await api.get(`/applications/${id}`);
      return data;
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['workspace-plans'],
    queryFn: async () => {
      const { data } = await api.get('/plans', { params: { status: 'active' } });
      return Array.isArray(data) ? data : [];
    },
    enabled: app?.requestedPlanId === 'custom' && !['approved', 'rejected'].includes(app?.status),
  });

  const { data: brPreview, isError: brPreviewError, isLoading: brPreviewLoading } = useQuery({
    queryKey: ['application-br', id],
    queryFn: async () => {
      const { data } = await api.get(`/applications/${id}/br-preview`);
      return data;
    },
    enabled: Boolean(app?.business?.brDocumentKey),
    retry: 1,
  });

  const mutation = useMutation({
    mutationFn: (payload) => api.put(`/applications/${id}/status`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application', id] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setAction(null);
      setSelectedPlanId('');
    },
  });

  useEffect(() => {
    if (app?.personal?.email) {
      setNewEmail(app.personal.email);
    }
  }, [app]);

  const handleSaveEmail = async () => {
    if (!newEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setEmailStatusMessage('Please enter a valid email address');
      return;
    }
    setUpdatingEmail(true);
    setEmailStatusMessage('');
    try {
      await api.put(`/applications/${id}/email`, { email: newEmail });
      queryClient.invalidateQueries({ queryKey: ['application', id] });
      setEditingEmail(false);
      setEmailStatusMessage('Email updated successfully!');
      setTimeout(() => setEmailStatusMessage(''), 3000);
    } catch (err) {
      setEmailStatusMessage(err.response?.data?.message || 'Failed to update email');
    } finally {
      setUpdatingEmail(false);
    }
  };

  const handleSendVerification = async () => {
    setSendingVerification(true);
    setEmailStatusMessage('');
    try {
      await api.post(`/applications/${id}/send-verification`);
      setEmailStatusMessage('Verification email sent successfully!');
      setTimeout(() => setEmailStatusMessage(''), 4000);
    } catch (err) {
      setEmailStatusMessage(err.response?.data?.message || 'Failed to send verification email');
    } finally {
      setSendingVerification(false);
    }
  };

  const submitAction = () => {
    if (action === 'reject' && !rejectionReason.trim()) return;
    if (action === 'approve' && app?.requestedPlanId === 'custom' && !selectedPlanId) return;
    mutation.mutate({
      action,
      rejectionReason: action === 'reject' ? rejectionReason : undefined,
      notes: notes || undefined,
      planId: (action === 'approve' && app?.requestedPlanId === 'custom') ? selectedPlanId : undefined,
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;
  }
  if (!app) return <div className="text-gray-500 text-center mt-12">Application not found</div>;

  const canAct = !['approved', 'rejected'].includes(app.status);
  const ownerLabel = app.business?.ownerName || app.business?.ownerNames;
  const addressText = formatBusinessAddress(app.business);
  const brMime = (brPreview?.mimeType || app.business?.brDocumentMimeType || '').toLowerCase();
  const isPdf = brMime.includes('pdf');
  const isImage = brMime.startsWith('image/');

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/applications" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft size={15} />
          Back to applications
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {app.personal?.firstName || '—'} {app.personal?.lastName || ''}
            </h2>
            <p className="text-gray-500 text-sm mt-1">{app.business?.name || '—'}</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize
              ${
                app.status === 'approved'
                  ? 'bg-green-100 text-green-700'
                  : app.status === 'rejected'
                    ? 'bg-red-100 text-red-700'
                    : app.status === 'under_review'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {app.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Personal Details</h3>
            <div className="bg-gray-50 rounded-xl p-4">
              <DetailRow
                icon={User}
                label="Full name"
                value={`${app.personal?.firstName || ''} ${app.personal?.lastName || ''}`.trim() || undefined}
              />
              <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                  <Mail size={15} className="text-gray-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 mb-0.5">Email</p>
                  {editingEmail ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="bg-white border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-amber-500 w-full"
                      />
                      <button
                        onClick={handleSaveEmail}
                        disabled={updatingEmail || !newEmail.trim()}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-2 py-1 rounded text-xs transition cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setEditingEmail(false); setNewEmail(app?.personal?.email || ''); }}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded text-xs transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-gray-800">{app.personal?.email}</p>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${app.personal?.emailVerified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-750'}`}>
                        {app.personal?.emailVerified ? '✓ Verified' : '⚠ Unverified'}
                      </span>
                      {canAct && (
                        <button
                          onClick={() => { setEditingEmail(true); setNewEmail(app?.personal?.email || ''); }}
                          className="text-xs text-amber-600 hover:underline font-semibold cursor-pointer"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <DetailRow icon={Phone} label="Mobile" value={app.personal?.mobile || app.personal?.mobileE164} />
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Business Details</h3>
            <div className="bg-gray-50 rounded-xl p-4">
              <DetailRow icon={Building2} label="Business name" value={app.business?.name} />
              <DetailRow icon={User} label="Owner name" value={ownerLabel} />
              <DetailRow icon={MapPin} label="Address" value={addressText} />
              {app.business.isRegistered && (
                <DetailRow icon={FileText} label="Reg. number" value={app.business.registrationNumber || '—'} />
              )}
              <DetailRow
                icon={Sparkles}
                label="Requested Subscription Plan"
                value={
                  app.requestedPlan
                    ? `${app.requestedPlan.name} Plan — ${app.requestedBillingCycle === 'yearly' ? 'Yearly Billing' : 'Monthly Billing'}`
                    : app.requestedPlanId === 'custom'
                      ? 'Custom Plan (Superadmin locked)'
                      : 'None'
                }
              />
            </div>
          </div>
        </div>

        {app.business?.brDocumentKey && (
          <div className="mt-6 border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">BR certificate</h3>
              {brPreview?.url && (
                <a
                  href={brPreview.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-brand-orange font-medium hover:underline"
                >
                  <ExternalLink size={12} />
                  Open in new tab
                </a>
              )}
            </div>
            <div className="p-4 bg-white min-h-[200px] flex flex-col items-center justify-center gap-2">
              {brPreviewLoading && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader size={16} className="animate-spin" />
                  Loading preview…
                </div>
              )}
              {brPreviewError && (
                <p className="text-sm text-red-600 text-center">
                  Could not load a preview. Use “Open in new tab” if the upload service is running.
                </p>
              )}
              {brPreview?.url && !brPreviewLoading && isImage && (
                <img
                  src={brPreview.url}
                  alt="BR certificate"
                  className="max-w-full max-h-[480px] object-contain rounded-lg border border-gray-100"
                />
              )}
              {brPreview?.url && !brPreviewLoading && isPdf && (
                <iframe
                  title="BR certificate PDF"
                  src={brPreview.url}
                  className="w-full h-[min(70vh,560px)] rounded-lg border border-gray-200"
                />
              )}
              {brPreview?.url && !brPreviewLoading && !isImage && !isPdf && (
                <a
                  href={brPreview.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-sm"
                >
                  <FileText size={16} />
                  Download / view file
                </a>
              )}
            </div>
          </div>
        )}

        {app.status === 'rejected' && app.rejectionReason && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-red-500 uppercase mb-1">Rejection reason</p>
            <p className="text-sm text-red-700">{app.rejectionReason}</p>
          </div>
        )}

        {app.status === 'approved' && app.tenantId && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-green-600 uppercase mb-1">Merchant created</p>
            <p className="text-sm text-green-700">
              Tenant ID: {typeof app.tenantId === 'object' ? app.tenantId._id || app.tenantId : app.tenantId}
            </p>
          </div>
        )}
      </div>

      {canAct && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Review Decision</h3>

          {mutation.isSuccess && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-center gap-2">
              <CheckCircle size={15} /> Done! Status updated.
            </div>
          )}
          {mutation.isError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {mutation.error?.response?.data?.message || 'Error occurred'}
            </div>
          )}
          {emailStatusMessage && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-center gap-2">
              <CheckCircle size={15} /> {emailStatusMessage}
            </div>
          )}

          {action === null ? (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSendVerification}
                disabled={sendingVerification || app.personal?.emailVerified}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-750 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Mail size={14} />
                {app.personal?.emailVerified ? 'Email Verified' : 'Send Verification Email'}
              </button>
              <button
                onClick={() => mutation.mutate({ action: 'under_review' })}
                disabled={mutation.isPending}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-blue-300 text-blue-700 text-sm font-medium hover:bg-blue-50 transition-colors cursor-pointer"
              >
                <RefreshCw size={14} />
                Mark under review
              </button>
              <button
                onClick={() => setAction('approve')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors cursor-pointer"
              >
                <CheckCircle size={14} />
                Approve
              </button>
              <button
                onClick={() => setAction('reject')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
              >
                <XCircle size={14} />
                Reject
              </button>
            </div>
          ) : action === 'approve' ? (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Approving will create a merchant account, generate a temporary password, and email the applicant their
                admin portal login.
              </p>
              {app.requestedPlanId === 'custom' && (
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Assign Custom Plan <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                  >
                    <option value="">Select custom plan created for this user...</option>
                    {plans.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} ({p.currency} {Number(p.amount).toLocaleString()} / {p.billingCycle || 'monthly'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Internal notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setAction(null); setSelectedPlanId(''); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitAction}
                  disabled={mutation.isPending || (app.requestedPlanId === 'custom' && !selectedPlanId)}
                  className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-60"
                >
                  {mutation.isPending ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Confirm Approval
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rejection reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                placeholder="Explain why this application is being rejected..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setAction(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitAction}
                  disabled={mutation.isPending || !rejectionReason.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
                >
                  {mutation.isPending ? <Loader size={14} className="animate-spin" /> : <XCircle size={14} />}
                  Confirm Rejection
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
