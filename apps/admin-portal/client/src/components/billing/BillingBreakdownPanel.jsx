import { useState } from 'react';
import { ChevronDown, ChevronUp, Users, Store, User } from 'lucide-react';

/**
 * Line-item breakdown for subscription renewal totals.
 * @param {{ plan?: { name: string, amount: number }, addons?: Array<{ code?: string, label: string, amount: number, quantity?: number }>, storesDetail?: Array<{ name: string, code: string, cost: number, isFree: boolean }>, usersDetail?: Array<{ name: string, email: string, role: string, cost: number, isFree: boolean }>, total: number, currency: string }} breakdown
 */
export default function BillingBreakdownPanel({ breakdown }) {
  if (!breakdown?.plan) return null;
  const { plan, addons = [], total, currency, storesDetail = [], usersDetail = [] } = breakdown;

  const [usersExpanded, setUsersExpanded] = useState(false);
  const [storesExpanded, setStoresExpanded] = useState(false);

  const otherAddons = addons.filter(
    (a) =>
      !a.code?.startsWith('user_license_') &&
      !a.code?.startsWith('user_extra_stores_') &&
      a.code !== 'additional_store'
  );

  const totalUsersCost = usersDetail.reduce((sum, u) => sum + (u.cost || 0), 0);
  const totalStoresCost = storesDetail.reduce((sum, s) => sum + (s.cost || 0), 0);

  const formatRole = (role) => {
    if (!role) return '';
    return role
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3 text-sm">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Billing breakdown</p>
      
      {plan.isScheduledChange ? (
        <p className="text-xs text-blue-800 bg-blue-50 border border-blue-100 rounded p-2">
          Upcoming plan change — totals use your next billing cycle.
        </p>
      ) : null}

      {/* Plan base row */}
      <div className="flex justify-between gap-4 text-gray-800 font-medium pb-1.5 border-b border-gray-200/50">
        <span>{plan.name} (Base Plan)</span>
        <span className="tabular-nums shrink-0">
          {currency} {Number(plan.amount).toLocaleString()}
        </span>
      </div>

      {/* Other general addons */}
      {otherAddons.length > 0 && (
        <div className="space-y-1.5">
          {otherAddons.map((line) => (
            <div key={line.code || line.label} className="flex justify-between gap-4 text-gray-700 pl-1">
              <span>
                {line.label}
                {line.quantity > 1 ? ` (×${line.quantity})` : ''}
              </span>
              <span className="tabular-nums shrink-0">
                {currency} {Number(line.amount).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* User Seats Accordion */}
      {usersDetail.length > 0 && (
        <div className="border border-gray-200/80 rounded-lg bg-white overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => setUsersExpanded(!usersExpanded)}
            className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50/80 transition-colors cursor-pointer group animate-fade-in"
          >
            <div className="flex items-center gap-2 text-gray-700">
              <Users size={16} className="text-gray-400 group-hover:text-brand-orange transition-colors" />
              <span className="font-medium">User Seats ({usersDetail.length} active)</span>
              {usersExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </div>
            <span className="tabular-nums font-medium text-gray-800">
              {currency} {totalUsersCost.toLocaleString()}
            </span>
          </button>
          
          {usersExpanded && (
            <div className="border-t border-gray-100 bg-gray-50/30 p-2.5 space-y-1.5">
              {usersDetail.map((u, i) => (
                <div key={u.email || i} className="flex justify-between items-start gap-4 text-xs text-gray-600 px-1 py-0.5 border-b border-gray-100/50 last:border-b-0">
                  <div className="flex items-start gap-1.5 min-w-0">
                    <User size={12} className="text-gray-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">{u.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {u.email} · {formatRole(u.role)}
                        {u.extraStoreSlots > 0 ? ` · ${u.extraStoreSlots} extra ${u.extraStoreSlots === 1 ? 'store' : 'stores'}` : ''}
                      </p>
                      {u.extraStoreSlots > 0 && (
                        <p className="text-[9px] text-gray-400 mt-0.5">
                          Seat: {u.seatCost > 0 ? `${currency} ${u.seatCost.toLocaleString()}` : 'Included'} · Stores: {currency} {u.extraStoreSlotsCost.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="tabular-nums shrink-0 font-medium text-gray-700">
                    {u.isFree ? 'Included' : `${currency} ${Number(u.cost).toLocaleString()}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Store Locations Accordion */}
      {storesDetail.length > 0 && (
        <div className="border border-gray-200/80 rounded-lg bg-white overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => setStoresExpanded(!storesExpanded)}
            className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50/80 transition-colors cursor-pointer group animate-fade-in"
          >
            <div className="flex items-center gap-2 text-gray-700">
              <Store size={16} className="text-gray-400 group-hover:text-brand-orange transition-colors" />
              <span className="font-medium">Store Locations ({storesDetail.length} active)</span>
              {storesExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </div>
            <span className="tabular-nums font-medium text-gray-800">
              {currency} {totalStoresCost.toLocaleString()}
            </span>
          </button>
          
          {storesExpanded && (
            <div className="border-t border-gray-100 bg-gray-50/30 p-2.5 space-y-1.5">
              {storesDetail.map((s, i) => (
                <div key={s.code || i} className="flex justify-between items-center gap-4 text-xs text-gray-600 px-1 py-0.5 border-b border-gray-100/50 last:border-b-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Store size={12} className="text-gray-400 shrink-0" />
                    <span className="font-medium text-gray-800 truncate">{s.name}</span>
                    <span className="text-[10px] text-gray-400 shrink-0">({s.code})</span>
                  </div>
                  <span className="tabular-nums shrink-0 font-medium text-gray-700">
                    {s.isFree ? 'Included' : `${currency} ${Number(s.cost).toLocaleString()}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Total row */}
      <div className="flex justify-between gap-4 pt-3.5 border-t border-gray-200 font-semibold text-gray-900 text-base">
        <span>Total due</span>
        <span className="tabular-nums">
          {currency} {Number(total).toLocaleString()}
        </span>
      </div>
    </div>
  );
}
