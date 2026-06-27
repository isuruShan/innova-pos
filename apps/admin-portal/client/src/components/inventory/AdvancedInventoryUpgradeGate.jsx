import { ShieldAlert, Check, Calendar, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getPublicWebUrl } from '@innovapos/app-urls';

export default function AdvancedInventoryUpgradeGate() {
  const navigate = useNavigate();

  return (
    <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-xl max-w-2xl mx-auto my-8 text-center space-y-6">
      <div className="mx-auto w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center border border-amber-500/20">
        <ShieldAlert size={28} />
      </div>

      <div className="space-y-2">
        <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full border border-amber-250">
          Paid Add-on Feature
        </span>
        <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight mt-2">
          Unlock MarketMan-style Advanced Inventory
        </h3>
        <p className="text-gray-500 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
          Streamline kitchen prep, audit physical shelf quantities, and execute location stock transfers with automated valuation reports.
        </p>
      </div>

      {/* Feature Bullet Points */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto text-left py-4">
        {[
          'Nested Sub-Recipes & Prep Batches',
          'Automatic Food Costing Calculations',
          'Multi-Unit Conversions (Buy kg, Use g)',
          'Shelf-to-Sheet Stocktake Sheets',
          'Theoretical vs Physical Variance Audits',
          'Inter-Store Stock Transfers',
        ].map((feature, i) => (
          <div key={i} className="flex items-center gap-2 text-xs font-semibold text-gray-700">
            <div className="w-4 h-4 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0 border border-green-200">
              <Check size={10} strokeWidth={3} />
            </div>
            {feature}
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
        <button
          type="button"
          onClick={() => navigate('/paid-addons')}
          className="flex items-center justify-center gap-1 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-2xl shadow-lg transition"
        >
          Activate Advanced Inventory <ArrowRight size={14} />
        </button>
        <a
          href={`${getPublicWebUrl()}/merchant-guide/advanced-inventory`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl border border-slate-200 transition"
        >
          View User Guide
        </a>
      </div>
    </div>
  );
}
