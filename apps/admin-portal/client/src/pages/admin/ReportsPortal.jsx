import { useState, useCallback, useMemo } from 'react';
import { Download, CalendarRange } from 'lucide-react';
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

  // Date Range State (defaults to last 7 days)
  const defaultRange = useMemo(() => {
    const end = new Date();
    const start = addDays(end, -6);
    return { from: toYMD(start), to: toYMD(end) };
  }, []);

  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);

  // Tabs & Navigation
  // Parent tabs: 'sales' | 'loss-prevention'
  const [activeParentTab, setActiveParentTab] = useState('sales');
  // Child tabs:
  // - For 'sales': 'menu-mix' | 'order-type' | 'hourly-sales' | 'payment-reconciliation'
  // - For 'loss-prevention': 'refunds' | 'cash-sessions'
  const [activeChildTab, setActiveChildTab] = useState('menu-mix');

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

  const handleParentTabChange = (tab) => {
    setActiveParentTab(tab);
    if (tab === 'sales') {
      setActiveChildTab('menu-mix');
    } else {
      setActiveChildTab('refunds');
    }
  };

  const rangeInvalid = dateFrom && dateTo && dateFrom > dateTo;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Reports Portal</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Generate detailed business insights and download audit sheets.
          </p>
        </div>
        
        {/* Export Action */}
        {exportCallback && !rangeInvalid && isStoreReady && (
          <button
            onClick={() => exportCallback()}
            className="flex items-center gap-2 bg-brand-teal hover:bg-teal-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition shadow-sm"
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
                  className="text-[9px] uppercase tracking-wider font-semibold text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded transition"
                >
                  {preset === '7d' ? '7 Days' : preset === '30d' ? '30 Days' : preset}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <AdminDateField
                value={dateFrom}
                onChange={setDateFrom}
                max={dateTo}
                className="w-full bg-white border border-gray-300 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-teal/30"
              />
            </div>
            <span className="text-gray-400 text-xs">to</span>
            <div className="flex-1">
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

      {/* Navigation Tabs */}
      <div className="space-y-4">
        {/* Main Parent Categories */}
        <div className="flex border-b border-gray-200 gap-6">
          <button
            onClick={() => handleParentTabChange('sales')}
            className={`pb-2.5 text-sm font-bold border-b-2 transition-all ${
              activeParentTab === 'sales'
                ? 'border-brand-teal text-brand-teal'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Sales Performance
          </button>
          <button
            onClick={() => handleParentTabChange('loss-prevention')}
            className={`pb-2.5 text-sm font-bold border-b-2 transition-all ${
              activeParentTab === 'loss-prevention'
                ? 'border-brand-teal text-brand-teal'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Loss Prevention & Operations
          </button>
        </div>

        {/* Sub Categories Tabs */}
        <div className="flex flex-wrap gap-2">
          {activeParentTab === 'sales' ? (
            <>
              <button
                onClick={() => setActiveChildTab('menu-mix')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  activeChildTab === 'menu-mix'
                    ? 'bg-brand-teal text-white border-brand-teal shadow-sm'
                    : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-300'
                }`}
              >
                Menu Mix
              </button>
              <button
                onClick={() => setActiveChildTab('order-type')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  activeChildTab === 'order-type'
                    ? 'bg-brand-teal text-white border-brand-teal shadow-sm'
                    : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-300'
                }`}
              >
                Order Distribution
              </button>
              <button
                onClick={() => setActiveChildTab('hourly-sales')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  activeChildTab === 'hourly-sales'
                    ? 'bg-brand-teal text-white border-brand-teal shadow-sm'
                    : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-300'
                }`}
              >
                Hourly Trends
              </button>
              <button
                onClick={() => setActiveChildTab('payment-reconciliation')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  activeChildTab === 'payment-reconciliation'
                    ? 'bg-brand-teal text-white border-brand-teal shadow-sm'
                    : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-300'
                }`}
              >
                Payment Reconciliation
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setActiveChildTab('refunds')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  activeChildTab === 'refunds'
                    ? 'bg-brand-teal text-white border-brand-teal shadow-sm'
                    : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-300'
                }`}
              >
                Returns & Refunds
              </button>
              <button
                onClick={() => setActiveChildTab('cash-sessions')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  activeChildTab === 'cash-sessions'
                    ? 'bg-brand-teal text-white border-brand-teal shadow-sm'
                    : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-300'
                }`}
              >
                Drawer Cash Sessions
              </button>
            </>
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
          {activeParentTab === 'sales' && activeChildTab === 'menu-mix' && (
            <MenuMixView
              dateFrom={dateFrom}
              dateTo={dateTo}
              registerExport={registerExport}
            />
          )}
          {activeParentTab === 'sales' && activeChildTab === 'order-type' && (
            <OrderDistributionView
              dateFrom={dateFrom}
              dateTo={dateTo}
              registerExport={registerExport}
            />
          )}
          {activeParentTab === 'sales' && activeChildTab === 'hourly-sales' && (
            <HourlySalesView
              dateFrom={dateFrom}
              dateTo={dateTo}
              registerExport={registerExport}
            />
          )}
          {activeParentTab === 'sales' && activeChildTab === 'payment-reconciliation' && (
            <PaymentReconciliationView
              dateFrom={dateFrom}
              dateTo={dateTo}
              registerExport={registerExport}
            />
          )}
          {activeParentTab === 'loss-prevention' && activeChildTab === 'refunds' && (
            <RefundsView
              dateFrom={dateFrom}
              dateTo={dateTo}
              registerExport={registerExport}
            />
          )}
          {activeParentTab === 'loss-prevention' && activeChildTab === 'cash-sessions' && (
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
