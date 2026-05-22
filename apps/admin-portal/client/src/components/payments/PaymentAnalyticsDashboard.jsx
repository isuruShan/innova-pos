import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  TrendingUp, Clock, CheckCircle, XCircle,
  BarChart2, CalendarDays, ChevronDown, X,
} from 'lucide-react';
import api from '../../api/axios';
import { formatMoney } from '../billing/ProrationBreakdown';

// ─── Colour maps ────────────────────────────────────────────────────────────
const KIND_COLORS  = { subscription: '#6366f1', addon: '#a855f7', store: '#3b82f6', user_license: '#f59e0b' };
const KIND_LABELS  = { subscription: 'Subscription', addon: 'Add-on', store: 'Store', user_license: 'User seat' };
const METHOD_COLORS = { bank_transfer: '#10b981', stripe: '#6366f1', paypal: '#0ea5e9' };
const METHOD_LABELS = { bank_transfer: 'Bank transfer', stripe: 'Stripe', paypal: 'PayPal' };

// ─── Preset ranges ──────────────────────────────────────────────────────────
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

const PRESETS = [
  { id: 'all',       label: 'All time' },
  { id: '7d',        label: 'Last 7 days' },
  { id: '30d',       label: 'Last 30 days' },
  { id: 'this_month',label: 'This month' },
  { id: 'custom',    label: 'Custom range' },
];

function resolvePreset(id) {
  const now = new Date();
  if (id === 'all')       return { dateFrom: '', dateTo: '' };
  if (id === '7d')        return { dateFrom: isoDate(new Date(now - 6 * 86_400_000)), dateTo: isoDate(now) };
  if (id === '30d')       return { dateFrom: isoDate(new Date(now - 29 * 86_400_000)), dateTo: isoDate(now) };
  if (id === 'this_month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { dateFrom: isoDate(from), dateTo: isoDate(now) };
  }
  return null; // custom — caller sets dateFrom/dateTo
}

