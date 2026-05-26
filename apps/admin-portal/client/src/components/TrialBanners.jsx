import { useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';
import axios from 'axios';

export default function TrialBanners() {
  const [banners, setBanners] = useState([]);

  useEffect(() => {
    axios.get('/api/scheduled-banners/active?platform=admin_portal')
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
    <div className="w-full flex flex-col gap-2 p-2 bg-slate-900 border-b border-slate-800">
      {banners.map((banner) => (
        <div
          key={banner._id}
          className="relative flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border border-blue-500/20 text-blue-100 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300"
        >
          <div className="flex items-center gap-2">
            <Info size={16} className="text-blue-400 shrink-0" />
            <span>
              <strong className="font-bold text-white mr-1.5">{banner.title}:</strong>
              {banner.content}
            </span>
          </div>
          <button
            type="button"
            onClick={() => dismissBanner(banner._id)}
            className="text-blue-400 hover:text-blue-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
