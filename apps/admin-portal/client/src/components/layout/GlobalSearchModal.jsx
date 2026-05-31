import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Compass, Shield, User, FileText, Store, Tag, Gift, Loader2, ArrowRight, ShoppingBag, Package, CreditCard, ContactRound } from 'lucide-react';
import api from '../../api/axios';

export default function GlobalSearchModal({ open, onClose }) {
  const navigate = useNavigate();
  const modalRef = useRef(null);
  const inputRef = useRef(null);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({
    navigation: [],
    tenants: [],
    applications: [],
    promotions: [],
    rewards: [],
    orders: [],
    stores: [],
    users: [],
    customers: [],
    foodmarketPartners: [],
    subscriptions: [],
    inventory: [],
  });

  const [activeIndex, setActiveIndex] = useState(0);

  // Debouncing query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 200);

    return () => clearTimeout(handler);
  }, [query]);

  // Fetch results
  useEffect(() => {
    if (!debouncedQuery) {
      setResults({
        navigation: [],
        tenants: [],
        applications: [],
        promotions: [],
        rewards: [],
        orders: [],
        stores: [],
        users: [],
        customers: [],
        foodmarketPartners: [],
        subscriptions: [],
        inventory: [],
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    api
      .get('/search', { params: { q: debouncedQuery } })
      .then((res) => {
        setResults(res.data);
        setActiveIndex(0);
      })
      .catch((err) => {
        console.error('Global search error:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [debouncedQuery]);

  // Focus input on mount/open
  useEffect(() => {
    if (open) {
      setQuery('');
      setDebouncedQuery('');
      setActiveIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [open]);

  // Flattened results for keyboard navigation
  const flatItems = [];
  
  results.navigation?.forEach((item) => {
    flatItems.push({ type: 'nav', label: item.name, sub: item.description, url: item.path, icon: Compass });
  });
  results.tenants?.forEach((item) => {
    flatItems.push({ type: 'tenant', label: item.businessName, sub: `Slug: ${item.slug} (${item.subscriptionStatus || 'trial'})`, url: `/merchants?search=${item.slug}`, icon: Store });
  });
  results.applications?.forEach((item) => {
    flatItems.push({ type: 'app', label: item.business?.name, sub: `Applicant: ${item.personal?.name} (${item.status})`, url: `/applications?search=${item.business?.name}`, icon: FileText });
  });
  results.promotions?.forEach((item) => {
    flatItems.push({ type: 'promo', label: item.name, sub: `Type: ${item.type} (${item.approvalStatus})`, url: `/promotions?edit=${item._id}`, icon: Tag });
  });
  results.rewards?.forEach((item) => {
    flatItems.push({ type: 'reward', label: item.name, sub: `Cost: ${item.pointsCost} pts (${item.rewardType})`, url: `/loyalty?edit=${item._id}`, icon: Gift });
  });
  results.orders?.forEach((item) => {
    flatItems.push({ type: 'order', label: `Order #${item.orderNumber}`, sub: `Customer: ${item.customer?.name || 'Guest'} (${item.status})`, url: `/foodmarket-commissions`, icon: FileText });
  });
  results.stores?.forEach((item) => {
    flatItems.push({ type: 'store', label: item.name, sub: `Code: ${item.code} (${item.isActive ? 'Active' : 'Inactive'})`, url: `/stores`, icon: Store });
  });
  results.users?.forEach((item) => {
    flatItems.push({ type: 'user', label: item.name, sub: `Email: ${item.email} (${item.role})`, url: `/users/active`, icon: User });
  });
  results.customers?.forEach((item) => {
    flatItems.push({ type: 'customer', label: item.name, sub: `Mobile: ${item.mobile || 'N/A'} | Email: ${item.email || 'N/A'}`, url: `/customers`, icon: ContactRound });
  });
  results.foodmarketPartners?.forEach((item) => {
    flatItems.push({ type: 'partner', label: item.name, sub: `Commission: ${item.commissionType} (${item.commissionPercentage}%)`, url: `/foodmarket-partners`, icon: ShoppingBag });
  });
  results.inventory?.forEach((item) => {
    flatItems.push({ type: 'inventory', label: item.itemName, sub: `Stock: ${item.quantity} ${item.unit} | Cost: ${item.costPerUnit}`, url: `/inventory-sessions`, icon: Package });
  });
  results.subscriptions?.forEach((item) => {
    flatItems.push({ type: 'subscription', label: `Plan: ${item.planCode || item.plan}`, sub: `End Date: ${new Date(item.endDate).toLocaleDateString()} | Amount: ${item.amount}`, url: `/subscription/overview`, icon: CreditCard });
  });

  const handleSelect = (item) => {
    if (!item) return;
    navigate(item.url);
    onClose();
  };

  // Keyboard navigation listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!open) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % Math.max(1, flatItems.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + flatItems.length) % Math.max(1, flatItems.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (flatItems[activeIndex]) {
          handleSelect(flatItems[activeIndex]);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, activeIndex, flatItems]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/40 backdrop-blur-sm">
      {/* Backdrop closer */}
      <div className="absolute inset-0" onClick={onClose} />

      <div
        ref={modalRef}
        className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/80 w-full max-w-2xl overflow-hidden relative flex flex-col max-h-[500px]"
      >
        {/* Search header bar */}
        <div className="relative border-b border-gray-150 flex items-center px-4">
          <Search className="text-gray-400 shrink-0" size={20} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search functionalities, merchants, promotions, orders, users..."
            className="w-full border-none focus:outline-none focus:ring-0 text-gray-800 placeholder-gray-400 py-4 px-3 text-base bg-transparent"
          />
          {loading ? (
            <Loader2 className="animate-spin text-gray-400 shrink-0" size={18} />
          ) : query ? (
            <button
              onClick={() => setQuery('')}
              className="text-xs text-gray-400 hover:text-gray-600 bg-gray-100 rounded px-1.5 py-0.5"
            >
              Clear
            </button>
          ) : (
            <kbd className="text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 shadow-sm bg-gray-50 shrink-0 font-sans">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {flatItems.length > 0 ? (
            <div className="space-y-1.5">
              {/* Categorized Render */}
              {flatItems.map((item, index) => {
                const Icon = item.icon;
                const isActive = index === activeIndex;

                return (
                  <button
                    key={index}
                    onClick={() => handleSelect(item)}
                    className={`w-full flex items-center justify-between text-left p-3 rounded-xl transition-all ${
                      isActive
                        ? 'bg-brand-orange text-white shadow-md shadow-brand-orange/20 scale-[1.01]'
                        : 'hover:bg-gray-50 text-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-bold truncate ${isActive ? 'text-white' : 'text-gray-900'}`}>
                          {item.label}
                        </p>
                        <p className={`text-xs truncate ${isActive ? 'text-white/80' : 'text-gray-500'}`}>
                          {item.sub}
                        </p>
                      </div>
                    </div>
                    {isActive && <ArrowRight size={16} className="text-white shrink-0 animate-pulse" />}
                  </button>
                );
              })}
            </div>
          ) : query ? (
            <p className="p-8 text-center text-gray-500 text-sm">No results match your search query.</p>
          ) : (
            <div className="p-6 text-center space-y-1">
              <Compass className="mx-auto text-gray-300" size={32} />
              <p className="text-gray-500 text-sm font-semibold">Start typing to search the portal</p>
              <p className="text-gray-400 text-xs">Search for pages, merchant configurations, promotions, rewards, or stores.</p>
            </div>
          )}
        </div>

        {/* Command palette tip footer */}
        <div className="bg-gray-50 px-4 py-2.5 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400">
          <div className="flex items-center gap-2">
            <span>↑↓ Navigation</span>
            <span>↵ Select</span>
          </div>
          <span>Press <kbd className="bg-white border border-gray-200 rounded px-1 shadow-sm font-sans font-semibold">Ctrl + K</kbd> to toggle search</span>
        </div>
      </div>
    </div>
  );
}
