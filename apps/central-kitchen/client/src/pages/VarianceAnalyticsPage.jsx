import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Calendar, FileText, ArrowRight, Eye, ShieldAlert, ArrowDown, ArrowUp } from 'lucide-react';
import api from '../api/axios';
import { formatCurrency } from '../../../../admin-portal/client/src/utils/format';
import Badge from '../../../../admin-portal/client/src/components/Badge';
import ResponsiveTable from '../../../../admin-portal/client/src/components/ResponsiveTable';

export default function VarianceAnalyticsPage() {
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  // Fetch list of audit sessions (closed counts)
  const { data: sessions = [], isLoading: listLoading } = useQuery({
    queryKey: ['ck-variance-sessions'],
    queryFn: () => api.get('/variance-analytics').then((r) => r.data),
  });

  // Fetch detailed variance report for selected session
  const { data: activeSession, isLoading: detailLoading } = useQuery({
    queryKey: ['ck-variance-details', selectedSessionId],
    queryFn: () => api.get(`/variance-analytics/${selectedSessionId}`).then((r) => r.data),
    enabled: !!selectedSessionId,
  });

  if (listLoading) {
    return <div className="text-gray-400 text-center py-12">Loading audits list...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Overview header */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-start gap-4">
        <div className="p-3 bg-teal-500/10 text-teal-600 rounded-xl border border-teal-500/20">
          <BarChart3 size={24} />
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Audit Discrepancy Analytics</h2>
          <p className="text-xs text-gray-500 mt-1">
            Compare actual counted inventory levels against theoretical stock depletions (sales, branch shipments, recipe prep) to identify loss and processing variance.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        {/* Audit Sessions List (Left) */}
        <div className="lg:col-span-1 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">Completed Audits</h3>
          {sessions.length === 0 ? (
            <p className="text-gray-400 text-xs py-8 text-center">No completed audits found to analyze.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <button
                  key={session._id}
                  onClick={() => setSelectedSessionId(session._id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-2 ${
                    selectedSessionId === session._id
                      ? 'border-teal-500 bg-teal-500/5 ring-1 ring-teal-500'
                      : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-gray-800 truncate">{session.countSheetName}</span>
                    <Badge variant={session.metrics.totalVarianceCost >= 0 ? 'ok' : 'critical'}>
                      {session.metrics.totalVarianceCost >= 0 ? '+' : ''}
                      {formatCurrency(session.metrics.totalVarianceCost)}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between text-[11px] text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {new Date(session.endedAt).toLocaleDateString()}
                    </span>
                    <span>{session.metrics.totalItems} items counted</span>
                  </div>

                  {session.metrics.negativeVarianceCost > 0 && (
                    <div className="text-[10px] text-red-600 font-semibold flex items-center gap-1">
                      <ShieldAlert size={10} />
                      Loss: -{formatCurrency(session.metrics.negativeVarianceCost)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Audit Detailed Item Report (Right) */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedSessionId ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
              <FileText size={36} className="text-gray-300" />
              <p className="text-sm font-semibold">Select an audit from the left to view the detailed discrepancy breakdown.</p>
            </div>
          ) : detailLoading ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-400">
              Loading audit details...
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-150 pb-4">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">{activeSession.countSheetName}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Auditor: <span className="font-semibold text-gray-700">{activeSession.user}</span> · Ended on {new Date(activeSession.endedAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {activeSession.notes && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200/50 text-xs text-gray-600">
                  <strong>Notes:</strong> {activeSession.notes}
                </div>
              )}

              {/* Items Variance Table */}
              <ResponsiveTable
                columns={[
                  {
                    key: 'itemName',
                    header: 'Item',
                    className: 'font-semibold text-xs text-gray-900',
                  },
                  {
                    key: 'theoreticalQty',
                    header: 'Theoretical Stock',
                    className: 'text-right text-xs font-semibold text-slate-500',
                    headerClassName: 'text-right',
                    render: (item) => `${item.theoreticalQty} ${item.unit}`,
                  },
                  {
                    key: 'countedQty',
                    header: 'Actual Count',
                    className: 'text-right text-xs font-bold text-slate-800',
                    headerClassName: 'text-right',
                    render: (item) => `${item.countedQty} ${item.unit}`,
                  },
                  {
                    key: 'variance',
                    header: 'Discrepancy (Qty)',
                    className: 'text-right text-xs font-bold',
                    headerClassName: 'text-right',
                    render: (item) => {
                      const color = item.variance > 0 ? 'text-green-500' : item.variance < 0 ? 'text-red-500' : 'text-gray-400';
                      return (
                        <span className={`inline-flex items-center gap-1 ${color}`}>
                          {item.variance > 0 ? <ArrowUp size={12} /> : item.variance < 0 ? <ArrowDown size={12} /> : null}
                          {item.variance > 0 ? '+' : ''}{item.variance} {item.unit}
                        </span>
                      );
                    }
                  },
                  {
                    key: 'percentageDiscrepancy',
                    header: 'Discrepancy (%)',
                    className: 'text-right text-xs font-semibold',
                    headerClassName: 'text-right',
                    render: (item) => {
                      const color = item.variance > 0 ? 'text-green-500' : item.variance < 0 ? 'text-red-500' : 'text-gray-400';
                      return (
                        <span className={color}>
                          {item.variance > 0 ? '+' : ''}{item.percentageDiscrepancy}%
                        </span>
                      );
                    }
                  },
                  {
                    key: 'varianceCost',
                    header: 'Financial Impact',
                    className: 'text-right text-xs font-bold',
                    headerClassName: 'text-right',
                    render: (item) => {
                      const color = item.varianceCost > 0 ? 'text-green-500' : item.varianceCost < 0 ? 'text-red-500' : 'text-gray-400';
                      return (
                        <span className={color}>
                          {item.varianceCost > 0 ? '+' : ''}{formatCurrency(item.varianceCost)}
                        </span>
                      );
                    }
                  }
                ]}
                data={activeSession.items || []}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
