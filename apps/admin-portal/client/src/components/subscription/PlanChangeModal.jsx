import { useState } from 'react';
import { X, Check, Sparkles } from 'lucide-react';
import { buildPlanCardBackground, buildPlanTagBackground, planUsesLightText } from '../../utils/planAppearance';

export default function PlanChangeModal({ open, onClose, plans, currentPlanId, onSelect, isPending }) {
  const [selected, setSelected] = useState('');

  if (!open) return null;

  const handleConfirm = () => {
    if (!selected) return;
    onSelect(selected);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close" />
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden bg-white rounded-2xl shadow-xl flex flex-col">
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Sparkles size={20} className="text-brand-orange" />
              Change subscription plan
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Choose a plan. Your new plan takes effect after the current billing period unless you pay to activate sooner.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Available plans</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {plans.map((plan) => {
              const isCurrent = String(plan._id) === String(currentPlanId);
              const isSelected = String(plan._id) === String(selected);
              const light = planUsesLightText(plan);
              const cardBg = buildPlanCardBackground(plan);
              const tagBg = buildPlanTagBackground(plan);

              return (
                <button
                  key={plan._id}
                  type="button"
                  disabled={isCurrent}
                  onClick={() => setSelected(plan._id)}
                  className={`text-left rounded-xl border-2 p-4 transition-all ${
                    isCurrent ? 'opacity-60 cursor-not-allowed border-gray-200' : ''
                  } ${isSelected ? 'border-brand-orange ring-2 ring-brand-orange/30' : 'border-gray-200 hover:border-brand-orange/50'}`}
                  style={{ background: cardBg }}
                >
                  <div className={`flex items-start justify-between gap-2 ${light ? 'text-white' : 'text-gray-900'}`}>
                    <div>
                      {plan.planTagShow && plan.planTagText && (
                        <span
                          className="inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded mb-2"
                          style={{ background: tagBg, color: plan.planTagTextColor || '#fff' }}
                        >
                          {plan.planTagText}
                        </span>
                      )}
                      <h3 className="font-bold text-lg">{plan.name}</h3>
                      <p className={`text-sm mt-1 ${light ? 'text-white/80' : 'text-gray-600'}`}>
                        {plan.currency} {Number(plan.amount).toLocaleString()} / {plan.billingCycle || 'period'}
                      </p>
                    </div>
                    {isSelected && <Check className="text-brand-orange shrink-0" size={22} />}
                    {isCurrent && (
                      <span className="text-xs font-semibold bg-black/20 px-2 py-0.5 rounded">Current</span>
                    )}
                  </div>
                  <ul className={`mt-3 space-y-1 text-sm ${light ? 'text-white/90' : 'text-gray-700'}`}>
                    {(plan.featureLines || []).filter(Boolean).slice(0, 5).map((line, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <Check size={14} className="shrink-0 mt-0.5" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-white">
            Cancel
          </button>
          <button
            type="button"
            disabled={!selected || isPending}
            onClick={handleConfirm}
            className="px-5 py-2 text-sm rounded-lg bg-brand-orange text-white font-semibold disabled:opacity-50"
          >
            {isPending ? 'Scheduling…' : 'Schedule plan change'}
          </button>
        </div>
      </div>
    </div>
  );
}
