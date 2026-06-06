import { useState } from 'react';
import { ChevronDown, ChevronUp, Users, Store, User, CreditCard, Layers } from 'lucide-react';

/**
 * Line-item breakdown for subscription renewal totals.
 * @param {{ plan?: { name: string, amount: number }, addons?: Array<{ code?: string, label: string, amount: number, quantity?: number }>, storesDetail?: Array<{ name: string, code: string, cost: number, isFree: boolean }>, usersDetail?: Array<{ name: string, email: string, role: string, cost: number, isFree: boolean }>, total: number, currency: string }} breakdown
 */
export default function BillingBreakdownPanel({ breakdown, hideOverview = false }) {
  if (!breakdown?.plan) return null;
  const { plan, addons = [], total, currency, storesDetail = [], usersDetail = [] } = breakdown;

  const [usersExpanded, setUsersExpanded] = useState(true);
  const [storesExpanded, setStoresExpanded] = useState(true);

  const otherAddons = addons.filter(
    (a) =>
      !a.code?.startsWith('user_license_') &&
      !a.code?.startsWith('user_extra_stores_') &&
      a.code !== 'additional_store'
  );

  const totalUsersCost = usersDetail.reduce((sum, u) => sum + (u.cost || 0), 0);
  const totalStoresCost = storesDetail.reduce((sum, s) => sum + (s.cost || 0), 0);
  const inactiveUsersCount = usersDetail.filter((u) => u.isActive === false).length;

  const formatRole = (role) => {
    if (!role) return '';
    return role
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const ROLE_BADGES = {
    superadmin: 'bg-red-50 text-red-700 border-red-100',
    merchant_admin: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    manager: 'bg-blue-50 text-blue-700 border-blue-100',
    cashier: 'bg-green-50 text-green-700 border-green-100',
    kitchen: 'bg-amber-50 text-amber-700 border-amber-100',
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      {!hideOverview && (
        <div className="bg-gradient-to-br from-gray-900 to-slate-800 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-brand-orange uppercase tracking-wider bg-brand-orange/10 px-2.5 py-1 rounded-full">
              Next Renewal Total
            </span>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight">{currency} {Number(total).toLocaleString()}</span>
              <span className="text-sm text-gray-300">/ month</span>
            </div>
            {plan.isScheduledChange && (
              <p className="text-xs text-brand-orange mt-2 bg-brand-orange/10 border border-brand-orange/20 rounded-lg py-1.5 px-3 inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-orange animate-ping" />
                Upcoming plan change — pricing reflects your next cycle.
              </p>
            )}
          </div>
          <div className="border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6 space-y-1">
            <p className="text-xs text-gray-400 font-medium">Plan Option</p>
            <p className="font-semibold text-lg text-white flex items-center gap-1.5">
              <CreditCard size={18} className="text-brand-orange" />
              {plan.name}
            </p>
          </div>
        </div>
      </div>
      )}

      {/* Break Down Details */}
      <div className="grid grid-cols-1 gap-6">
        {/* Base Subscription Fee & Other Addons */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 shadow-xs">
          <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2 border-b border-gray-100 pb-3">
            <Layers size={16} className="text-brand-orange" />
            Base Subscription & Platform Addons
          </h4>
          
          <div className="divide-y divide-gray-100">
            {/* Base Plan Line */}
            <div className="flex justify-between items-center py-2.5">
              <div className="min-w-0 pr-4">
                <p className="font-medium text-gray-900 text-sm">{plan.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">Includes core POS system and 1 free merchant admin seat.</p>
              </div>
              <span className="tabular-nums font-semibold text-gray-900 text-sm shrink-0">
                {currency} {Number(plan.amount).toLocaleString()}
              </span>
            </div>

            {/* Other general addons */}
            {otherAddons.map((line) => (
              <div key={line.code || line.label} className="flex justify-between items-center py-2.5">
                <div className="min-w-0 pr-4">
                  <p className="font-medium text-gray-800 text-sm">
                    {line.label}
                    {line.quantity > 1 ? ` (×${line.quantity})` : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Optional platform addon feature.</p>
                </div>
                <span className="tabular-nums font-semibold text-gray-800 text-sm shrink-0">
                  {currency} {Number(line.amount).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* User Seats Details */}
        {usersDetail.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => setUsersExpanded(!usersExpanded)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200 text-left hover:bg-gray-100/70 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <Users size={18} className="text-gray-400 group-hover:text-brand-orange transition-colors animate-fade-in" />
                <span className="font-semibold text-gray-900 text-sm">
                  User Seats ({usersDetail.length} total{inactiveUsersCount > 0 && `, ${inactiveUsersCount} inactive`})
                </span>
                {usersExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </div>
              <span className="tabular-nums font-bold text-gray-900 text-sm">
                {currency} {totalUsersCost.toLocaleString()}
              </span>
            </button>

            {usersExpanded && (
              <div className="divide-y divide-gray-100 p-2 space-y-1 bg-white">
                {usersDetail.map((u, i) => (
                  <div key={u.email || i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 hover:bg-gray-50/50 rounded-lg transition-colors">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-semibold text-xs shrink-0 border border-gray-200">
                        {u.name ? u.name.charAt(0).toUpperCase() : '?'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-gray-900 text-sm truncate">{u.name}</p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${ROLE_BADGES[u.role] || 'bg-gray-50 text-gray-600'}`}>
                            {formatRole(u.role)}
                          </span>
                          {u.isActive === false && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              Inactive — billed until removed
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{u.email}</p>
                        {u.extraStoreSlots > 0 && (
                          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-gray-400">
                            <Store size={10} />
                            <span>
                              Assigned to {u.extraStoreSlots + 1} stores ({u.extraStoreSlots} extra slots)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {u.isFree ? (
                        <span className="text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-0.5 rounded-full border border-green-100">
                          Included Free
                        </span>
                      ) : (
                        <div className="space-y-0.5">
                          <p className="tabular-nums font-semibold text-gray-950 text-sm">
                            {currency} {Number(u.cost).toLocaleString()}
                          </p>
                          {u.extraStoreSlots > 0 && (
                            <p className="text-[10px] text-gray-400">
                              Seat: {u.seatCost > 0 ? `${currency} ${u.seatCost.toLocaleString()}` : 'Free'} + Stores: {currency} {u.extraStoreSlotsCost.toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Store Locations Details */}
        {storesDetail.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => setStoresExpanded(!storesExpanded)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200 text-left hover:bg-gray-100/70 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <Store size={18} className="text-gray-400 group-hover:text-brand-orange transition-colors" />
                <span className="font-semibold text-gray-900 text-sm">Store Locations ({storesDetail.length} active)</span>
                {storesExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </div>
              <span className="tabular-nums font-bold text-gray-900 text-sm">
                {currency} {totalStoresCost.toLocaleString()}
              </span>
            </button>

            {storesExpanded && (
              <div className="divide-y divide-gray-100 p-2 space-y-1 bg-white">
                {storesDetail.map((s, i) => (
                  <div key={s.code || i} className="flex items-center justify-between p-3 hover:bg-gray-50/50 rounded-lg transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-brand-orange/5 flex items-center justify-center text-brand-orange shrink-0 border border-brand-orange/10">
                        <Store size={14} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 text-sm truncate">{s.name}</span>
                          {s.city && (
                            <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                              {s.city}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {s.isFree ? 'Primary store location' : 'Additional store branch'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {s.isFree ? (
                        <span className="text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-0.5 rounded-full border border-green-100">
                          Included Free
                        </span>
                      ) : (
                        <span className="tabular-nums font-semibold text-gray-950 text-sm">
                          {currency} {Number(s.cost).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
