import { useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';
import api from '../api/axios';

export default function TrialBanners() {
  const [banners, setBanners] = useState([]);

  useEffect(() => {
    api.get('/scheduled-banners/active?platform=pos_portal')
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
    <div className="w-full flex flex-col gap-1.5 p-2 bg-slate-900 border-b border-slate-800">
      {banners.map((banner) => (
        <div
          key={banner._id}
          className="relative flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-blue-100 border border-blue-300 text-slate-900 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Info size={16} className="text-slate-700 shrink-0" />
            <span className="text-slate-900">
              <strong className="font-bold text-black mr-1.5">{banner.title}:</strong>
              {banner.content}
            </span>
          </div>
          <button
            type="button"
            onClick={() => dismissBanner(banner._id)}
            className="text-slate-700 hover:text-black transition-colors p-1 hover:bg-blue-200/60 rounded-lg"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
