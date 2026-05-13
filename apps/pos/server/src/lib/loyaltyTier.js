/**
 * @param {number} points
 * @param {Array<{ level: number, minLifetimePoints: number }>} tiers
 */
function tierFromPoints(points, tiers) {
  if (!tiers?.length) return null;
  const sorted = [...tiers].sort((a, b) => a.minLifetimePoints - b.minLifetimePoints);
  let match = sorted[0] || null;
  for (const t of sorted) {
    if (points >= t.minLifetimePoints) match = t;
  }
  return match;
}

/** Fallback when no tier row matches (never return null — callers use `.level`). */
const DEFAULT_TIER = { level: 1, minLifetimePoints: 0, name: 'Member' };

/**
 * Effective tier document for perks / min-tier checks.
 */
function getEffectiveTier(customer, tiers) {
  const safeTiers = Array.isArray(tiers) ? tiers.filter(Boolean) : [];
  if (!safeTiers.length) {
    return { ...DEFAULT_TIER };
  }
  const cust = customer || {};
  const pts = Math.max(0, Number(cust.lifetimePoints || 0));
  const ov = cust.loyaltyTierOverrideLevel;
  if (ov != null && ov !== '') {
    const forced = safeTiers.find((t) => Number(t.level) === Number(ov));
    if (forced) return forced;
  }
  const fromPoints = tierFromPoints(pts, safeTiers);
  if (fromPoints) return fromPoints;
  const low = lowestTier(safeTiers);
  return low || { ...DEFAULT_TIER, name: safeTiers[0]?.name || DEFAULT_TIER.name };
}

function lowestTier(tiers) {
  if (!tiers?.length) return null;
  return [...tiers].sort((a, b) => a.level - b.level)[0];
}

function rewardAppliesToLine(item, reward) {
  const ids = (reward.applicableItems || []).map((id) => String(id));
  const cats = reward.applicableCategories || [];
  if (!ids.length && !cats.length) return true;
  if (ids.includes(String(item.menuItem))) return true;
  if (item.category && cats.includes(item.category)) return true;
  return false;
}

function scopedSubtotal(cart, reward) {
  return cart
    .filter((i) => rewardAppliesToLine(i, reward))
    .reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 0), 0);
}

/**
 * Discount $ for one reward application.
 * - Scoped items/categories: percent/amount computed on matching lines only.
 * - Capped by remaining order total after earlier discounts, scoped line total, and maxDiscountAmount.
 */
function computeLoyaltyRewardDiscount(reward, cart, remainingOrderCap) {
  const cap = Math.max(0, remainingOrderCap);
  if (!reward || cap <= 0) return 0;
  const base = scopedSubtotal(cart, reward);
  if (base <= 0) return 0;

  const maxDisc =
    reward.maxDiscountAmount != null && Number(reward.maxDiscountAmount) > 0
      ? Number(reward.maxDiscountAmount)
      : Infinity;

  let raw = 0;
  switch (reward.rewardType) {
    case 'order_discount_amount':
      raw = Number(reward.discountAmount || 0);
      break;
    case 'order_discount_percent':
      raw = base * (Number(reward.discountPercent || 0) / 100);
      break;
    case 'free_item': {
      const mid = reward.freeMenuItem?.toString();
      if (!mid) return 0;
      const line = cart.find(
        (i) => i.menuItem?.toString() === mid && rewardAppliesToLine(i, reward),
      );
      if (!line) return 0;
      raw = Number(line.price || 0);
      break;
    }
    default:
      return 0;
  }

  raw = Math.min(raw, base, maxDisc, cap);
  return Math.round(Math.max(0, raw) * 100) / 100;
}

module.exports = {
  tierFromPoints,
  getEffectiveTier,
  lowestTier,
  computeLoyaltyRewardDiscount,
  rewardAppliesToLine,
  scopedSubtotal,
};
