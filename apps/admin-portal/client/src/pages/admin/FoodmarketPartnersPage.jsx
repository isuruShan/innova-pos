import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Shield, Percent, DollarSign, Check, X, RefreshCw } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import api from '../../api/axios';

export default function FoodmarketPartnersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [commissionType, setCommissionType] = useState('percentage');
  const [commissionFlat, setCommissionFlat] = useState(0);
  const [commissionPercentage, setCommissionPercentage] = useState(0);
  const [isActive, setIsActive] = useState(true);

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
    setModalOpen(true);
  };

  const openEditModal = (partner) => {
    setEditingPartner(partner);
    setName(partner.name);
    setCommissionType(partner.commissionType);
    setCommissionFlat(partner.commissionFlat || 0);
    setCommissionPercentage(partner.commissionPercentage || 0);
    setIsActive(partner.isActive !== false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingPartner(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      name: name.trim(),
      commissionType,
      commissionFlat: Number(commissionFlat) || 0,
      commissionPercentage: Number(commissionPercentage) || 0,
      isActive,
    };

    if (editingPartner) {
      updateMutation.mutate({ id: editingPartner._id, payload });
    } else {
      createMutation.mutate(payload);
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
      ) : (
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
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
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
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-gray-100 overflow-hidden animate-scale-up">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">
                {editingPartner ? 'Edit Foodmarket Partner' : 'Add Foodmarket Partner'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 rounded-lg p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Partner Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Uber Eats, PickMe"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Commission Type</label>
                <select
                  value={commissionType}
                  onChange={(e) => setCommissionType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange bg-white"
                >
                  <option value="percentage">Percentage Only</option>
                  <option value="flat">Flat Fee Only</option>
                  <option value="both">Both (Flat + Percentage)</option>
                </select>
              </div>

              {(commissionType === 'percentage' || commissionType === 'both') && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Commission Percentage (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    required
                    value={commissionPercentage}
                    onChange={(e) => setCommissionPercentage(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange bg-white"
                  />
                </div>
              )}

              {(commissionType === 'flat' || commissionType === 'both') && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Flat Fee Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={commissionFlat}
                    onChange={(e) => setCommissionFlat(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange bg-white"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="partner-active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-orange focus:ring-brand-orange"
                />
                <label htmlFor="partner-active" className="text-sm font-semibold text-gray-700 cursor-pointer select-none">
                  Enable Partner Channel
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-5 py-2 rounded-lg bg-brand-orange hover:bg-brand-orange-hover text-white text-sm font-semibold shadow-md flex items-center gap-1.5"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Partner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
