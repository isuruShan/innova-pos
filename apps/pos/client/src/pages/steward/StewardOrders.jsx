import { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useStoreContext } from '../../context/StoreContext';
import { useCashierDraftOrders } from '../../context/CashierDraftOrdersContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { formatCurrency } from '../../utils/format';
import { buildCategoryTabs, resolveMenuDisplayItems, buildCategorySortMap } from '../../utils/menuItemSearch';
import { getPublicWebUrl } from '@innovapos/app-urls';
import { Search, Plus, Minus, Trash2, Tag, Gift, ChevronLeft, Save } from 'lucide-react';
import VariantSelectorModal from '../../components/VariantSelectorModal';

const getFallbackGradient = (name) => {
  const gradients = [
    'from-amber-400 to-orange-500',
    'from-rose-400 to-pink-500',
    'from-emerald-400 to-teal-500',
    'from-sky-400 to-indigo-500',
    'from-violet-400 to-purple-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
};

export default function StewardOrders() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const { drafts, activeDraftId, activeDraft, patchActiveDraft, clearActiveDraftAfterSubmit } = useCashierDraftOrders(selectedStoreId);

  // We check if we are editing an existing placed order passed via route state
  const editOrderId = location.state?.editOrderId;

  const [activeCategory, setActiveCategory] = useState('All');
  const [menuSearch, setMenuSearch] = useState('');
  const [variantSelectionItem, setVariantSelectionItem] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);

  // If editing an existing order, we store its data locally
  const [existingOrder, setExistingOrder] = useState(null);
  const [localCart, setLocalCart] = useState([]);

  // Fetch menu data
  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu', selectedStoreId],
    queryFn: () => api.get('/menu').then(r => r.data),
    enabled: isStoreReady,
  });

  const { data: categoryRows = [] } = useQuery({
    queryKey: ['categories', selectedStoreId],
    queryFn: () => api.get('/categories').then((r) => r.data),
    enabled: isStoreReady,
  });

  // Fetch existing order if we are appending
  useEffect(() => {
    if (editOrderId && isStoreReady) {
      const savedKey = `steward_append_${selectedStoreId}_${editOrderId}`;
      const savedCart = localStorage.getItem(savedKey);

      api.get(`/orders/${editOrderId}`).then((res) => {
        setExistingOrder(res.data);
        
        if (savedCart) {
          try {
            setLocalCart(JSON.parse(savedCart));
            return;
          } catch (e) {
            console.error("Error parsing saved cart", e);
          }
        }

        const mappedCart = (res.data.items || []).map(i => ({
          ...i,
          isExisting: true // Flag to know it was already sent to kitchen
        }));
        setLocalCart(mappedCart);
      }).catch(err => {
        console.error("Failed to fetch order", err);
        alert("Failed to load order for editing");
        navigate('/steward/tables');
      });
    }
  }, [editOrderId, isStoreReady, navigate, selectedStoreId]);

  // Persist append cart changes
  useEffect(() => {
    if (editOrderId && isStoreReady && localCart.length > 0) {
      localStorage.setItem(`steward_append_${selectedStoreId}_${editOrderId}`, JSON.stringify(localCart));
    }
  }, [localCart, editOrderId, selectedStoreId, isStoreReady]);

  // Sync draft logic
  const cart = editOrderId ? localCart : activeDraft.cart;
  const tableId = editOrderId ? existingOrder?.tableId : activeDraft.selectedTableId;
  const tableLabel = editOrderId ? existingOrder?.tableNumber : activeDraft.tableNumber;
  const guestsCount = editOrderId ? existingOrder?.guestsCount : activeDraft.guestsCount;

  const setCart = (updater) => {
    if (editOrderId) {
      setLocalCart(updater);
    } else {
      patchActiveDraft(prev => ({
        ...prev,
        cart: typeof updater === 'function' ? updater(prev.cart) : updater
      }));
    }
  };

  const categories = useMemo(() => buildCategoryTabs(categoryRows, menuItems), [categoryRows, menuItems]);
  const sortedMenuItems = useMemo(() => {
    return resolveMenuDisplayItems(menuItems, {
      activeCategory,
      menuSearch,
      categorySortMap: buildCategorySortMap(categoryRows),
    });
  }, [menuItems, activeCategory, menuSearch, categoryRows]);

  const getItemPrice = (menuItem, variant) => {
    return variant ? Number(variant.price) : Number(menuItem.price);
  };

  const addToCart = (menuItem, selectedVariant = null) => {
    if (menuItem.hasVariants && !selectedVariant) {
      setVariantSelectionItem(menuItem);
      return;
    }
    const price = getItemPrice(menuItem, selectedVariant);
    const variantId = selectedVariant ? selectedVariant._id : null;
    const variantName = selectedVariant ? selectedVariant.name : '';
    const variantAttributes = selectedVariant ? selectedVariant.attributes || [] : [];

    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (i) => String(i.menuItem) === String(menuItem._id) && String(i.variantId || '') === String(variantId || '') && !i.isExisting
      );
      if (existingIndex !== -1) {
        return prev.map((item, idx) =>
          idx === existingIndex ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, {
        menuItem: menuItem._id,
        name: menuItem.name,
        price,
        qty: 1,
        isCombo: menuItem.isCombo || false,
        comboItems: menuItem.comboItems || [],
        variantId,
        variantName,
        variantAttributes,
        isExisting: false,
      }];
    });
    setVariantSelectionItem(null);
  };

  const updateQty = (index, delta) => {
    setCart((prev) => {
      const row = prev[index];
      if (!row) return prev;
      
      // Steward rule: cannot remove or decrease existing items
      if (row.isExisting) {
        // Technically they shouldn't even have buttons, but just in case:
        return prev;
      }

      const q = row.qty + delta;
      if (q <= 0) return prev.filter((_, i) => i !== index);
      return prev.map((r, i) => (i === index ? { ...r, qty: q } : r));
    });
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const placeOrderMutation = useMutation({
    mutationFn: (data) => api.post('/orders', data),
    onSuccess: () => {
      clearActiveDraftAfterSubmit();
      navigate('/steward/tables');
    },
    onError: (err) => alert(err.response?.data?.message || 'Failed to place order'),
  });

  const appendOrderMutation = useMutation({
    mutationFn: (data) => api.put(`/orders/${editOrderId}`, data),
    onSuccess: () => {
      localStorage.removeItem(`steward_append_${selectedStoreId}_${editOrderId}`);
      navigate('/steward/tables');
    },
    onError: (err) => alert(err.response?.data?.message || 'Failed to append to order'),
  });

  const handleFireToKitchen = () => {
    if (cart.length === 0) return;
    if (editOrderId) {
      appendOrderMutation.mutate({
        orderType: 'dine-in',
        tableId,
        tableNumber: tableLabel,
        guestsCount: guestsCount || null,
        items: cart.map(i => ({
          menuItem: i.menuItem,
          qty: i.qty,
          variantId: i.variantId || null,
          variantName: i.variantName || '',
          variantAttributes: i.variantAttributes || [],
          ...(i._id ? { _id: i._id } : {}),
        })),
      });
    } else {
      placeOrderMutation.mutate({
        orderType: 'dine-in',
        tableId,
        tableNumber: tableLabel,
        guestsCount: guestsCount || null,
        items: cart.map(i => ({
          menuItem: i.menuItem,
          qty: i.qty,
          variantId: i.variantId || null,
          variantName: i.variantName || '',
          variantAttributes: i.variantAttributes || [],
        })),
      });
    }
  };

  const isPending = placeOrderMutation.isPending || appendOrderMutation.isPending;
  const newItemsCount = editOrderId ? cart.filter(i => !i.isExisting).length : cart.length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/steward/tables')} className="text-gray-500 p-1 bg-gray-100 rounded-full">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="font-bold text-gray-900">{tableLabel ? `Table ${tableLabel}` : 'Take Order'}</h1>
            <p className="text-xs text-amber-600 font-semibold">{editOrderId ? 'Appending to Order' : 'New Draft'}</p>
          </div>
        </div>
        <button 
          onClick={() => setCartOpen(true)}
          className="relative p-2 bg-amber-500 text-white rounded-full shadow-md"
        >
          <Search size={20} className="hidden" /> {/* just keeping spacing if needed, replaced by cart below */}
          <span className="font-bold text-sm px-1">Cart ({cart.reduce((s,i) => s + i.qty, 0)})</span>
        </button>
      </div>

      {/* Menu Categories */}
      <div className="bg-white border-b border-gray-200 py-2 px-4 shrink-0 overflow-x-auto whitespace-nowrap hide-scrollbar">
        <div className="flex gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                activeCategory === c
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pb-20">
          {sortedMenuItems.map((item) => (
            <button
              key={item._id}
              onClick={() => addToCart(item)}
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col text-left active:scale-95 transition-transform"
            >
              <div className="aspect-square bg-gray-100 relative">
                {item.image ? (
                  <img src={getPublicWebUrl(item.image)} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${getFallbackGradient(item.name)} flex flex-col items-center justify-center text-white p-3 text-center`}>
                    <span className="text-3xl filter drop-shadow">
                      {item.categoryName?.toLowerCase().includes('drink') || item.name.toLowerCase().includes('drink') || item.name.toLowerCase().includes('coke') || item.name.toLowerCase().includes('juice') ? '🥤' :
                       item.categoryName?.toLowerCase().includes('dessert') || item.name.toLowerCase().includes('cake') || item.name.toLowerCase().includes('ice') ? '🍰' :
                       item.categoryName?.toLowerCase().includes('pizza') || item.name.toLowerCase().includes('pizza') ? '🍕' :
                       item.categoryName?.toLowerCase().includes('burger') || item.name.toLowerCase().includes('burger') ? '🍔' : '🍽️'}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider mt-1 opacity-90 truncate max-w-full">
                      {item.categoryName || 'Menu'}
                    </span>
                  </div>
                )}
                {item.hasVariants && (
                  <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">Variants</span>
                )}
              </div>
              <div className="p-3">
                <p className="font-bold text-sm text-gray-900 line-clamp-2">{item.name}</p>
                <p className="text-amber-600 font-semibold text-xs mt-1">{formatCurrency(item.price)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart Slide-Up Overlay */}
      {cartOpen && (
        <div className="absolute inset-0 z-50 flex flex-col bg-black/50">
          <div className="flex-1" onClick={() => setCartOpen(false)} />
          <div className="bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="font-bold text-lg">Order Summary</h2>
              <button onClick={() => setCartOpen(false)} className="text-gray-500 bg-gray-100 rounded-full p-1.5">
                <ChevronLeft size={20} className="rotate-[-90deg]" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <p className="text-center text-gray-400 py-8">Cart is empty</p>
              ) : (
                cart.map((item, idx) => (
                  <div key={idx} className="flex gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-900 truncate">
                        {item.name} {item.variantName ? `(${item.variantName})` : ''}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{formatCurrency(item.price)}</p>
                      {item.isExisting && (
                        <span className="inline-block mt-1 bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded font-semibold">
                          Already Sent
                        </span>
                      )}
                    </div>
                    
                    {item.isExisting ? (
                      <div className="flex items-center text-gray-400 font-bold px-3">
                        x{item.qty}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button onClick={() => updateQty(idx, -1)} className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-red-500 shadow-sm active:bg-gray-50">
                          {item.qty === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
                        </button>
                        <span className="font-bold w-4 text-center text-sm">{item.qty}</span>
                        <button onClick={() => updateQty(idx, 1)} className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-sm active:bg-amber-600">
                          <Plus size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-white space-y-3 pb-safe">
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-amber-600">{formatCurrency(subtotal)}</span>
              </div>
              <button
                onClick={handleFireToKitchen}
                disabled={isPending || newItemsCount === 0}
                className="w-full py-4 rounded-xl bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:text-gray-500 text-white font-bold text-lg shadow-lg shadow-green-500/30 transition-transform active:scale-95 flex justify-center items-center gap-2"
              >
                {isPending ? 'Sending...' : 'Fire to Kitchen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Variant Selector */}
      <VariantSelectorModal
        item={variantSelectionItem}
        onClose={() => setVariantSelectionItem(null)}
        onConfirm={addToCart}
        orderType="dine-in"
        partners={[]}
        getItemPrice={(mi, v) => getItemPrice(mi, v)}
      />
    </div>
  );
}
