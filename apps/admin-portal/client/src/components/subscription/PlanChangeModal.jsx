import { useState, useEffect } from 'react';
import { X, CheckCircle, Sparkles } from 'lucide-react';
import useSwipeDismiss from '../../hooks/useSwipeDismiss';

import { buildPlanCardBackground, buildPlanTagBackground, planUsesLightText } from '../../utils/planAppearance';

const ENTERPRISE_DISPLAY = {
  name: 'Custom',
  priceLabel: 'Tailored',
  cycle: 'custom pricing',
  lines: [
    'Custom registers limit',
    'Unlimited KDS screens',
    'Multi-branch HQ analytics',
    'Dedicated support manager',
    'API access integrations',
  ]
};

const pricingLinesForPlan = (plan) => {
  if (plan.featureLines?.length) return plan.featureLines;
  if (plan.code?.includes('standard')) {
    return [
      'Counter & Table POS registers',
      'Barista & Kitchen KDS screens',
      'Inventory cost mix insights',
      'Multi-terminal syncing',
    ];
  }
  return [
    'Counter & Table POS registers',
    'Barista & Kitchen KDS screens',
    'Inventory cost mix insights',
    'Multi-terminal syncing',
    'Premium features included',
  ];
};

export default function PlanChangeModal({ open, onClose, plans, currentPlanId, currentBillingCycle, onSelect, isPending }) {
  const [selected, setSelected] = useState('');
  const [selectedCycle, setSelectedCycle] = useState('monthly');
  const { style, bind } = useSwipeDismiss({ onClose, open });

  useEffect(() => {
    if (open) {
      setSelected(currentPlanId || '');
      setSelectedCycle(currentBillingCycle || 'monthly');
    }
  }, [open, currentPlanId, currentBillingCycle]);

  if (!open) return null;

  const handleConfirm = () => {
    if (!selected) return;
    onSelect({ planId: selected, billingCycle: selectedCycle });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close" />
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white rounded-2xl shadow-xl flex flex-col"
        {...bind}
        style={style}
      >
        <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mt-3 sm:hidden shrink-0" />
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
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Billing cycle toggle */}
          <div className="flex flex-col items-center gap-4">
            <div className="inline-flex rounded-xl border border-gray-250 p-1 bg-gray-50">
              <button
                type="button"
                onClick={() => setSelectedCycle('monthly')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer border-0 ${
                  selectedCycle === 'monthly'
                    ? 'bg-brand-orange text-white shadow-md'
                    : 'text-gray-550 hover:text-gray-700 bg-transparent'
                }`}
              >
                Monthly billing
              </button>
              <button
                type="button"
                onClick={() => setSelectedCycle('yearly')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer border-0 ${
                  selectedCycle === 'yearly'
                    ? 'bg-brand-orange text-white shadow-md'
                    : 'text-gray-550 hover:text-gray-700 bg-transparent'
                }`}
              >
                Yearly billing (Save)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {plans.map((plan) => {
              const isCurrent = String(plan._id) === String(currentPlanId) && selectedCycle === currentBillingCycle;
              const isSelected = String(plan._id) === String(selected);
              const bulletLines = pricingLinesForPlan(plan);
              const customCardBg = buildPlanCardBackground(plan);
              const lightOnCard = planUsesLightText(plan);
              const showRibbon = plan.planTagShow && String(plan.planTagText || '').trim();
              const ribbonBg = showRibbon ? buildPlanTagBackground(plan) : null;

              const price = selectedCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
              const displayPrice = `${plan.currency} ${price.toLocaleString()}`;

              let cardClass = `relative rounded-2xl p-6 border flex flex-col min-h-[350px] transition-all cursor-pointer hover:shadow-md ${
                isCurrent ? 'opacity-65 border-gray-200 cursor-default' : ''
              } ${
                isSelected
                  ? 'ring-2 ring-brand-orange border-transparent scale-[1.01]'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`;

              return (
                <div
                  key={plan._id}
                  className={cardClass}
                  style={customCardBg ? { background: customCardBg } : undefined}
                  onClick={() => !isCurrent && setSelected(plan._id)}
                >
                  {showRibbon && ribbonBg && (
                    <div
                      className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold shadow-sm max-w-[90%] truncate text-white"
                      style={{ background: ribbonBg }}
                    >
                      {plan.planTagText}
                    </div>
                  )}

                  <div className="flex justify-between items-start gap-2 mb-2">
                    <span className={`text-xs font-bold uppercase tracking-wider ${lightOnCard ? 'text-white/80' : 'text-gray-450'}`}>
                      {plan.name}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                        Active
                      </span>
                    )}
                  </div>
                  <div className={`text-2xl font-extrabold tracking-tight ${lightOnCard ? 'text-white' : 'text-gray-900'}`}>
                    {displayPrice}
                  </div>
                  <div className={`text-[10px] uppercase tracking-wider mb-6 ${lightOnCard ? 'text-white/60' : 'text-gray-400'}`}>
                    {selectedCycle === 'yearly' ? 'per year' : 'per month'}
                  </div>

                  <ul className="space-y-2 mb-6 flex-1">
                    {bulletLines.map((line, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <CheckCircle size={14} className="shrink-0 mt-0.5 text-brand-orange" />
                        <span className={lightOnCard ? 'text-white/90' : 'text-gray-650'}>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}

            {/* Custom plan card */}
            <div
              className={`relative rounded-2xl p-6 border flex flex-col min-h-[350px] transition-all cursor-pointer hover:shadow-md ${
                selected === 'custom'
                  ? 'ring-2 ring-brand-orange border-transparent scale-[1.01]'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
              onClick={() => setSelected('custom')}
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold bg-brand-orange text-white">
                Tailor-made
              </div>
              <div className="text-xs font-bold uppercase tracking-wider mb-2 text-gray-450">
                {ENTERPRISE_DISPLAY.name}
              </div>
              <div className="text-2xl font-extrabold tracking-tight text-gray-900">
                {ENTERPRISE_DISPLAY.priceLabel}
              </div>
              <div className="text-[10px] uppercase tracking-wider mb-6 text-gray-400">
                {ENTERPRISE_DISPLAY.cycle}
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {ENTERPRISE_DISPLAY.lines.map((line, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <CheckCircle size={14} className="shrink-0 mt-0.5 text-brand-orange" />
                    <span className="text-gray-650">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-white cursor-pointer">
            Cancel
          </button>
          <button
            type="button"
            disabled={!selected || isPending}
            onClick={handleConfirm}
            className="px-5 py-2 text-sm rounded-lg bg-brand-orange hover:bg-brand-orange-hover text-white font-semibold disabled:opacity-50 cursor-pointer"
          >
            {isPending ? 'Scheduling…' : 'Schedule plan change'}
          </button>
        </div>
      </div>
    </div>
  );
}