// ─── Sub-components ─────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'orange' }) {
  const palette = {
    orange: 'bg-orange-50 text-brand-orange',
    green:  'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red:    'bg-red-50 text-red-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <span className={`p-2.5 rounded-xl shrink-0 ${palette[color]}`}><Icon size={20} /></span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5 tabular-nums leading-none">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function SectionCard({ title, sub, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100">
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function CustomChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.dataKey === 'revenue'
            ? formatMoney('LKR', p.value)
            : `${p.value} payment${p.value !== 1 ? 's' : ''}`}
        </p>
      ))}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function PaymentAnalyticsDashboard({ onPendingClick }) {
  const [preset, setPreset]       = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');
  const [showCustom, setShowCustom] = useState(false);

  // Compute the API params for the selected range
  const { dateFrom, dateTo } = useMemo(() => {
    if (preset === 'custom') return { dateFrom: customFrom, dateTo: customTo };
    return resolvePreset(preset);
  }, [preset, customFrom, customTo]);

  const { data, isLoading } = useQuery({
    queryKey: ['payment-analytics', dateFrom, dateTo],
    queryFn: () => {
      const params = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo)   params.dateTo   = dateTo;
      return api.get('/subscriptions/receipts/analytics', { params }).then((r) => r.data);
    },
    staleTime: 60_000,
    keepPreviousData: true,
  });

  // ── Range label shown in the header ──────────────────────────────────────
  const rangeLabel = useMemo(() => {
    if (preset !== 'custom') return PRESETS.find((p) => p.id === preset)?.label || '';
    if (dateFrom && dateTo) return `${dateFrom} → ${dateTo}`;
    if (dateFrom) return `From ${dateFrom}`;
    if (dateTo)   return `Until ${dateTo}`;
    return 'Custom range';
  }, [preset, dateFrom, dateTo]);

  const t = data?.totals || {};
  const totalAll = (t.verified || 0) + (t.pending || 0) + (t.rejected || 0);

  const statusPie = [
    { name: 'Verified', value: t.verified || 0, color: '#10b981' },
    { name: 'Pending',  value: t.pending  || 0, color: '#f59e0b' },
    { name: 'Rejected', value: t.rejected || 0, color: '#ef4444' },
  ].filter((s) => s.value > 0);

  const methodPie = (data?.byMethod || []).map((m) => ({
    name:  METHOD_LABELS[m.method] || m.method,
    value: m.count,
    color: METHOD_COLORS[m.method] || '#94a3b8',
  }));

  const chartLabel = data?.granularity === 'day' ? 'Daily'
    : data?.granularity === 'week' ? 'Weekly' : 'Monthly';

  return (
    <div className="space-y-5">

      {/* ── Time range selector ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-sm font-medium text-gray-600 shrink-0">
            <CalendarDays size={15} className="text-brand-orange" />
            Time range:
          </span>

          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPreset(p.id);
                setShowCustom(p.id === 'custom');
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                preset === p.id
                  ? 'bg-brand-orange text-white shadow-sm'
                  : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}

          {preset !== 'all' && (
            <span className="ml-auto text-xs text-gray-400 italic">{rangeLabel}</span>
          )}
        </div>

        {/* Custom date inputs */}
        {(preset === 'custom' || showCustom) && (
          <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500 shrink-0">From</label>
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
              />
            </div>
            <span className="text-gray-400">→</span>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500 shrink-0">To</label>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
              />
            </div>
            {(customFrom || customTo) && (
              <button type="button" onClick={() => { setCustomFrom(''); setCustomTo(''); }}
                className="p-1 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Loading overlay with previous data showing */}
      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <BarChart2 size={14} className="animate-pulse text-brand-orange" />
          Updating analytics…
        </div>
      )}

      {/* ── Stat cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp}   label="Total revenue"   value={formatMoney('LKR', t.totalRevenue || 0)} sub={`${rangeLabel}`}   color="orange" />
        <StatCard icon={CheckCircle}  label="Verified"        value={(t.verified || 0).toLocaleString()} sub={`of ${totalAll} total`}  color="green"  />
        <StatCard icon={Clock}        label="Pending review"  value={(t.pending  || 0).toLocaleString()} sub={t.pending > 0 ? 'Needs attention' : 'Queue clear'} color={t.pending > 0 ? 'yellow' : 'green'} />
        <StatCard icon={XCircle}      label="Rejected"        value={(t.rejected || 0).toLocaleString()} sub={rangeLabel}              color="red"    />
      </div>

      {/* Pending CTA */}
      {(data?.pendingCount || 0) > 0 && (
        <button type="button" onClick={onPendingClick}
          className="w-full flex items-center justify-between px-5 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm hover:bg-amber-100 transition-colors">
          <span className="font-semibold text-amber-800 flex items-center gap-2">
            <Clock size={16} /> {data.pendingCount} receipt{data.pendingCount !== 1 ? 's' : ''} awaiting verification
          </span>
          <span className="text-amber-600 text-xs font-medium">Review now →</span>
        </button>
      )}

      {/* ── Revenue chart ────────────────────────────────────────────────── */}
      <SectionCard
        title={`${chartLabel} revenue`}
        sub={rangeLabel !== 'All time' ? rangeLabel : 'Last 12 months'}
      >
        {(data?.byPeriod || []).length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byPeriod} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="period" tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                interval={data.byPeriod.length > 20 ? Math.floor(data.byPeriod.length / 10) : 0} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip content={<CustomChartTooltip />} />
              <Bar dataKey="revenue" name="revenue" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-gray-400 text-center py-12">No verified payments in this period</p>
        )}
      </SectionCard>

      {/* ── Status + Method donuts ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="Payment status" sub={rangeLabel}>
          {statusPie.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusPie} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {statusPie.map((s) => <Cell key={s.name} fill={s.color} />)}
                </Pie>
                <Tooltip formatter={(v) => [`${v} receipts`]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 text-center py-12">No data in this period</p>
          )}
        </SectionCard>

        <SectionCard title="Payment method split" sub={rangeLabel}>
          {methodPie.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={methodPie} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {methodPie.map((m) => <Cell key={m.name} fill={m.color} />)}
                </Pie>
                <Tooltip formatter={(v) => [`${v} payments`]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 text-center py-12">No data in this period</p>
          )}
        </SectionCard>
      </div>

      {/* ── Revenue by item type ─────────────────────────────────────────── */}
      {(data?.byKind || []).length > 0 && (
        <SectionCard title="Revenue by item type" sub={rangeLabel}>
          <div className="space-y-3">
            {(data.byKind).map((k) => {
              const max = Math.max(...data.byKind.map((x) => x.revenue), 1);
              const pct = Math.round((k.revenue / max) * 100);
              return (
                <div key={k.kind} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-28 shrink-0">{KIND_LABELS[k.kind] || k.kind}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: KIND_COLORS[k.kind] || '#94a3b8' }} />
                  </div>
                  <span className="text-xs font-semibold text-gray-800 tabular-nums w-28 text-right shrink-0">
                    {formatMoney('LKR', k.revenue)}
                  </span>
                  <span className="text-xs text-gray-400 w-12 text-right shrink-0">{k.count} txn</span>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* ── Top merchants + Recent activity ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="Top merchants by revenue" sub={rangeLabel}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100">
                <th className="text-left pb-2 font-medium">#</th>
                <th className="text-left pb-2 font-medium">Merchant</th>
                <th className="text-right pb-2 font-medium">Revenue</th>
                <th className="text-right pb-2 font-medium">Txns</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(data?.topMerchants || []).map((m, i) => (
                <tr key={m._id} className="hover:bg-gray-50">
                  <td className="py-2 text-gray-400">{i + 1}</td>
                  <td className="py-2 font-medium text-gray-900 truncate max-w-[120px]">{m.name}</td>
                  <td className="py-2 text-right tabular-nums text-gray-800">{formatMoney('LKR', m.revenue)}</td>
                  <td className="py-2 text-right text-gray-500">{m.count}</td>
                </tr>
              ))}
              {!(data?.topMerchants?.length) && (
                <tr><td colSpan={4} className="py-8 text-center text-gray-400">No data in this period</td></tr>
              )}
            </tbody>
          </table>
        </SectionCard>

        <SectionCard title="Recent verified payments" sub={rangeLabel}>
          <div className="space-y-1">
            {(data?.recentActivity || []).map((r) => (
              <div key={r._id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate">{r.tenantId?.businessName || 'Unknown'}</p>
                  <p className="text-[11px] text-gray-400">
                    {new Date(r.verifiedAt || r.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </p>
                </div>
                <span className="text-xs font-bold text-green-700 tabular-nums ml-3 shrink-0">
                  {formatMoney(r.currency, r.amount)}
                </span>
              </div>
            ))}
            {!(data?.recentActivity?.length) && (
              <p className="text-xs text-gray-400 text-center py-8">No verified payments in this period</p>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
