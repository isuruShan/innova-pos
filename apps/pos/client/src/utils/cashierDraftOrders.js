import { ORDER_TYPE_MAP } from '../components/OrderTypeBadge';

export const DRAFT_STORAGE_KEY = 'pos:cashier-drafts:v1';

export function createEmptyDraft() {
  return {
    id: crypto.randomUUID(),
    cart: [],
    orderType: 'dine-in',
    tableNumber: '',
    selectedTableId: '',
    reference: '',
    selectedCustomer: null,
    customerSearch: '',
    selectedPromoIds: [],
    autoApply: true,
    selectedLoyaltyRewardId: '',
  };
}

export function createDefaultStoreDrafts() {
  const draft = createEmptyDraft();
  return { activeDraftId: draft.id, drafts: [draft] };
}

export function readDraftStorage() {
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writeDraftStorage(allStores) {
  try {
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(allStores));
  } catch {
    /* quota / private mode */
  }
}

export function normalizeStoreDrafts(storeState) {
  if (!storeState?.drafts?.length) return createDefaultStoreDrafts();
  const drafts = storeState.drafts.map((d) => ({
    ...createEmptyDraft(),
    ...d,
    cart: Array.isArray(d.cart) ? d.cart : [],
    selectedPromoIds: Array.isArray(d.selectedPromoIds) ? d.selectedPromoIds : [],
  }));
  const activeDraftId = drafts.some((d) => d.id === storeState.activeDraftId)
    ? storeState.activeDraftId
    : drafts[0].id;
  return { activeDraftId, drafts };
}

export function draftItemCount(draft) {
  return (draft?.cart || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
}

export function draftLabel(draft, { tableLabel } = {}) {
  if (!draft) return 'New order';
  const count = draftItemCount(draft);
  const type = ORDER_TYPE_MAP[draft.orderType] || ORDER_TYPE_MAP['dine-in'];

  if (draft.orderType === 'dine-in') {
    const table = tableLabel || draft.tableNumber?.trim();
    if (table) return `Table ${table}${count ? ` · ${count}` : ''}`;
  }
  if (draft.orderType !== 'dine-in' && draft.reference?.trim()) {
    return `${draft.reference.trim()}${count ? ` · ${count}` : ''}`;
  }
  if (draft.selectedCustomer?.name) {
    return `${draft.selectedCustomer.name}${count ? ` · ${count}` : ''}`;
  }
  if (count > 0) return `${type.label} · ${count} item${count !== 1 ? 's' : ''}`;
  return `${type.label}`;
}

export function isDraftEmpty(draft) {
  return draftItemCount(draft) === 0
    && !draft.tableNumber?.trim()
    && !draft.selectedTableId
    && !draft.reference?.trim()
    && !draft.selectedCustomer
    && !draft.selectedLoyaltyRewardId
    && !(draft.selectedPromoIds?.length);
}
