import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Shield, Percent, DollarSign, Check, X, RefreshCw, Upload, Image as ImageIcon } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import api from '../../api/axios';
import SideDrawer from '../../components/common/SideDrawer';
import ViewModeToggle from '../../components/common/ViewModeToggle';

const DEFAULT_COLORS = [
  { name: 'Green', value: '#10b981' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Yellow', value: '#eab308' },
];

const DEFAULT_ICONS = ['🛵', '🏍️', '🚗', '🚴', '🛻', '🚚', '🍕', '🍔', '🌮'];

export default function FoodmarketPartnersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('view_mode_admin_foodmarket_partners');
    if (saved) return saved;
    return window.innerWidth < 768 ? 'grid' : 'table';
  });

  // Form states
  const [name, setName] = useState('');
  const [commissionType, setCommissionType] = useState('percentage');
  const [commissionFlat, setCommissionFlat] = useState(0);
  const [commissionPercentage, setCommissionPercentage] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [icon, setIcon] = useState('🛵');
  const [color, setColor] = useState('#10b981');

  // Fetch partners
  const { data: partners = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['foodmarket-partners'],
    queryFn: () => api.get('/foodmarket-partners').then((r) => r.data),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/foodmarket-partners', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foodmarket-partners'] });
      toast.success('Foodmarket partner added successfully');
      closeModal();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to add partner');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/foodmarket-partners/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foodmarket-partners'] });
      toast.success('Foodmarket partner updated successfully');
      closeModal();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update partner');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/foodmarket-partners/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foodmarket-partners'] });
      toast.success('Foodmarket partner deleted successfully');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to delete partner');
    },
  });

  const openCreateModal = () => {
    setEditingPartner(null);
    setName('');
    setCommissionType('percentage');
    setCommissionFlat(0);
    setCommissionPercentage(0);
    setIsActive(true);
    setLogoFile(null);
    setLogoPreview('');
    setIcon('🛵');
    setColor('#10b981');
    setModalOpen(true);
  };

  const openEditModal = (partner) => {
    setEditingPartner(partner);
    setName(partner.name);
    setCommissionType(partner.commissionType);
    setCommissionFlat(partner.commissionFlat || 0);
    setCommissionPercentage(partner.commissionPercentage || 0);
    setIsActive(partner.isActive !== false);
    setLogoFile(null);
    setLogoPreview(partner.logoUrl || '');
    setIcon(partner.icon || '🛵');
    setColor(partner.color || '#10b981');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingPartner(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    let logoUrl = logoPreview;
    let logoKey = editingPartner?.logoKey || '';

    // Upload logo if new file selected
    if (logoFile) {
      try {
        const formData = new FormData();
        formData.append('file', logoFile);
        const uploadRes = await api.post('/foodmarket-partners/logo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        logoUrl = uploadRes.data.url;
        logoKey = uploadRes.data.key || '';
      } catch (err) {
        toast.error('Failed to upload logo image');
        return;
      }
    }

    const payload = {
      name: name.trim(),
      commissionType,
      commissionFlat: Number(commissionFlat) || 0,
      commissionPercentage: Number(commissionPercentage) || 0,
      isActive,
      logoUrl,
      logoKey,
      icon,
      color,
    };

    if (editingPartner) {
      updateMutation.mutate({ id: editingPartner._id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Logo file must be less than 5MB');
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this foodmarket partner?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Food Market Partners</h1>
          <p className="text-gray-500 mt-1">Configure integrations, commissions, and specific pricing overlays for Uber, PickMe, etc.</p>
        </div>
        <div className="flex items-center gap-3">
          <ViewModeToggle mode={viewMode} setMode={(m) => { setViewMode(m); localStorage.setItem('view_mode_admin_foodmarket_partners', m); }} />
          <button
            onClick={() => refetch()}
            className="p-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
            title="Refresh list"
            disabled={isLoading || isRefetching}
          >
            <RefreshCw size={18} className={isLoading || isRefetching ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-orange hover:bg-brand-orange-hover text-white font-semibold shadow-md transition-all active:scale-95"
          >
            <Plus size={18} />
            Add Partner
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-2xl border border-gray-200 animate-pulse" />
          ))}
        </div>
      ) : partners.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-brand-orange/10 flex items-center justify-center mx-auto mb-4 text-brand-orange">
            <Shield size={28} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">No Partners Configured</h3>
          <p className="text-gray-500 text-sm mb-6">Create partners to start managing specific channel prices and commission structures.</p>
          <button
            onClick={openCreateModal}
            className="px-5 py-2.5 rounded-lg bg-brand-orange hover:bg-brand-orange-hover text-white font-semibold shadow-md transition-colors"
          >
            Create first partner
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {partners.map((partner) => (
            <div
              key={partner._id}
              className={`bg-white rounded-2xl border transition-all p-6 relative flex flex-col justify-between shadow-sm ${
                partner.isActive ? 'border-gray-200 hover:shadow-md' : 'border-gray-150 opacity-60'
              }`}
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    {/* Logo or Icon */}
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center border-2"
                      style={{
                        borderColor: partner.color + '40' || '#10b98140',
                        backgroundColor: partner.color + '10' || '#10b98110',
                      }}
                    >
                      {partner.logoUrl ? (
                        <img src={partner.logoUrl} alt={partner.name} className="w-full h-full object-contain rounded-lg" />
                      ) : (
                        <span className="text-2xl">{partner.icon || '🛵'}</span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 leading-tight">{partner.name}</h3>
                      <span
                        className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1.5 ${
                          partner.isActive ? 'bg-green-55 text-green-800' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {partner.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditModal(partner)}
                      className="p-1.5 text-gray-500 hover:text-gray-950 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit partner"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(partner._id)}
                      className="p-1.5 text-red-500 hover:text-red-750 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete partner"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 mt-4 pt-4 border-t border-gray-100">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Commission Type</span>
                    <span className="font-semibold text-gray-900 capitalize">{partner.commissionType}</span>
                  </div>
                  {(partner.commissionType === 'percentage' || partner.commissionType === 'both') && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Percentage Rate</span>
                      <span className="font-semibold text-gray-900 flex items-center gap-0.5">
                        <Percent size={13} className="text-gray-400" />
                        {partner.commissionPercentage}%
                      </span>
                    </div>
                  )}
                  {(partner.commissionType === 'flat' || partner.commissionType === 'both') && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Flat Fee</span>
                      <span className="font-semibold text-gray-900 flex items-center gap-0.5">
                        <DollarSign size={13} className="text-gray-400" />
                        {partner.commissionFlat}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl border border-gray-200 shadow-sm">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                <th className="px-6 py-3">Partner</th>
                <th className="px-6 py-3">Commission Type</th>
                <th className="px-6 py-3">Rate/Fee</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150">
              {partners.map((partner) => (
                <tr key={partner._id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-6 py-4 flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center border shrink-0"
                      style={{
                        borderColor: partner.color + '40' || '#10b98140',
                        backgroundColor: partner.color + '10' || '#10b98110',
                      }}
                    >
                      {partner.logoUrl ? (
                        <img src={partner.logoUrl} alt={partner.name} className="w-full h-full object-contain rounded" />
                      ) : (
                        <span className="text-lg">{partner.icon || '🛵'}</span>
                      )}
                    </div>
                    <span className="font-semibold text-gray-900">{partner.name}</span>
                  </td>
                  <td className="px-6 py-4 capitalize">{partner.commissionType}</td>
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    {partner.commissionType === 'percentage' && `${partner.commissionPercentage}%`}
                    {partner.commissionType === 'flat' && partner.commissionFlat}
                    {partner.commissionType === 'both' && `${partner.commissionPercentage}% + ${partner.commissionFlat}`}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                        partner.isActive ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {partner.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-3 whitespace-nowrap">
                    <button
                      onClick={() => openEditModal(partner)}
                      className="text-gray-500 hover:text-gray-950 font-semibold text-xs transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(partner._id)}
                      className="text-red-500 hover:text-red-700 font-semibold text-xs transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SideDrawer
        open={modalOpen}
        onClose={closeModal}
        title={editingPartner ? 'Edit Foodmarket Partner' : 'Add Foodmarket Partner'}
        subtitle={editingPartner ? 'Update partner branding and commission settings' : 'Configure a new delivery partner integration'}
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="partner-form"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-5 py-2.5 rounded-lg bg-brand-orange hover:bg-brand-orange-hover text-white text-sm font-semibold shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check size={16} />
                  {editingPartner ? 'Update Partner' : 'Create Partner'}
                </>
              )}
            </button>
          </div>
        }
      >
        <form id="partner-form" onSubmit={handleSubmit} className="space-y-5">
          {/* Partner Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Partner Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Uber Eats, PickMe Food"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange bg-white"
            />
          </div>

          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Partner Logo</label>
            <div className="flex items-start gap-3">
              {logoPreview ? (
                <div className="relative w-24 h-24 rounded-lg border-2 border-gray-200 overflow-hidden bg-white shrink-0">
                  <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain p-1" />
                  <button
                    type="button"
                    onClick={() => { setLogoFile(null); setLogoPreview(''); }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 shadow-md"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 shrink-0">
                  <ImageIcon size={28} className="text-gray-400" />
                </div>
              )}
              <div className="flex-1">
                <input
                  type="file"
                  id="logo-upload"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
                <label
                  htmlFor="logo-upload"
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <Upload size={16} />
                  Choose Image
                </label>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  PNG, JPG, or WebP up to 5MB.<br />
                  Recommended: 200×200px square logo
                </p>
              </div>
            </div>
          </div>

          {/* Icon & Color Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Icon Fallback</label>
              <div className="grid grid-cols-5 gap-1.5">
                {DEFAULT_ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(ic)}
                    className={`p-2.5 text-xl rounded-lg border-2 transition hover:scale-105 ${
                      icon === ic ? 'border-brand-orange bg-brand-orange/10' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    title={ic}
                  >
                    {ic}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1.5">Used when no logo uploaded</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Badge Color</label>
              <div className="grid grid-cols-3 gap-1.5">
                {DEFAULT_COLORS.map((col) => (
                  <button
                    key={col.value}
                    type="button"
                    onClick={() => setColor(col.value)}
                    className={`p-3 rounded-lg border-2 transition flex items-center justify-center hover:scale-105 ${
                      color === col.value ? 'border-gray-900 shadow-sm' : 'border-gray-200'
                    }`}
                    style={{ backgroundColor: col.value + '20' }}
                    title={col.name}
                  >
                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: col.value }} />
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1.5">For order type badges</p>
            </div>
          </div>

          <hr className="border-gray-200" />

          {/* Commission Settings */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Commission Type</label>
            <select
              value={commissionType}
              onChange={(e) => setCommissionType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange bg-white"
            >
              <option value="percentage">Percentage Only</option>
              <option value="flat">Flat Fee Only</option>
              <option value="both">Both (Flat + Percentage)</option>
            </select>
          </div>

          {(commissionType === 'percentage' || commissionType === 'both') && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Commission Percentage (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
                value={commissionPercentage}
                onChange={(e) => setCommissionPercentage(e.target.value)}
                placeholder="e.g. 15"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange bg-white"
              />
            </div>
          )}

          {(commissionType === 'flat' || commissionType === 'both') && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Flat Fee Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={commissionFlat}
                onChange={(e) => setCommissionFlat(e.target.value)}
                placeholder="e.g. 50"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange bg-white"
              />
            </div>
          )}

          {/* Active Toggle */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <input
              type="checkbox"
              id="partner-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-5 h-5 rounded text-brand-orange focus:ring-brand-orange"
            />
            <div className="flex-1">
              <label htmlFor="partner-active" className="text-sm font-semibold text-gray-900 cursor-pointer block">
                Enable Partner Channel
              </label>
              <p className="text-xs text-gray-600 mt-0.5">
                When enabled, partner appears as an order type in POS
              </p>
            </div>
          </div>
        </form>
      </SideDrawer>
    </div>
  );
}
