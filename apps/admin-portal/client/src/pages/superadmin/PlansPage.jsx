import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import ViewModeToggle from '../../components/common/ViewModeToggle';
import { buildPlanCardBackground, buildPlanTagBackground, planUsesLightText } from '../../utils/planAppearance';

const INITIAL_FORM = {
  name: '',
  code: '',
  billingCycle: 'monthly',
  amount: '',
  currency: 'LKR',
  durationDays: '30',
  planAudience: 'local',
  featureLines: [''],
  isPublic: true,
  isActive: true,
  isDefault: false,
  planTagShow: false,
  planTagText: '',
  planTagTextColor: '#ffffff',
  planTagBgMode: 'solid',
  planTagSolidColor: '#fa7237',
  planTagGradFrom: '#fa7237',
  planTagGradTo: '#233d4d',
  planTagGradAngle: '135',
  planCardBgMode: 'default',
  planCardSolidColor: '#ffffff',
  planCardGradFrom: '#ffffff',
  planCardGradTo: '#f1f5f9',
  planCardGradAngle: '145',
  planCardUseLightText: false,
};

export default function PlansPage() {
  const queryClient = useQueryClient();
  const invalidatePlanQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['plans'] });
    queryClient.invalidateQueries({ queryKey: ['workspace-plans'] });
  };

  const [form, setForm] = useState(INITIAL_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('view_mode_plans') || 'table');
  const [listStatus, setListStatus] = useState(() => localStorage.getItem('plans_list_status') || 'active');

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['plans', listStatus],
    queryFn: async () => {
      const { data } = await api.get('/plans', { params: { status: listStatus } });
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingId) {
        const { data } = await api.put(`/plans/${editingId}`, payload);
        return data;
      }
      const { data } = await api.post('/plans', payload);
      return data;
    },
    onSuccess: () => {
      invalidatePlanQueries();
      setEditingId(null);
      setForm(INITIAL_FORM);
      setError('');
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to save plan'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id) => api.delete(`/plans/${id}`),
    onSuccess: invalidatePlanQueries,
  });

  const enableMutation = useMutation({
    mutationFn: (id) => api.put(`/plans/${id}`, { isActive: true }),
    onSuccess: invalidatePlanQueries,
  });

  const resetForm = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setError('');
  };

  const startEdit = (plan) => {
    setEditingId(plan._id);
    setError('');
    setForm({
      name: plan.name || '',
      code: plan.code || '',
      billingCycle: plan.billingCycle || 'monthly',
      amount: String(plan.amount ?? ''),
      currency: plan.currency || 'LKR',
      durationDays: String(plan.durationDays ?? ''),
      featureLines:
        Array.isArray(plan.featureLines) && plan.featureLines.length > 0
          ? [...plan.featureLines]
          : plan.description
            ? String(plan.description)
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean)
            : [''],
      isPublic: Boolean(plan.isPublic),
      isActive: Boolean(plan.isActive),
      isDefault: Boolean(plan.isDefault),
      planAudience: plan.planAudience === 'international' ? 'international' : 'local',
      planTagShow: Boolean(plan.planTagShow),
      planTagText: plan.planTagText || '',
      planTagTextColor: plan.planTagTextColor || '#ffffff',
      planTagBgMode: plan.planTagBgMode === 'gradient' ? 'gradient' : 'solid',
      planTagSolidColor: plan.planTagSolidColor || '#fa7237',
      planTagGradFrom: plan.planTagGradFrom || '#fa7237',
      planTagGradTo: plan.planTagGradTo || '#233d4d',
      planTagGradAngle: String(plan.planTagGradAngle ?? '135'),
      planCardBgMode: ['default', 'solid', 'gradient'].includes(plan.planCardBgMode)
        ? plan.planCardBgMode
        : 'default',
      planCardSolidColor: plan.planCardSolidColor || '#ffffff',
      planCardGradFrom: plan.planCardGradFrom || '#ffffff',
      planCardGradTo: plan.planCardGradTo || '#f1f5f9',
      planCardGradAngle: String(plan.planCardGradAngle ?? '145'),
      planCardUseLightText: Boolean(plan.planCardUseLightText),
    });
  };

  const payload = useMemo(() => {
    const lines = (form.featureLines || []).map((s) => String(s).trim()).filter(Boolean);
    return {
      ...form,
      amount: Number(form.amount),
      durationDays: Number(form.durationDays),
      featureLines: lines,
      description: lines.join('\n'),
      planTagGradAngle: Number(form.planTagGradAngle) || 135,
      planCardGradAngle: Number(form.planCardGradAngle) || 145,
    };
  }, [form]);

  const previewPlan = useMemo(
    () => ({
      planTagShow: form.planTagShow,
      planTagText: form.planTagText,
      planTagTextColor: form.planTagTextColor,
      planTagBgMode: form.planTagBgMode,
      planTagSolidColor: form.planTagSolidColor,
      planTagGradFrom: form.planTagGradFrom,
      planTagGradTo: form.planTagGradTo,
      planTagGradAngle: Number(form.planTagGradAngle) || 135,
      planCardBgMode: form.planCardBgMode,
      planCardSolidColor: form.planCardSolidColor,
      planCardGradFrom: form.planCardGradFrom,
      planCardGradTo: form.planCardGradTo,
      planCardGradAngle: Number(form.planCardGradAngle) || 145,
      planCardUseLightText: form.planCardUseLightText,
      isDefault: form.isDefault,
    }),
    [form]
  );

  const onViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('view_mode_plans', mode);
  };

  const onListStatusChange = (status) => {
    setListStatus(status);
    localStorage.setItem('plans_list_status', status);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim() || !form.amount || !form.durationDays) {
      setError('Name, code, amount, and duration are required');
      return;
    }
    saveMutation.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Subscription Plans</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage global monthly/yearly/custom plans for all channels.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">{editingId ? 'Edit plan' : 'Create plan'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Plan Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Plan name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Plan Code</label>
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="Code (e.g. MONTHLY)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Billing Cycle</label>
              <select
                value={form.billingCycle}
                onChange={(e) => setForm((f) => ({ ...f, billingCycle: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount</label>
              <input
                type="number"
                min="0"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="Amount"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Duration (Days)</label>
              <input
                type="number"
                min="1"
                value={form.durationDays}
                onChange={(e) => setForm((f) => ({ ...f, durationDays: e.target.value }))}
                placeholder="Duration (days)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Currency</label>
              <input
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
                placeholder="Currency"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Region</label>
              <select
                value={form.planAudience}
                onChange={(e) => setForm((f) => ({ ...f, planAudience: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="local">Sri Lanka (local)</option>
                <option value="international">International</option>
              </select>
              <p className="text-[11px] text-gray-400 mt-1">Controls public pricing and which merchants can subscribe.</p>
            </div>
          </div>

          <div className="border border-gray-100 rounded-xl p-4 space-y-4 bg-gray-50/80">
            <h4 className="text-sm font-semibold text-gray-900">Public pricing — ribbon tag & card colors</h4>
            <p className="text-xs text-gray-500">
              Optional ribbon above each plan on the marketing site. Card background can stay on the default theme, or use a solid color / gradient.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-gray-700 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.planTagShow}
                  onChange={(e) => setForm((f) => ({ ...f, planTagShow: e.target.checked }))}
                />
                Show tag on card
              </label>
            </div>
            {form.planTagShow && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Tag text</label>
                  <input
                    value={form.planTagText}
                    onChange={(e) => setForm((f) => ({ ...f, planTagText: e.target.value }))}
                    placeholder="e.g. Recommended, Popular, Best value"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tag text color</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={form.planTagTextColor}
                      onChange={(e) => setForm((f) => ({ ...f, planTagTextColor: e.target.value }))}
                      className="h-9 w-12 rounded border border-gray-300 cursor-pointer bg-white"
                    />
                    <input
                      value={form.planTagTextColor}
                      onChange={(e) => setForm((f) => ({ ...f, planTagTextColor: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tag background</label>
                  <select
                    value={form.planTagBgMode}
                    onChange={(e) => setForm((f) => ({ ...f, planTagBgMode: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="solid">Solid color</option>
                    <option value="gradient">Gradient</option>
                  </select>
                </div>
                {form.planTagBgMode === 'solid' ? (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tag color</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={form.planTagSolidColor}
                        onChange={(e) => setForm((f) => ({ ...f, planTagSolidColor: e.target.value }))}
                        className="h-9 w-12 rounded border border-gray-300 cursor-pointer bg-white"
                      />
                      <input
                        value={form.planTagSolidColor}
                        onChange={(e) => setForm((f) => ({ ...f, planTagSolidColor: e.target.value }))}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Gradient from</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={form.planTagGradFrom}
                          onChange={(e) => setForm((f) => ({ ...f, planTagGradFrom: e.target.value }))}
                          className="h-9 w-12 rounded border border-gray-300 cursor-pointer bg-white"
                        />
                        <input
                          value={form.planTagGradFrom}
                          onChange={(e) => setForm((f) => ({ ...f, planTagGradFrom: e.target.value }))}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Gradient to</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={form.planTagGradTo}
                          onChange={(e) => setForm((f) => ({ ...f, planTagGradTo: e.target.value }))}
                          className="h-9 w-12 rounded border border-gray-300 cursor-pointer bg-white"
                        />
                        <input
                          value={form.planTagGradTo}
                          onChange={(e) => setForm((f) => ({ ...f, planTagGradTo: e.target.value }))}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Angle (°)</label>
                      <input
                        type="number"
                        min={0}
                        max={360}
                        value={form.planTagGradAngle}
                        onChange={(e) => setForm((f) => ({ ...f, planTagGradAngle: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="border-t border-gray-200 pt-4 space-y-3">
              <label className="block text-xs text-gray-500 mb-1">Plan card background</label>
              <select
                value={form.planCardBgMode}
                onChange={(e) => setForm((f) => ({ ...f, planCardBgMode: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm max-w-md"
              >
                <option value="default">Default (featured tier uses navy gradient; others white)</option>
                <option value="solid">Solid color</option>
                <option value="gradient">Gradient</option>
              </select>
              {form.planCardBgMode === 'solid' && (
                <div className="max-w-md">
                  <label className="block text-xs text-gray-500 mb-1">Card color</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={form.planCardSolidColor}
                      onChange={(e) => setForm((f) => ({ ...f, planCardSolidColor: e.target.value }))}
                      className="h-9 w-12 rounded border border-gray-300 cursor-pointer bg-white"
                    />
                    <input
                      value={form.planCardSolidColor}
                      onChange={(e) => setForm((f) => ({ ...f, planCardSolidColor: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                    />
                  </div>
                </div>
              )}
              {form.planCardBgMode === 'gradient' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Gradient from</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={form.planCardGradFrom}
                        onChange={(e) => setForm((f) => ({ ...f, planCardGradFrom: e.target.value }))}
                        className="h-9 w-12 rounded border border-gray-300 cursor-pointer bg-white"
                      />
                      <input
                        value={form.planCardGradFrom}
                        onChange={(e) => setForm((f) => ({ ...f, planCardGradFrom: e.target.value }))}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Gradient to</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={form.planCardGradTo}
                        onChange={(e) => setForm((f) => ({ ...f, planCardGradTo: e.target.value }))}
                        className="h-9 w-12 rounded border border-gray-300 cursor-pointer bg-white"
                      />
                      <input
                        value={form.planCardGradTo}
                        onChange={(e) => setForm((f) => ({ ...f, planCardGradTo: e.target.value }))}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Angle (°)</label>
                    <input
                      type="number"
                      min={0}
                      max={360}
                      value={form.planCardGradAngle}
                      onChange={(e) => setForm((f) => ({ ...f, planCardGradAngle: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}
              {(form.planCardBgMode === 'solid' || form.planCardBgMode === 'gradient') && (
                <label className="text-sm text-gray-700 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.planCardUseLightText}
                    onChange={(e) => setForm((f) => ({ ...f, planCardUseLightText: e.target.checked }))}
                  />
                  Light text on card (use for dark backgrounds so copy stays readable)
                </label>
              )}
            </div>

            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4">
              <p className="text-xs font-medium text-gray-500 mb-3">Preview</p>
              <div
                className="relative mx-auto w-[220px] rounded-2xl min-h-[140px] p-4 pt-8 flex flex-col justify-center gap-1 shadow-sm overflow-visible border"
                style={{
                  ...(buildPlanCardBackground(previewPlan)
                    ? { background: buildPlanCardBackground(previewPlan) }
                    : previewPlan.isDefault
                      ? { background: 'linear-gradient(to bottom, #233d4d, #1a2f3f)', borderColor: 'rgba(250,114,55,0.45)' }
                      : { background: '#ffffff', borderColor: '#e5e7eb' }),
                }}
              >
                {previewPlan.planTagShow && (previewPlan.planTagText || '').trim() && buildPlanTagBackground(previewPlan) && (
                  <div
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-bold max-w-[200px] truncate shadow"
                    style={{
                      background: buildPlanTagBackground(previewPlan),
                      color: previewPlan.planTagTextColor || '#fff',
                    }}
                  >
                    {previewPlan.planTagText || 'Tag'}
                  </div>
                )}
                <span className={`relative text-xs font-semibold ${planUsesLightText(previewPlan) ? 'text-white/85' : 'text-gray-600'}`}>
                  Plan name
                </span>
                <span className={`relative text-lg font-extrabold ${planUsesLightText(previewPlan) ? 'text-white' : 'text-gray-900'}`}>
                  LKR 9,999
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Plan highlights (one line each — shown as bullets on the public pricing page)
            </label>
            <div className="space-y-2">
              {(form.featureLines || ['']).map((line, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    value={line}
                    onChange={(e) =>
                      setForm((f) => {
                        const next = [...(f.featureLines || [])];
                        next[i] = e.target.value;
                        return { ...f, featureLines: next };
                      })
                    }
                    placeholder="e.g. Unlimited terminals"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => {
                        const prev = f.featureLines || [''];
                        const next = prev.filter((_, j) => j !== i);
                        return { ...f, featureLines: next.length ? next : [''] };
                      })
                    }
                    className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 shrink-0"
                    aria-label="Remove line"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, featureLines: [...(f.featureLines || []), ''] }))}
              className="mt-2 text-xs font-medium text-brand-orange hover:underline"
            >
              + Add line
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm text-gray-700 flex items-center gap-2">
              <input type="checkbox" checked={form.isPublic} onChange={(e) => setForm((f) => ({ ...f, isPublic: e.target.checked }))} />
              Public
            </label>
            <label className="text-sm text-gray-700 flex items-center gap-2">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
              Enabled (disabled plans are hidden from merchants and public pricing by default)
            </label>
            <label className="text-sm text-gray-700 flex items-center gap-2">
              <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} />
              Default
            </label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saveMutation.isPending} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-semibold">
              {editingId ? <Save size={14} /> : <Plus size={14} />}
              {editingId ? 'Update plan' : 'Create plan'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700">
                Cancel edit
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-semibold text-gray-900">Defined Plans</h3>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Show</span>
              <select
                value={listStatus}
                onChange={(e) => onListStatusChange(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-800 bg-white"
              >
                <option value="active">Enabled only</option>
                <option value="inactive">Disabled only</option>
                <option value="all">All plans</option>
              </select>
            </label>
            <ViewModeToggle mode={viewMode} setMode={onViewModeChange} />
          </div>
        </div>
        {isLoading ? (
          <div className="p-6 text-sm text-gray-500">Loading plans...</div>
        ) : !plans.length ? (
          <div className="p-6 text-sm text-gray-500">
            {listStatus === 'active' && 'No enabled plans. Choose "Disabled only" or "All plans" to see disabled tiers.'}
            {listStatus === 'inactive' && 'No disabled plans.'}
            {listStatus === 'all' && 'No plans yet.'}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {plans.map((p) => (
              <div key={p._id} className="rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900">{p.name}</p>
                  {p.isDefault && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Default</span>}
                  {!p.isActive && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Disabled</span>}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {p.code} · {p.billingCycle} · {p.durationDays} days ·{' '}
                  <span className={p.planAudience === 'international' ? 'text-blue-700' : 'text-teal-700'}>
                    {p.planAudience === 'international' ? 'International' : 'Sri Lanka'}
                  </span>
                </p>
                <p className="text-sm text-gray-800 mt-2">{p.currency} {Number(p.amount).toLocaleString()}</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <button onClick={() => startEdit(p)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700">
                    Edit
                  </button>
                  {p.isActive && !p.isDefault && (
                    <button
                      type="button"
                      onClick={() => deactivateMutation.mutate(p._id)}
                      disabled={deactivateMutation.isPending}
                      className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Disable
                    </button>
                  )}
                  {!p.isActive && (
                    <button
                      type="button"
                      onClick={() => enableMutation.mutate(p._id)}
                      disabled={enableMutation.isPending}
                      className="px-3 py-1.5 text-xs rounded-lg border border-green-200 text-green-800 hover:bg-green-50 disabled:opacity-50"
                    >
                      Enable
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Name', 'Code', 'Cycle', 'Amount', 'Duration', 'Region', 'Enabled', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {plans.map((p) => (
                  <tr key={p._id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.code}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{p.billingCycle}</td>
                    <td className="px-4 py-3 text-gray-600">{p.currency} {Number(p.amount).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-600">{p.durationDays} days</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">
                      {p.planAudience === 'international' ? 'International' : 'Sri Lanka'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.isActive ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => startEdit(p)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700">
                          Edit
                        </button>
                        {p.isActive && !p.isDefault && (
                          <button
                            type="button"
                            onClick={() => deactivateMutation.mutate(p._id)}
                            disabled={deactivateMutation.isPending}
                            className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            Disable
                          </button>
                        )}
                        {!p.isActive && (
                          <button
                            type="button"
                            onClick={() => enableMutation.mutate(p._id)}
                            disabled={enableMutation.isPending}
                            className="px-3 py-1.5 text-xs rounded-lg border border-green-200 text-green-800 hover:bg-green-50 disabled:opacity-50"
                          >
                            Enable
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
