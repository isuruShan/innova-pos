import { Building, Globe } from 'lucide-react';

export default function GoogleBusinessCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden relative opacity-75">
      {/* Overlay to disable clicking */}
      <div className="absolute inset-0 bg-white/20 z-10 cursor-not-allowed" />
      
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-start justify-between">
        <div className="flex items-start gap-3">
          <span className="p-2 rounded-lg bg-blue-50 text-blue-600">
            <Building size={18} />
          </span>
          <div>
            <h3 className="font-semibold text-gray-900">Google Business Profile</h3>
            <p className="text-sm text-gray-500 mt-0.5">Link your restaurant to Google Search and Google Maps.</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-orange text-white shadow-sm z-20">
          Coming Soon
        </span>
      </div>

      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-600 leading-relaxed">
          Google Business Profile integration is coming soon! You will be able to connect your Google account and sync your restaurant information (name, address, category, phone, description) directly to Google Search and Google Maps.
        </p>
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-500/40 text-white text-sm font-semibold rounded-xl cursor-not-allowed"
        >
          <Globe size={16} />
          Connect with Google
        </button>
      </div>
    </div>
  );
}
