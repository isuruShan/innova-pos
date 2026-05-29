import { useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import Navbar from '../../components/Navbar';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';
import { useStoreContext } from '../../context/StoreContext';
import PosDateField from '../../components/PosDateField';
import FilterPanel from '../../components/FilterPanel';

// Report views
import MenuMixView from '../../components/manager/reports/MenuMixView';
import OrderDistributionView from '../../components/manager/reports/OrderDistributionView';
import HourlySalesView from '../../components/manager/reports/HourlySalesView';
import PaymentReconciliationView from '../../components/manager/reports/PaymentReconciliationView';
import RefundsView from '../../components/manager/reports/RefundsView';
import CashSessionsView from '../../components/manager/reports/CashSessionsView';

function toYMD(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export default function ReportsPortal() {
  const { stores, selectedStoreId, isStoreReady } = useStoreContext();
  const selectedStore = stores.find((s) => s._id === selectedStoreId) || null;
  const { reportType } = useParams();

  // Date Range State (defaults to last 7 days)
  const defaultRange = useMemo(() => {
    const end = new Date();
    const start = addDays(end, -29);
    return { from: toYMD(start), to: toYMD(end) };
  }, []);

  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);

  // Callback registration for exporting CSV
  const [exportCallback, setExportCallback] = useState(null);

  const registerExport = useCallback((cb) => {
    setExportCallback(() => cb);
  }, []);

  const applyPreset = useCallback((preset) => {
    const end = new Date();
    const endStr = toYMD(end);
    if (preset === 'today') {
      setDateFrom(endStr);
      setDateTo(endStr);
    } else if (preset === '7d') {
      setDateFrom(toYMD(addDays(end, -6)));
      setDateTo(endStr);
    } else if (preset === '30d') {
      setDateFrom(toYMD(addDays(end, -29)));
      setDateTo(endStr);
    } else if (preset === 'month') {
      const start = new Date(end.getFullYear(), end.getMonth(), 1);
      setDateFrom(toYMD(start));
      setDateTo(endStr);
    }
  }, []);

  const rangeInvalid = dateFrom && dateTo && dateFrom > dateTo;

  // Map reportType to readable name
  const reportLabels = {
    'menu-mix': 'Menu Mix Report',
    'order-distribution': 'Order Channel Distribution',
    'hourly-sales': 'Hourly Sales Trends',
    'payment-reconciliation': 'Payment Reconciliation Summary',
    'refunds': 'Returns & Refunds Audit',
    'cash-sessions': 'Drawer Cash Sessions',
  };

  const activeTitle = reportLabels[reportType] || 'Business Reports';

  return (
    <div className="min-h-screen bg-[var(--pos-page-bg)]">
      <Navbar groups={MANAGER_NAV_GROUPS} />

      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--pos-text-primary)]">{activeTitle}</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Generate detailed business insights and download audit sheets.
            </p>
          </div>
          
          {/* Export Action */}
          {exportCallback && !rangeInvalid && isStoreReady && (
            <button
              onClick={() => exportCallback()}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold px-4 py-2 rounded-xl text-sm transition cursor-pointer"
            >
              <Download size={15} />
              Export CSV
            </button>
          )}
        </div>

        {/* Global Filter Bar */}
        <FilterPanel
          summary={rangeInvalid ? 'Invalid date range' : `${dateFrom} → ${dateTo}`}
        >
        <div className="bg-[var(--pos-panel)] rounded-2xl border border-slate-700/50 p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Store Info */}
          <div className="md:col-span-4 space-y-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Store Selection
            </label>
            <div className="bg-slate-950/60 border border-slate-700/50 rounded-xl px-3 py-2 text-slate-200 text-sm font-semibold">
              {selectedStore ? selectedStore.name : 'No store selected'}
            </div>
          </div>

          {/* Date range inputs */}
          <div className="md:col-span-5 space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Date Range
              </label>
              <div className="flex gap-1.5">
                {['today', '7d', '30d', 'month'].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => applyPreset(preset)}
                    className="text-[9px] uppercase tracking-wider font-semibold text-slate-500 hover:text-slate-250 bg-slate-800/40 hover:bg-slate-800 px-1.5 py-0.5 rounded transition cursor-pointer"
                  >
                    {preset === '7d' ? '7 Days' : preset === '30d' ? '30 Days' : preset}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <PosDateField
                  value={dateFrom}
                  onChange={setDateFrom}
                  max={dateTo}
                  className="w-full bg-slate-950/60 border border-slate-700/50 text-[var(--pos-text-primary)] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>
              <span className="text-slate-650 text-xs">to</span>
              <div className="flex-1">
                <PosDateField
                  value={dateTo}
                  onChange={setDateTo}
                  min={dateFrom}
                  className="w-full bg-slate-950/60 border border-slate-700/50 text-[var(--pos-text-primary)] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-3 text-right">
            {rangeInvalid && (
              <p className="text-red-400 text-xs font-semibold text-left">
                * Start date must be on/before end date.
              </p>
            )}
            {!rangeInvalid && dateFrom && dateTo && (
              <p className="text-[10px] font-mono text-slate-500 text-left md:text-right leading-tight">
                {dateFrom} to {dateTo}
              </p>
            )}
          </div>
        </div>
        </FilterPanel>

        {/* View render block */}
        {!isStoreReady || rangeInvalid ? (
          <div className="bg-[var(--pos-panel)] border border-slate-800 rounded-2xl py-20 text-center text-slate-500">
            Please resolve filters or select a store to view analytics.
          </div>
        ) : (
          <div className="bg-[var(--pos-panel)] border border-slate-700/40 rounded-2xl p-5 sm:p-6 shadow-xl">
            {reportType === 'menu-mix' && (
              <MenuMixView
                dateFrom={dateFrom}
                dateTo={dateTo}
                registerExport={registerExport}
              />
            )}
            {reportType === 'order-distribution' && (
              <OrderDistributionView
                dateFrom={dateFrom}
                dateTo={dateTo}
                registerExport={registerExport}
              />
            )}
            {reportType === 'hourly-sales' && (
              <HourlySalesView
                dateFrom={dateFrom}
                dateTo={dateTo}
                registerExport={registerExport}
              />
            )}
            {reportType === 'payment-reconciliation' && (
              <PaymentReconciliationView
                dateFrom={dateFrom}
                dateTo={dateTo}
                registerExport={registerExport}
              />
            )}
            {reportType === 'refunds' && (
              <RefundsView
                dateFrom={dateFrom}
                dateTo={dateTo}
                registerExport={registerExport}
              />
            )}
            {reportType === 'cash-sessions' && (
              <CashSessionsView
                dateFrom={dateFrom}
                dateTo={dateTo}
                registerExport={registerExport}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
