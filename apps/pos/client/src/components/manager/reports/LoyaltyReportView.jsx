import { useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../../../api/axios';
import { formatCurrency } from '../../../utils/format';
import { useStoreContext } from '../../../context/StoreContext';
import { exportToCsv } from '../../../utils/exportCsv';
import ResponsiveTable from '../../ResponsiveTable';

export default function LoyaltyReportView({ dateFrom, dateTo, registerExport }) {
  const { selectedStoreId } = useStoreContext();

  // Fetch Loyalty report data
  const { data: reportData, isPending } = useQuery({
    queryKey: ['report-loyalty', selectedStoreId, dateFrom, dateTo],
    queryFn: () =>
      api
        .get('/reports/extended/loyalty', {
          params: { since: `${dateFrom}T00:00:00`, until: `${dateTo}T23:59:59` },
        })
        .then((r) => r.data),
    enabled: Boolean(selectedStoreId && dateFrom && dateTo),
  });

  const isSubscribed = reportData?.isSubscribed ?? true;
  const summary = reportData?.summary || { pointsIssued: 0, pointsRedeemed: 0, redemptionDiscountTotal: 0, activeMembersCount: 0 };
  const trend = useMemo(() => reportData?.trend || [], [reportData]);

  // Expose export function to parent ReportsPortal
  useEffect(() => {
    if (registerExport && isSubscribed) {
      registerExport(() => {
        const headers = ['Date', 'Points Issued', 'Points Redeemed', 'Discount Cost ($)'];
        const rows = trend.map((d) => [
          d.date,
          d.issued,
          d.redeemed,
          d.discount.toFixed(2),
        ]);
        exportToCsv('loyalty_performance_report', headers, rows);
      });
    }
  }, [trend, registerExport, isSubscribed]);

  if (!isSubscribed) {
    return (
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl py-12 text-center text-slate-500 font-medium">
        This merchant is not currently subscribed to the Loyalty Program addon.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Points Issued</span>
          <div className="text-2xl font-black text-slate-200 mt-1 tabular-nums">{summary.pointsIssued}</div>
          <span className="text-[10px] text-slate-500">Total earned by customers</span>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Points Redeemed</span>
          <div className="text-2xl font-black text-slate-200 mt-1 tabular-nums">{summary.pointsRedeemed}</div>
          <span className="text-[10px] text-slate-500">Total burned for rewards</span>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Redemption Discounts</span>
          <div className="text-2xl font-black text-emerald-450 mt-1 tabular-nums">{formatCurrency(summary.redemptionDiscountTotal)}</div>
          <span className="text-[10px] text-slate-500">Monetary cost of points</span>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Active Members</span>
          <div className="text-2xl font-black text-slate-200 mt-1 tabular-nums">{summary.activeMembersCount}</div>
          <span className="text-[10px] text-slate-500">Unique transacting members</span>
        </div>
      </div>

      {/* Trend Graph */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
        <div className="mb-4">
          <h3 className="font-semibold text-slate-200">Points Accrual vs. Redemption</h3>
          <p className="text-xs text-slate-500">Daily activity tracker in period range</p>
        </div>

        {trend.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-sm text-slate-650">
            No activity trend data available
          </div>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}
                  labelStyle={{ color: '#94a3b8', fontWeight: 'bold', fontSize: 11 }}
                  itemStyle={{ fontSize: 11 }}
                />
                <Legend
                  verticalAlign="top"
                  height={36}
                  iconSize={10}
                  iconType="circle"
                  formatter={(value) => <span className="text-xs text-slate-400 font-semibold uppercase">{value === 'issued' ? 'Points Issued' : 'Points Redeemed'}</span>}
                />
                <Line type="monotone" dataKey="issued" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="redeemed" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Trend Data Grid */}
      <div className="flex flex-col gap-3">
        <h4 className="font-semibold text-slate-350 px-1">Daily Log Summary</h4>
        <style>{`
          .loyalty-scroll-table .hidden.sm\\:block {
            max-height: 360px;
            overflow-y: auto;
          }
          .loyalty-scroll-table th {
            position: sticky !important;
            top: 0 !important;
            z-index: 10;
          }
        `}</style>
        <ResponsiveTable
          className="loyalty-scroll-table"
          rows={[...trend].reverse()}
          rowKey={(item) => item.date}
          loading={isPending}
          skeletonRows={5}
          emptyState="No performance records found."
          columns={[
            {
              key: 'date',
              header: 'Date',
              mobilePrimary: true,
              render: (item) => <span className="text-slate-200 tabular-nums">{item.date}</span>,
            },
            {
              key: 'issued',
              header: 'Points Issued',
              className: 'text-right',
              headerClassName: 'text-right',
              render: (item) => <span className="tabular-nums font-semibold text-amber-500">{item.issued}</span>,
            },
            {
              key: 'redeemed',
              header: 'Points Redeemed',
              className: 'text-right',
              headerClassName: 'text-right',
              render: (item) => <span className="tabular-nums font-semibold text-emerald-400">{item.redeemed}</span>,
            },
            {
              key: 'discount',
              header: 'Redemption Discount Cost',
              className: 'text-right',
              headerClassName: 'text-right',
              render: (item) => <span className="tabular-nums text-slate-300 font-semibold">{formatCurrency(item.discount)}</span>,
            },
          ]}
        />
      </div>
    </div>
  );
}
