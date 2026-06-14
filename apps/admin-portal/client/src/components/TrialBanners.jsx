import { useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';
import api from '../api/axios';

export default function TrialBanners() {
  const [banners, setBanners] = useState([]);

  useEffect(() => {
    api.get('/api/scheduled-banners/active?platform=admin_portal')
      .then((res) => {
        if (Array.isArray(res.data)) {
          setBanners(res.data);
        }
      })
      .catch((err) => {
        console.error('Failed to load active banners', err);
      });
  }, []);

  const dismissBanner = (id) => {
    setBanners((prev) => prev.filter((b) => b._id !== id));
  };

  if (!banners.length) return null;

  return (
    <div className="w-full flex flex-col gap-2 mb-4">
      {banners.map((banner) => (
        <div
          key={banner._id}
          className="relative flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 text-sm font-medium shadow-sm animate-in fade-in slide-in-from-top-2 duration-300"
        >
          <div className="flex items-center gap-2">
            <Info size={16} className="text-amber-700 shrink-0" />
            <span className="text-amber-900">
              <strong className="font-bold text-amber-950 mr-1.5">{banner.title}:</strong>
              {banner.content}
            </span>
          </div>
          <button
            type="button"
            onClick={() => dismissBanner(banner._id)}
            className="text-amber-700 hover:text-amber-950 p-1 hover:bg-amber-200/60 rounded-lg transition-all"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
