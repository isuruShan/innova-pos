import { useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { useStoreContext } from '../../context/StoreContext';
import AdminDateField from '../../components/AdminDateField';

// Report views
import MenuMixView from '../../components/admin/reports/MenuMixView';
import OrderDistributionView from '../../components/admin/reports/OrderDistributionView';
import HourlySalesView from '../../components/admin/reports/HourlySalesView';
import PaymentReconciliationView from '../../components/admin/reports/PaymentReconciliationView';
import RefundsView from '../../components/admin/reports/RefundsView';
import CashSessionsView from '../../components/admin/reports/CashSessionsView';

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
  const { stores, selectedStoreId, selectStore, isStoreReady } = useStoreContext();
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{activeTitle}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Generate detailed business insights and download audit sheets.
          </p>
        </div>
        
        {/* Export Action */}
        {exportCallback && !rangeInvalid && isStoreReady && (
          <button
            onClick={() => exportCallback()}
            className="flex items-center justify-center gap-2 bg-brand-teal hover:bg-teal-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition shadow-sm cursor-pointer w-full sm:w-auto"
          >
            <Download size={15} />
            Export CSV
          </button>
        )}
      </div>

      {/* Global Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        {/* Store Selection */}
        <div className="md:col-span-4 space-y-1">
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            Store Selection
          </label>
          <select
            value={selectedStoreId}
            onChange={(e) => selectStore(e.target.value)}
            className="w-full bg-white border border-gray-300 text-gray-800 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-teal/30"
          >
            <option value="all">All Stores</option>
            {stores.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date range inputs */}
        <div className="md:col-span-5 space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Date Range
            </label>
            <div className="flex gap-1.5">
              {['today', '7d', '30d', 'month'].map((preset) => (
                <button
                  key={preset}
                  onClick={() => applyPreset(preset)}
                  className="text-[9px] uppercase tracking-wider font-semibold text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded transition cursor-pointer"
                >
                  {preset === '7d' ? '7 Days' : preset === '30d' ? '30 Days' : preset}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="w-full sm:flex-1">
              <AdminDateField
                value={dateFrom}
                onChange={setDateFrom}
                max={dateTo}
                className="w-full bg-white border border-gray-300 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-teal/30"
              />
            </div>
            <span className="text-gray-400 text-xs text-center sm:text-left">to</span>
            <div className="w-full sm:flex-1">
              <AdminDateField
                value={dateTo}
                onChange={setDateTo}
                min={dateFrom}
                className="w-full bg-white border border-gray-300 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-teal/30"
              />
            </div>
          </div>
        </div>

        <div className="md:col-span-3 text-right">
          {rangeInvalid && (
            <p className="text-red-650 text-xs font-semibold text-left">
              * Start date must be on/before end date.
            </p>
          )}
          {!rangeInvalid && dateFrom && dateTo && (
            <p className="text-[10px] font-mono text-gray-450 text-left md:text-right leading-tight">
              {dateFrom} to {dateTo}
            </p>
          )}
        </div>
      </div>

      {/* View render block */}
      {!isStoreReady || rangeInvalid ? (
        <div className="bg-white border border-gray-200 rounded-xl py-20 text-center text-gray-400">
          Please resolve filters or select a store to view analytics.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 shadow-sm">
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
  );
}
