/**
 * @param {number} points
 * @param {Array<{ level: number, minLifetimePoints: number }>} tiers
 */
function tierFromPoints(points, tiers) {
  const sorted = [...tiers].sort((a, b) => a.minLifetimePoints - b.minLifetimePoints);
  let match = sorted[0] || null;
  for (const t of sorted) {
    if (points >= t.minLifetimePoints) match = t;
  }
  return match;
}

/**
 * Effective tier document for perks / min-tier checks.
 */
function getEffectiveTier(customer, tiers) {
  const pts = Math.max(0, Number(customer.lifetimePoints || 0));
  const ov = customer.loyaltyTierOverrideLevel;
  if (ov != null && ov !== '') {
    const forced = tiers.find((t) => t.level === ov);
    if (forced) return forced;
  }
  return tierFromPoints(pts, tiers);
}

function lowestTier(tiers) {
  if (!tiers?.length) return null;
  return [...tiers].sort((a, b) => a.level - b.level)[0];
}

/**
 * Discount $ from cart after promotions, before tax (same basis as promo discounts).
 */
function computeLoyaltyRewardDiscount(reward, cart, discountedSubtotalAfterPromos) {
  const cap = Math.max(0, discountedSubtotalAfterPromos);
  if (!reward || cap <= 0) return 0;
  switch (reward.rewardType) {
    case 'order_discount_amount': {
      const d = Number(reward.discountAmount || 0);
      return Math.min(Math.max(0, d), cap);
    }
    case 'order_discount_percent': {
      const p = Number(reward.discountPercent || 0);
      return Math.min(cap * (p / 100), cap);
    }
    case 'free_item': {
      const mid = reward.freeMenuItem?.toString();
      if (!mid) return 0;
      const line = cart.find((i) => i.menuItem?.toString() === mid);
      if (!line) return 0;
      return Math.min(Number(line.price || 0), cap);
    }
    default:
      return 0;
  }
}

module.exports = {
  tierFromPoints,
  getEffectiveTier,
  lowestTier,
  computeLoyaltyRewardDiscount,
};
