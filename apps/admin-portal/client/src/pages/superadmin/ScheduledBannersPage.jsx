import { useEffect, useState } from 'react';
import { Calendar, Plus, Edit2, Trash2, CheckCircle2, AlertCircle, RefreshCw, X, Monitor, Users } from 'lucide-react';
import api from '../../api/axios';
import ViewModeToggle from '../../components/common/ViewModeToggle';

const ROLE_OPTIONS = [
  { value: 'cashier', label: 'Cashier' },
  { value: 'manager', label: 'Manager' },
  { value: 'merchant_admin', label: 'Merchant Admin' },
];

const PLATFORM_OPTIONS = [
  { value: 'pos_portal', label: 'POS Portal' },
  { value: 'admin_portal', label: 'Admin Portal' },
];

export default function ScheduledBannersPage() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('view_mode_superadmin_banners');
    if (saved) return saved;
    return window.innerWidth < 768 ? 'grid' : 'table';
  });

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedRoles, setSelectedRoles] = useState(['cashier', 'manager', 'merchant_admin']);
  const [selectedPlatforms, setSelectedPlatforms] = useState(['pos_portal', 'admin_portal']);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [showForTrialOnly, setShowForTrialOnly] = useState(true);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const res = await api.get('/scheduled-banners');
      setBanners(res.data);
    } catch (err) {
      setError('Failed to fetch scheduled banners');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const openCreateModal = () => {
    setEditingBanner(null);
    setTitle('');
    setContent('');
    setSelectedRoles(['cashier', 'manager', 'merchant_admin']);
    setSelectedPlatforms(['pos_portal', 'admin_portal']);
    setStartDate('');
    setEndDate('');
    setIsActive(true);
    setShowForTrialOnly(true);
    setModalOpen(true);
  };

  const openEditModal = (banner) => {
    setEditingBanner(banner);
    setTitle(banner.title);
    setContent(banner.content);
    setSelectedRoles(banner.userTypes || []);
    setSelectedPlatforms(banner.platforms || []);
    setStartDate(new Date(banner.startDate).toISOString().split('T')[0]);
    setEndDate(new Date(banner.endDate).toISOString().split('T')[0]);
    setIsActive(banner.isActive);
    setShowForTrialOnly(banner.showForTrialOnly !== false);
    setModalOpen(true);
  };

  const handleRoleToggle = (role) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handlePlatformToggle = (platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !content || !startDate || !endDate) {
      alert('Please fill out all required fields');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      alert('Start date must be before or equal to end date');
      return;
    }

    const payload = {
      title,
      content,
      userTypes: selectedRoles,
      platforms: selectedPlatforms,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive,
      showForTrialOnly,
    };

    try {
      if (editingBanner) {
        await api.put(`/scheduled-banners/${editingBanner._id}`, payload);
      } else {
        await api.post('/scheduled-banners', payload);
      }
      setModalOpen(false);
      fetchBanners();
    } catch (err) {
      alert('Failed to save scheduled banner');
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this scheduled banner?')) return;
    try {
      await api.delete(`/scheduled-banners/${id}`);
      fetchBanners();
    } catch (err) {
      alert('Failed to delete scheduled banner');
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <Calendar className="text-brand-teal shrink-0" size={26} />
            Trial Banners Scheduler
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Schedule notifications and messages to display to active trial merchant users across the platform.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start shrink-0">
          <ViewModeToggle mode={viewMode} setMode={(m) => { setViewMode(m); localStorage.setItem('view_mode_superadmin_banners', m); }} />
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-teal hover:bg-brand-teal/95 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98]"
          >
            <Plus size={16} />
            Create Scheduled Banner
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-3">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-teal"></div>
        </div>
      ) : banners.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center max-w-lg mx-auto space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
            <Calendar size={22} />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">No scheduled banners</h3>
          <p className="text-sm text-gray-500">
            Create a scheduled banner to display announcements to trial users.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {banners.map((banner) => {
            const now = new Date();
            const isCurrent = banner.isActive && new Date(banner.startDate) <= now && new Date(banner.endDate) >= now;
            return (
              <div key={banner._id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-bold text-gray-900 text-base truncate" title={banner.title}>{banner.title}</h3>
                    {isCurrent ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200 shrink-0">
                        Active
                      </span>
                    ) : banner.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                        Scheduled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100 shrink-0">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-3">{banner.content}</p>
                  
                  <div className="mt-3 space-y-2">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Target Platforms</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {banner.platforms?.map((p) => (
                          <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200">
                            <Monitor size={9} />
                            {p === 'pos_portal' ? 'POS' : 'Admin'}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Target Roles</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {banner.userTypes?.map((r) => (
                          <span key={r} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-medium border border-blue-100 capitalize">
                            <Users size={9} />
                            {r.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-150 pt-3 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-gray-500">
                    {new Date(banner.startDate).toLocaleDateString()} - {new Date(banner.endDate).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(banner)}
                      className="p-1.5 text-gray-500 hover:text-brand-teal transition hover:bg-gray-100 rounded-lg"
                      title="Edit"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(banner._id)}
                      className="p-1.5 text-gray-500 hover:text-red-600 transition hover:bg-red-50 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Banner Details</th>
                  <th className="px-6 py-4">Target Platforms</th>
                  <th className="px-6 py-4">Target Roles</th>
                  <th className="px-6 py-4">Active Period</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-600">
                {banners.map((banner) => {
                  const now = new Date();
                  const isCurrent = banner.isActive && new Date(banner.startDate) <= now && new Date(banner.endDate) >= now;
                  return (
                    <tr key={banner._id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 max-w-sm">
                        <div className="font-semibold text-gray-900 truncate">{banner.title}</div>
                        <div className="text-xs text-gray-500 line-clamp-2 mt-1">{banner.content}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {banner.platforms?.map((p) => (
                            <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">
                              <Monitor size={10} />
                              {p === 'pos_portal' ? 'POS' : 'Admin'}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {banner.userTypes?.map((r) => (
                            <span key={r} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100 capitalize">
                              <Users size={10} />
                              {r.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">
                        {new Date(banner.startDate).toLocaleDateString()} - {new Date(banner.endDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                            Currently Active
                          </span>
                        ) : banner.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-650 border border-slate-200">
                            Scheduled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                            Disabled
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <button
                            onClick={() => openEditModal(banner)}
                            className="p-1.5 text-gray-500 hover:text-brand-teal transition hover:bg-gray-100 rounded-lg"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(banner._id)}
                            className="p-1.5 text-gray-500 hover:text-red-600 transition hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-gray-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900">
                {editingBanner ? 'Edit Scheduled Banner' : 'Create Scheduled Banner'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Trial Ending Soon"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-brand-teal focus:ring-1 focus:ring-brand-teal outline-none transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">Message Content *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Your Cafinity trial ends in 3 days. Renew your subscription to prevent any downtime."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-brand-teal focus:ring-1 focus:ring-brand-teal outline-none transition resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">Target Platforms *</label>
                  <div className="space-y-1.5">
                    {PLATFORM_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedPlatforms.includes(opt.value)}
                          onChange={() => handlePlatformToggle(opt.value)}
                          className="rounded border-gray-300 text-brand-teal focus:ring-brand-teal h-4 w-4"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">Target User Roles *</label>
                  <div className="space-y-1.5">
                    {ROLE_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedRoles.includes(opt.value)}
                          onChange={() => handleRoleToggle(opt.value)}
                          className="rounded border-gray-300 text-brand-teal focus:ring-brand-teal h-4 w-4"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-brand-teal focus:ring-1 focus:ring-brand-teal outline-none transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">End Date *</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-brand-teal focus:ring-1 focus:ring-brand-teal outline-none transition"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-gray-300 text-brand-teal focus:ring-brand-teal h-4 w-4 cursor-pointer"
                />
                <label htmlFor="isActive" className="text-sm font-semibold text-gray-700 cursor-pointer select-none">
                  Enable Announcement
                </label>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="showForTrialOnly"
                  checked={showForTrialOnly}
                  onChange={(e) => setShowForTrialOnly(e.target.checked)}
                  className="rounded border-gray-300 text-brand-teal focus:ring-brand-teal h-4 w-4 cursor-pointer"
                />
                <label htmlFor="showForTrialOnly" className="text-sm font-semibold text-gray-700 cursor-pointer select-none">
                  Show for Trial Merchants Only
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-brand-teal hover:bg-brand-teal/95 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98]"
                >
                  {editingBanner ? 'Save Changes' : 'Create Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
