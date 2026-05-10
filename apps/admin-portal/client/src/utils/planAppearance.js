/** Build CSS background for optional plan ribbon tag */
export function buildPlanTagBackground(plan) {
  if (!plan?.planTagShow || !(plan.planTagText || '').trim()) return null;
  const mode = plan.planTagBgMode || 'solid';
  if (mode === 'gradient') {
    const a = Number(plan.planTagGradAngle);
    const angle = Number.isFinite(a) ? Math.min(360, Math.max(0, a)) : 135;
    const from = plan.planTagGradFrom || '#fa7237';
    const to = plan.planTagGradTo || '#233d4d';
    return `linear-gradient(${angle}deg, ${from}, ${to})`;
  }
  return plan.planTagSolidColor || '#fa7237';
}

/** Build CSS background for plan card; null = use themed defaults */
export function buildPlanCardBackground(plan) {
  const mode = plan.planCardBgMode || 'default';
  if (mode === 'gradient') {
    const a = Number(plan.planCardGradAngle);
    const angle = Number.isFinite(a) ? Math.min(360, Math.max(0, a)) : 145;
    const from = plan.planCardGradFrom || '#ffffff';
    const to = plan.planCardGradTo || '#f1f5f9';
    return `linear-gradient(${angle}deg, ${from}, ${to})`;
  }
  if (mode === 'solid') {
    return plan.planCardSolidColor || '#ffffff';
  }
  return null;
}

export function planUsesLightText(plan) {
  const mode = plan.planCardBgMode || 'default';
  if (mode === 'solid' || mode === 'gradient') {
    return Boolean(plan.planCardUseLightText);
  }
  if (plan.isDefault) return true;
  return false;
}
