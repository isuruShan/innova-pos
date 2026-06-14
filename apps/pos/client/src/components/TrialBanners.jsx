import { useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';
import api from '../api/axios';

const H_12_MS = 12 * 60 * 60 * 1000;

export default function TrialBanners() {
  const [banners, setBanners] = useState([]);

  useEffect(() => {
    api.get('/scheduled-banners/active?platform=pos_portal')
      .then((res) => {
        if (Array.isArray(res.data)) {
          let dismissed = {};
          try {
            const raw = localStorage.getItem('dismissed_banners');
            if (raw) dismissed = JSON.parse(raw);
          } catch (e) {}
          const now = Date.now();
          const active = res.data.filter((b) => {
            const ts = dismissed[b._id];
            if (ts && now - ts < H_12_MS) return false;
            return true;
          });
          setBanners(active);
        }
      })
      .catch((err) => {
        console.error('Failed to load active banners', err);
      });
  }, []);

  const dismissBanner = (id) => {
    setBanners((prev) => prev.filter((b) => b._id !== id));
    let dismissed = {};
    try {
      const raw = localStorage.getItem('dismissed_banners');
      if (raw) dismissed = JSON.parse(raw);
    } catch (e) {}
    dismissed[id] = Date.now();
    localStorage.setItem('dismissed_banners', JSON.stringify(dismissed));
  };

  if (!banners.length) return null;

  return (
    <div className="w-full flex flex-col gap-1.5 p-2 bg-slate-900 border-b border-slate-800">
      {banners.map((banner) => (
        <div
          key={banner._id}
          className="relative flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-blue-100 border border-blue-300 text-gray-900 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Info size={16} className="text-gray-700 shrink-0" />
            <span className="text-gray-900">
              <strong className="font-bold text-black mr-1.5">{banner.title}:</strong>
              {banner.content}
            </span>
          </div>
          <button
            type="button"
            onClick={() => dismissBanner(banner._id)}
            className="text-gray-700 hover:text-black transition-colors p-1 hover:bg-blue-200/60 rounded-lg"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
