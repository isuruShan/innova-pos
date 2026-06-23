import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ContactRound, Plus, Search, Pencil, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import AdminDateField from '../../components/AdminDateField';
import ListPagination from '../../components/common/ListPagination';
import SortableTh from '../../components/common/SortableTh';
import { unwrapPagedList } from '../../utils/unwrapPagedList';
import { useListSort } from '../../hooks/useListSort';
import LoyaltyAddonSubscribeBanner from '../../components/addons/LoyaltyAddonSubscribeBanner';
import MobilePhoneField, { validateMobileField, phoneValueFromField } from '../../components/MobilePhoneField';
import { validateEmail } from '../../utils/formFields';
import { parsePhoneForField } from '../../utils/phone';
import { useTenantCurrency } from '../../context/TenantCurrencyContext';
import { DEFAULT_COUNTRY_CODE } from '../../constants/countries';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ViewModeToggle from '../../components/common/ViewModeToggle';

const emptyForm = {
  name: '', email: '', birthday: '', notes: '',
  lifetimePoints: '0', pointsNote: '',
};
const emptyPhone = (iso) => ({ countryIso: iso || DEFAULT_COUNTRY_CODE, nationalDigits: '' });

export default function CustomersAdminPage() {
  const qc = useQueryClient();
  const { countryIso: tenantCountryIso } = useTenantCurrency();
  const defaultIso = tenantCountryIso || DEFAULT_COUNTRY_CODE;
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [phoneField, setPhoneField] = useState(emptyPhone(defaultIso));
  const [formErrors, setFormErrors] = useState({});
  const [page, setPage] = useState(1);
  const [confirmDeleteCustomer, setConfirmDeleteCustomer] = useState(null);
  const { sort, order, toggleSort, sortParams } = useListSort('createdAt', 'desc');
  const [pointsFilter, setPointsFilter] = useState('all');
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('view_mode_admin_customers');
    if (saved) return saved;
    return window.innerWidth < 768 ? 'grid' : 'table';
  });

  useEffect(() => {
    setPage(1);
  }, [search, sort, order, pointsFilter]);

  const { data: list = { items: [], page: 1, pages: 1, total: 0 }, isPending, isFetching } = useQuery({
    queryKey: ['admin-customers', search, page, sortParams],
    queryFn: () =>
      api
        .get('/customers', {
          params: {
            ...(search.trim() ? { search: search.trim() } : {}),
            page,
            limit: 25,
            sort,
            order,
          },
        })
        .then((r) => unwrapPagedList(r.data)),
  });
  const rows = list.items || [];
  const filteredRows = useMemo(() => {
    if (pointsFilter === 'has-points') return rows.filter(r => (r.lifetimePoints ?? 0) > 0);
    if (pointsFilter === 'high-points') return rows.filter(r => (r.lifetimePoints ?? 0) >= 500);
    if (pointsFilter === 'no-points') return rows.filter(r => (r.lifetimePoints ?? 0) === 0);
    return rows;
  }, [rows, pointsFilter]);

  const { data: addonCatalog = [] } = useQuery({
    queryKey: ['merchant-addon-catalog'],
    queryFn: () => api.get('/paid-addons/merchant-catalog').then((r) => r.data),
    staleTime: 60_000,
  });
  const loyaltyAddonActive = addonCatalog.find((a) => a.code === 'loyalty')?.alreadyActive === true;

  const saveCustomer = useMutation({
    mutationFn: async () => {
      if (!editor) throw new Error('No editor');
      const phoneErr = validateMobileField(phoneField.countryIso, phoneField.nationalDigits);
      const emailStr = form.email.trim();
      const emailRes = emailStr ? validateEmail(emailStr, { required: false }) : { ok: true };
      if (phoneErr || !emailRes.ok) {
        setFormErrors({ mobile: phoneErr, email: emailRes.ok ? '' : emailRes.error });
        throw new Error('validation');
      }
      setFormErrors({});
      const mobile = phoneValueFromField(phoneField.countryIso, phoneField.nationalDigits);
      const payload = {
        name: form.name.trim(),
        mobile,
        email: emailStr,
        notes: form.notes.trim(),
        ...(form.birthday ? { birthday: new Date(form.birthday).toISOString() } : { birthday: null }),
      };
      if (editor._id) {
        await api.put(`/customers/${editor._id}`, payload);
        const n = Number(form.lifetimePoints);
        if (loyaltyAddonActive && !Number.isNaN(n) && n >= 0) {
          await api.post(`/customers/${editor._id}/points`, {
            lifetimePoints: n,
            note: form.pointsNote?.trim() || '',
          });
        }
      } else {
        await api.post('/customers', payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-customers'] });
      qc.invalidateQueries({ queryKey: ['loyalty-retention-pending'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      setEditor(null);
      setForm(emptyForm);
      setPhoneField(emptyPhone(defaultIso));
      setFormErrors({});
    },
    onError: (err) => {
      if (err.message !== 'validation') {
        window.alert(err.response?.data?.message || 'Save failed');
      }
    },
  });

  const deleteCustomer = useMutation({
    mutationFn: (id) => api.delete(`/customers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-customers'] }),
  });

  const openNew = () => {
    setEditor({});
    setForm(emptyForm);
    setPhoneField(emptyPhone(defaultIso));
    setFormErrors({});
  };

  const openEdit = (c) => {
    setEditor(c);
    setFormErrors({});
    const parsed = parsePhoneForField(c.mobile, c.countryIso || defaultIso);
    setPhoneField({ countryIso: parsed.countryIso, nationalDigits: parsed.nationalDigits });
    setForm({
      name: c.name || '',
      email: c.email || '',
      birthday: c.birthday ? String(c.birthday).slice(0, 10) : '',
      notes: c.notes || '',
      lifetimePoints: String(c.lifetimePoints ?? 0),
      pointsNote: '',
    });
  };

  const submitProfile = (e) => {
    e.preventDefault();
    saveCustomer.mutate();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ContactRound className="text-brand-orange" size={26} />
          Customers
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          Tenant-wide customer records shared across all stores. Add, edit, delete profiles, and adjust lifetime loyalty
          points from the edit screen.
        </p>
      </div>

      <LoyaltyAddonSubscribeBanner />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, mobile…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm"
            />
          </div>
          <select
            value={pointsFilter}
            onChange={(e) => setPointsFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none"
          >
            <option value="all">All Points</option>
            <option value="has-points">Points &gt; 0</option>
            <option value="high-points">Points &ge; 500</option>
            <option value="no-points">No Points</option>
          </select>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ViewModeToggle mode={viewMode} setMode={(m) => { setViewMode(m); localStorage.setItem('view_mode_admin_customers', m); }} />
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-medium"
          >
            <Plus size={16} /> Add customer
          </button>
        </div>
      </div>

      <div className={viewMode === 'grid' ? '' : 'bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm'}>
        {isPending ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 text-sm">
            {search.trim() ? 'No customers match this search.' : 'No customers yet.'}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {rows.map((row) => (
              <div key={row._id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{row.name || '—'}</div>
                      <div className="text-xs text-gray-505 truncate">{row.email || row.mobile || '—'}</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 mt-2 bg-gray-50 p-2.5 rounded-lg border border-gray-100 flex justify-between items-center">
                    <span>Lifetime Points:</span>
                    <span className="font-bold text-gray-900 text-sm tabular-nums">{row.lifetimePoints ?? 0}</span>
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-100 mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="text-brand-teal text-xs font-semibold inline-flex items-center gap-1 hover:bg-teal-50 px-2 py-1 rounded transition"
                  >
                    <Pencil size={12} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteCustomer(row)}
                    className="text-red-650 text-xs inline-flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded transition"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700 text-left">
                <tr>
                  <SortableTh label="Customer" field="name" currentSort={sort} currentOrder={order} onSort={toggleSort} />
                  <th className="px-4 py-3 font-medium text-gray-700">Mobile</th>
                  <th className="px-4 py-3 font-medium text-gray-700">Email</th>
                  <SortableTh label="Created" field="createdAt" currentSort={sort} currentOrder={order} onSort={toggleSort} />
                  <SortableTh label="Updated" field="updatedAt" currentSort={sort} currentOrder={order} onSort={toggleSort} />
                  <SortableTh label="Points" field="points" currentSort={sort} currentOrder={order} onSort={toggleSort} />
                  <th className="px-4 py-3 font-medium text-right w-36">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row._id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{row.mobile || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{row.email || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-900">{row.lifetimePoints ?? 0}</td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="text-brand-teal text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteCustomer(row)}
                        className="text-red-600 text-xs inline-flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!isPending && rows.length > 0 && (
          <div className={viewMode === 'grid' ? 'bg-white rounded-xl border border-gray-200 mt-4' : ''}>
            <ListPagination
              page={list.page}
              pages={list.pages}
              total={list.total}
              onPageChange={setPage}
              isFetching={isFetching}
              className="px-4"
            />
          </div>
        )}
      </div>

      {editor !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
          onClick={() => {
            setEditor(null);
            setForm(emptyForm);
          }}
          role="presentation"
        >
          <div
            className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editor._id ? 'Edit customer' : 'New customer'}
            </h3>
            <form onSubmit={submitProfile} className="space-y-3">
              <label className="block text-xs text-gray-600">
                Name
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <MobilePhoneField
                countryIso={phoneField.countryIso}
                nationalDigits={phoneField.nationalDigits}
                onCountryIsoChange={(iso) => setPhoneField((p) => ({ ...p, countryIso: iso }))}
                onNationalDigitsChange={(d) => { setPhoneField((p) => ({ ...p, nationalDigits: d })); setFormErrors((e) => ({ ...e, mobile: '' })); }}
                error={formErrors.mobile}
                label="Mobile"
              />
              <div>
                <label className="block text-xs text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); setFormErrors((e) => ({ ...e, email: '' })); }}
                  className={`w-full rounded-lg border px-3 py-2 text-sm ${formErrors.email ? 'border-red-400' : 'border-gray-300'}`}
                />
                {formErrors.email && <p className="text-xs text-red-500 mt-0.5">{formErrors.email}</p>}
              </div>
              <label className="block text-xs text-gray-600">
                Birthday
                <AdminDateField
                  value={form.birthday}
                  onChange={(v) => setForm((f) => ({ ...f, birthday: v }))}
                />
              </label>
              <label className="block text-xs text-gray-600">
                Notes
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none"
                />
              </label>

              {editor._id && loyaltyAddonActive && (
                <>
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-700 mb-2">Loyalty points</p>
                    <label className="block text-xs text-gray-600">
                      Lifetime points
                      <input
                        type="number"
                        min={0}
                        required
                        value={form.lifetimePoints}
                        onChange={(e) => setForm((f) => ({ ...f, lifetimePoints: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-xs text-gray-600 mt-2">
                      Note for this adjustment (optional)
                      <textarea
                        value={form.pointsNote}
                        onChange={(e) => setForm((f) => ({ ...f, pointsNote: e.target.value }))}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none"
                        placeholder="Reason for adjustment"
                      />
                    </label>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Saving updates profile first, then applies this points total. Other merchant admins may receive a
                      notification.
                    </p>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditor(null);
                    setForm(emptyForm);
                  }}
                  className="px-3 py-2 text-sm text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveCustomer.isPending}
                  className="px-4 py-2 rounded-lg bg-brand-teal text-white text-sm font-medium disabled:opacity-50"
                >
                  {saveCustomer.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDeleteCustomer)}
        variant="delete"
        title="Delete customer?"
        message={
          confirmDeleteCustomer?.lifetimePoints > 0
            ? `"${confirmDeleteCustomer.name || confirmDeleteCustomer.email || 'this record'}" has ${confirmDeleteCustomer.lifetimePoints} loyalty points. Deleting this customer will permanently remove their loyalty profile and points.\n\nAre you sure you want to proceed?`
            : `"${confirmDeleteCustomer?.name || confirmDeleteCustomer?.email || 'this record'}" will be permanently removed. Are you sure you want to proceed?`
        }
        confirmLabel="Delete"
        isLoading={deleteCustomer.isPending}
        onConfirm={() => { deleteCustomer.mutate(confirmDeleteCustomer._id); setConfirmDeleteCustomer(null); }}
        onCancel={() => setConfirmDeleteCustomer(null)}
      />
    </div>
  );
}
