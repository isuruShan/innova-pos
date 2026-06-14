import { useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';
import api from '../api/axios';

const DISMISSAL_KEY = 'dismissed_banners';
const TWELVE_HOURS = 12 * 60 * 60 * 1000;

export default function TrialBanners() {
  const [banners, setBanners] = useState([]);

  const getDismissedBanners = () => {
    try {
      const stored = localStorage.getItem(DISMISSAL_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  };

  const saveDismissedBanner = (id) => {
    try {
      const dismissed = getDismissedBanners();
      dismissed[id] = Date.now();
      localStorage.setItem(DISMISSAL_KEY, JSON.stringify(dismissed));
    } catch (err) {
      console.error('Failed to save banner dismissal state', err);
    }
  };

  useEffect(() => {
    api.get('/api/scheduled-banners/active?platform=admin_portal')
      .then((res) => {
        if (Array.isArray(res.data)) {
          const dismissed = getDismissedBanners();
          const now = Date.now();
          
          const visibleBanners = res.data.filter((banner) => {
            const dismissedAt = dismissed[banner._id];
            if (dismissedAt && now - dismissedAt < TWELVE_HOURS) {
              return false;
            }
            return true;
          });
          setBanners(visibleBanners);
        }
      })
      .catch((err) => {
        console.error('Failed to load active banners', err);
      });
  }, []);

  const dismissBanner = (id) => {
    saveDismissedBanner(id);
    setBanners((prev) => prev.filter((b) => b._id !== id));
  };

  if (!banners.length) return null;

  return (
    <div className="w-full flex flex-col gap-2 mb-4">
      {banners.map((banner) => (
        <div
          key={banner._id}
          className="relative flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-100 border border-amber-300 text-black text-sm font-medium shadow-sm animate-in fade-in slide-in-from-top-2 duration-300"
        >
          <div className="flex items-center gap-2">
            <Info size={16} className="text-black shrink-0" />
            <span className="text-black">
              <strong className="font-bold text-black mr-1.5">{banner.title}:</strong>
              {banner.content}
            </span>
          </div>
          <button
            type="button"
            onClick={() => dismissBanner(banner._id)}
            className="text-black/70 hover:text-black p-1 hover:bg-amber-200/80 rounded-lg transition-all"
            aria-label="Dismiss banner"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
