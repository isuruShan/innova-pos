import { Sparkles, HelpCircle } from 'lucide-react';

export default function QrOrderingSettings({ value, onChange }) {
  const settings = value || { categoryImageFirst: true, accentColor: '' };

  const setOption = (key, val) => {
    onChange({
      ...settings,
      [key]: val,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
      <div>
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Sparkles className="text-brand-orange w-5 h-5" /> QR Ordering Customization
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Customize the layout and design of the QR table ordering web application for your guests.
        </p>
      </div>

      <div className="space-y-4">
        {/* Category image toggle */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={settings.categoryImageFirst !== false}
            onChange={(e) => setOption('categoryImageFirst', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 accent-brand-orange mt-1"
          />
          <div className="flex-1">
            <span className="text-sm font-medium text-gray-800 group-hover:text-gray-900 transition-colors">
              Prioritize category images
            </span>
            <span className="block text-xs text-gray-500 mt-0.5">
              Show categories as a grid of large cards using category images on the landing screen, instead of going straight to products.
            </span>
          </div>
        </label>

        {/* Custom Accent color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
            QR App Accent Color
            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-normal">Optional</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={settings.accentColor || '#f59e0b'}
              onChange={(e) => setOption('accentColor', e.target.value)}
              className="w-10 h-10 border border-gray-300 rounded-lg cursor-pointer bg-white"
            />
            <div className="flex-1">
              <input
                type="text"
                value={settings.accentColor || ''}
                onChange={(e) => setOption('accentColor', e.target.value)}
                placeholder="e.g. #f59e0b (leave empty for default)"
                className="max-w-[240px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
              />
              <span className="block text-[11px] text-gray-400 mt-1">
                Customizes primary buttons, tabs, price tags, and highlighting in the table ordering app.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
