/**
 * Calculate discounts from a set of active promotions for a given set of cart items.
 *
 * Each item must have:
 *   { menuItem (id string/ObjectId), price, qty, category? (string) }
 *
 * Returns { applied: [{ promotion, name, type, discountAmount }], discountTotal }
 */

/**
 * An item is "in scope" for a promotion if:
 *   - both applicableItems and applicableCategories are empty  → whole order
 *   - item's ID is in applicableItems, OR
 *   - item's category is in applicableCategories
 */
function inScope(item, promo) {
  const ids  = (promo.applicableItems      || []).map(id => id.toString());
  const cats = (promo.applicableCategories || []);
  if (!ids.length && !cats.length) return true;
  if (ids.includes(item.menuItem?.toString())) return true;
  if (item.category && cats.includes(item.category)) return true;
  return false;
}

function applyPromotions(items, promotions) {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const applied = [];

  for (const promo of promotions) {
    let discountAmount = 0;

    switch (promo.type) {
      case 'bundle': {
        if (!promo.bundleItems?.length) break;
        const validItems = promo.bundleItems.filter(bi => bi.menuItem);
        if (validItems.length !== promo.bundleItems.length) break; // malformed promo
        const times = Math.min(
          ...validItems.map(bi => {
            const ci = items.find(i => i.menuItem?.toString() === bi.menuItem?.toString());
            return ci ? Math.floor(ci.qty / bi.qty) : 0;
          })
        );
        if (times <= 0) break;
        const normalPrice = validItems.reduce((sum, bi) => {
          const ci = items.find(i => i.menuItem?.toString() === bi.menuItem?.toString());
          return sum + (ci ? ci.price * bi.qty : 0);
        }, 0);
        discountAmount = Math.max(0, (normalPrice - promo.bundlePrice) * times);
        break;
      }

      case 'buyXgetY': {
        if (!promo.buyItem || !promo.getFreeItem) break;
        const buyItem  = items.find(i => i.menuItem?.toString() === promo.buyItem.toString());
        if (!buyItem || buyItem.qty < promo.buyQty) break;
        const freeItem = items.find(i => i.menuItem?.toString() === promo.getFreeItem.toString());
        if (!freeItem) break;
        const times = Math.floor(buyItem.qty / promo.buyQty);
        discountAmount = freeItem.price * promo.getFreeQty * times;
        break;
      }

      case 'flatPrice': {
        // Requires at least one item/category selector — no "whole order" flat price
        const ids  = (promo.applicableItems      || []).map(id => id.toString());
        const cats = (promo.applicableCategories || []);
        if (!ids.length && !cats.length) break;
        for (const item of items) {
          if (inScope(item, promo)) {
            const diff = (item.price - promo.flatPrice) * item.qty;
            if (diff > 0) discountAmount += diff;
          }
        }
        break;
      }

      case 'flatDiscount': {
        if (promo.minOrderAmount > 0 && subtotal < promo.minOrderAmount) break;
        const ids  = (promo.applicableItems      || []).map(id => id.toString());
        const cats = (promo.applicableCategories || []);
        if (ids.length || cats.length) {
          const base = items.filter(i => inScope(i, promo))
            .reduce((s, i) => s + i.price * i.qty, 0);
          discountAmount = Math.min(promo.discountAmount, base);
        } else {
          discountAmount = Math.min(promo.discountAmount, subtotal);
        }
        break;
      }

      case 'percentageDiscount': {
        if (promo.minOrderAmount > 0 && subtotal < promo.minOrderAmount) break;
        const ids  = (promo.applicableItems      || []).map(id => id.toString());
        const cats = (promo.applicableCategories || []);
        if (ids.length || cats.length) {
          const base = items.filter(i => inScope(i, promo))
            .reduce((s, i) => s + i.price * i.qty, 0);
          discountAmount = base * (promo.discountPercent / 100);
        } else {
          discountAmount = subtotal * (promo.discountPercent / 100);
        }
        break;
      }
    }

    if (discountAmount > 0.001) {
      applied.push({
        promotion:      promo._id,
        name:           promo.name,
        type:           promo.type,
        discountAmount: Math.round(discountAmount * 100) / 100,
      });
    }
  }

  const discountTotal = Math.round(
    applied.reduce((s, p) => s + p.discountAmount, 0) * 100
  ) / 100;

  return { applied, discountTotal };
}

module.exports = { applyPromotions };
