import { useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../../../api/axios';
import { formatCurrency } from '../../../utils/format';
import { useStoreContext } from '../../../context/StoreContext';
import { exportToCsv } from '../../../utils/exportCsv';

export default function LoyaltyReportView({ dateFrom, dateTo, registerExport }) {
  const { selectedStoreId } = useStoreContext();

  // Fetch Loyalty report data
  const { data: reportData, isPending } = useQuery({
    queryKey: ['report-loyalty', selectedStoreId, dateFrom, dateTo],
    queryFn: () =>
      api
        .get('/reports/extended/loyalty', {
          params: { since: `${dateFrom}T00:00:00`, until: `${dateTo}T23:59:59` },
          headers: { 'x-store-id': selectedStoreId }
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
      <div className="bg-gray-50 border border-gray-250 rounded-xl py-12 text-center text-gray-400 font-medium animate-pulse">
        This merchant is not currently subscribed to the Loyalty Program addon.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block">Points Issued</span>
          <div className="text-xl font-black text-gray-800 mt-1 tabular-nums">{summary.pointsIssued}</div>
          <span className="text-[10px] text-gray-400">Total earned by customers</span>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block">Points Redeemed</span>
          <div className="text-xl font-black text-gray-800 mt-1 tabular-nums">{summary.pointsRedeemed}</div>
          <span className="text-[10px] text-gray-400">Total burned for rewards</span>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block">Redemption Discounts</span>
          <div className="text-xl font-black text-emerald-600 mt-1 tabular-nums">{formatCurrency(summary.redemptionDiscountTotal)}</div>
          <span className="text-[10px] text-gray-400">Monetary cost of points</span>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block">Active Members</span>
          <div className="text-xl font-black text-gray-800 mt-1 tabular-nums">{summary.activeMembersCount}</div>
          <span className="text-[10px] text-gray-400">Unique transacting members</span>
        </div>
      </div>

      {/* Trend Graph */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="mb-4">
          <h3 className="font-semibold text-gray-800">Points Accrual vs. Redemption</h3>
          <p className="text-xs text-gray-450">Daily activity tracker in period range</p>
        </div>

        {trend.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-sm text-gray-400">
            No activity trend data available
          </div>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8 }}
                  labelStyle={{ color: '#475569', fontWeight: 'bold', fontSize: 11 }}
                  itemStyle={{ fontSize: 11 }}
                />
                <Legend
                  verticalAlign="top"
                  height={36}
                  iconSize={10}
                  iconType="circle"
                  formatter={(value) => <span className="text-xs text-gray-500 font-semibold uppercase">{value === 'issued' ? 'Points Issued' : 'Points Redeemed'}</span>}
                />
                <Line type="monotone" dataKey="issued" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="redeemed" stroke="#0d9488" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Trend Data Grid */}
      <div className="space-y-3">
        <h4 className="font-semibold text-gray-700 px-1 text-sm">Daily Log Summary</h4>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[360px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 font-semibold">
                  <th className="px-4 py-3 sticky top-0 bg-gray-50 z-10">Date</th>
                  <th className="px-4 py-3 text-right sticky top-0 bg-gray-50 z-10">Points Issued</th>
                  <th className="px-4 py-3 text-right sticky top-0 bg-gray-50 z-10">Points Redeemed</th>
                  <th className="px-4 py-3 text-right sticky top-0 bg-gray-50 z-10">Redemption Discount Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {isPending ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-4 py-3.5"><div className="h-4 bg-gray-100 rounded w-16" /></td>
                      <td className="px-4 py-3.5 text-right"><div className="h-4 bg-gray-100 rounded w-12 ml-auto" /></td>
                      <td className="px-4 py-3.5 text-right"><div className="h-4 bg-gray-100 rounded w-12 ml-auto" /></td>
                      <td className="px-4 py-3.5 text-right"><div className="h-4 bg-gray-100 rounded w-16 ml-auto" /></td>
                    </tr>
                  ))
                ) : trend.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-gray-400 font-medium">
                      No performance records found.
                    </td>
                  </tr>
                ) : (
                  [...trend].reverse().map((item) => (
                    <tr key={item.date} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-mono text-gray-500">{item.date}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-amber-600">{item.issued}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-teal-650">{item.redeemed}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-800 font-semibold">{formatCurrency(item.discount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
