import { useState, useMemo, Fragment } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, Plus, Landmark, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../../api/axios';
import { useToast } from '../../context/ToastContext';
import AccountingAddonSubscribeBanner from '../../components/addons/AccountingAddonSubscribeBanner';
import SortableTh from '../../components/common/SortableTh';
import { useListSort } from '../../hooks/useListSort';

export default function AccountingPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Route-based tab navigation
  const getActiveTab = () => {
    if (location.pathname.endsWith('/ledger')) return 'ledger';
    if (location.pathname.endsWith('/contacts')) return 'contacts';
    if (location.pathname.endsWith('/payroll')) return 'payroll';
    if (location.pathname.endsWith('/reports')) return 'reports';
    return 'coa';
  };
  const activeTab = getActiveTab();
  const setActiveTab = (tab) => navigate(`/accounting/${tab}`);

  // Modal states
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [journalModalOpen, setJournalModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [billModalOpen, setBillModalOpen] = useState(false);

  // Form states
  const [newAccount, setNewAccount] = useState({ code: '', name: '', type: 'asset' });
  const [newJournal, setNewJournal] = useState({
    date: new Date().toISOString().split('T')[0],
    reference: '',
    description: '',
    lines: [
      { accountId: '', debit: 0, credit: 0, description: '' },
      { accountId: '', debit: 0, credit: 0, description: '' }
    ]
  });
  const [newContact, setNewContact] = useState({ name: '', type: 'debtor', phone: '', email: '', address: '', creditLimit: 0 });
  const [newPayment, setNewPayment] = useState({ contactId: '', amount: 0, paymentType: 'cash', description: '' });
  const [newBill, setNewBill] = useState({ supplierName: '', amount: 0, invoiceNumber: '', date: new Date().toISOString().split('T')[0], description: '' });
  const [payrollParams, setPayrollParams] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });

  // Report filters
  const [reportType, setReportType] = useState('pl');
  const [reportFilters, setReportFilters] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
    date: new Date().toISOString().split('T')[0]
  });

  // Query: Check if accounting addon is active
  const { data: addonCatalog = [], isPending: isCatalogPending } = useQuery({
    queryKey: ['merchant-addon-catalog'],
    queryFn: () => api.get('/paid-addons/merchant-catalog').then((r) => r.data),
    staleTime: 60_000,
  });
  const accountingActive = addonCatalog.find((a) => a.code === 'accounting')?.alreadyActive === true;

  const accountsSort = useListSort('code', 'asc');
  const journalSort = useListSort('date', 'desc');
  const contactsSort = useListSort('name', 'asc');
  const payrollSort = useListSort('year', 'desc');

  // Query: Fetch Chart of Accounts
  const { data: accounts = [], isPending: isAccountsPending } = useQuery({
    queryKey: ['accounting-accounts', accountsSort.sortParams],
    queryFn: () =>
      api.get('/accounting/accounts', { params: { sort: accountsSort.sort, order: accountsSort.order } }).then((r) => r.data),
    enabled: accountingActive,
  });

  // Query: Fetch Journal Entries
  const { data: journal = [], isPending: isJournalPending } = useQuery({
    queryKey: ['accounting-journal', journalSort.sortParams],
    queryFn: () =>
      api.get('/accounting/journal', { params: { sort: journalSort.sort, order: journalSort.order } }).then((r) => r.data),
    enabled: accountingActive,
  });

  // Query: Fetch Contacts (Creditors/Debtors)
  const { data: contacts = [], isPending: isContactsPending } = useQuery({
    queryKey: ['accounting-contacts', contactsSort.sortParams],
    queryFn: () =>
      api.get('/accounting/contacts', { params: { sort: contactsSort.sort, order: contactsSort.order } }).then((r) => r.data),
    enabled: accountingActive,
  });

  // Query: Fetch Payroll runs
  const { data: payroll = [], isPending: isPayrollPending } = useQuery({
    queryKey: ['accounting-payroll', payrollSort.sortParams],
    queryFn: () =>
      api.get('/accounting/payroll', { params: { sort: payrollSort.sort, order: payrollSort.order } }).then((r) => r.data),
    enabled: accountingActive,
  });

  // Report Queries
  const { data: plReport, isPending: isPlPending, refetch: refetchPl } = useQuery({
    queryKey: ['report-pl', reportFilters.start, reportFilters.end],
    queryFn: () => api.get(`/accounting/reports/profit-loss?start=${reportFilters.start}&end=${reportFilters.end}`).then((r) => r.data),
    enabled: accountingActive && reportType === 'pl',
  });

  const { data: bsReport, isPending: isBsPending, refetch: refetchBs } = useQuery({
    queryKey: ['report-bs', reportFilters.date],
    queryFn: () => api.get(`/accounting/reports/balance-sheet?date=${reportFilters.date}`).then((r) => r.data),
    enabled: accountingActive && reportType === 'bs',
  });

  const { data: cfReport, isPending: isCfPending, refetch: refetchCf } = useQuery({
    queryKey: ['report-cf', reportFilters.start, reportFilters.end],
    queryFn: () => api.get(`/accounting/reports/cash-flow?start=${reportFilters.start}&end=${reportFilters.end}`).then((r) => r.data),
    enabled: accountingActive && reportType === 'cf',
  });

  // Mutations
  const createAccountMutation = useMutation({
    mutationFn: (payload) => api.post('/accounting/accounts', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting-accounts'] });
      toast.success('Account created successfully');
      setAccountModalOpen(false);
      setNewAccount({ code: '', name: '', type: 'asset' });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to create account'),
  });

  const createJournalMutation = useMutation({
    mutationFn: (payload) => api.post('/accounting/journal', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting-journal'] });
      qc.invalidateQueries({ queryKey: ['accounting-accounts'] });
      toast.success('Journal entry posted successfully');
      setJournalModalOpen(false);
      setNewJournal({
        date: new Date().toISOString().split('T')[0],
        reference: '',
        description: '',
        lines: [
          { accountId: '', debit: 0, credit: 0, description: '' },
          { accountId: '', debit: 0, credit: 0, description: '' }
        ]
      });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to post journal entry'),
  });

  const createContactMutation = useMutation({
    mutationFn: (payload) => api.post('/accounting/contacts', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting-contacts'] });
      toast.success('Contact created successfully');
      setContactModalOpen(false);
      setNewContact({ name: '', type: 'debtor', phone: '', email: '', address: '', creditLimit: 0 });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to create contact'),
  });

  const postPaymentMutation = useMutation({
    mutationFn: ({ id, payload }) => api.post(`/accounting/contacts/${id}/payment`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting-contacts'] });
      qc.invalidateQueries({ queryKey: ['accounting-accounts'] });
      qc.invalidateQueries({ queryKey: ['accounting-journal'] });
      toast.success('Settlement payment recorded successfully');
      setPaymentModalOpen(false);
      setNewPayment({ contactId: '', amount: 0, paymentType: 'cash', description: '' });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to record payment'),
  });

  const postBillMutation = useMutation({
    mutationFn: (payload) => api.post('/accounting/bills', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting-contacts'] });
      qc.invalidateQueries({ queryKey: ['accounting-accounts'] });
      qc.invalidateQueries({ queryKey: ['accounting-journal'] });
      toast.success('Supplier bill recorded successfully');
      setBillModalOpen(false);
      setNewBill({ supplierName: '', amount: 0, invoiceNumber: '', date: new Date().toISOString().split('T')[0], description: '' });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to record supplier bill'),
  });

  const calculatePayrollMutation = useMutation({
    mutationFn: (payload) => api.post('/accounting/payroll/calculate', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting-payroll'] });
      toast.success('Draft payroll run generated');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to calculate payroll'),
  });

  const releasePayrollMutation = useMutation({
    mutationFn: (id) => api.post(`/accounting/payroll/${id}/pay`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting-payroll'] });
      qc.invalidateQueries({ queryKey: ['accounting-accounts'] });
      qc.invalidateQueries({ queryKey: ['accounting-journal'] });
      toast.success('Wages released and payroll run paid');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to pay payroll'),
  });

  const handleJournalLineChange = (index, field, val) => {
    const lines = [...newJournal.lines];
    lines[index][field] = val;
    setNewJournal({ ...newJournal, lines });
  };

  const addJournalLine = () => {
    setNewJournal({
      ...newJournal,
      lines: [...newJournal.lines, { accountId: '', debit: 0, credit: 0, description: '' }]
    });
  };

  const removeJournalLine = (index) => {
    if (newJournal.lines.length <= 2) return;
    const lines = newJournal.lines.filter((_, i) => i !== index);
    setNewJournal({ ...newJournal, lines });
  };

  const journalTotalDebits = useMemo(() => {
    return newJournal.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  }, [newJournal.lines]);

  const journalTotalCredits = useMemo(() => {
    return newJournal.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  }, [newJournal.lines]);

  if (isCatalogPending) {
    return <div className="flex justify-center py-12 text-sm text-gray-500">Checking addon entitlement…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Wallet className="text-indigo-600" size={26} />
          Finance & Bookkeeping
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          Double-entry Chart of Accounts, manual journals, payroll tracking, creditors & debtors, and financial statement generator.
        </p>
      </div>

      <AccountingAddonSubscribeBanner />

      {!accountingActive ? (
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-8 text-center max-w-lg mx-auto space-y-3 mt-8">
          <Landmark className="text-indigo-400 mx-auto" size={48} />
          <h3 className="text-lg font-semibold text-gray-900">Advanced Accounting is Locked</h3>
          <p className="text-sm text-gray-600">
            Gain full control of your financials, auto-record POS sales and tax returns, run staff payroll, and generate Balance Sheets and P&Ls. Subscribe to activate.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* TAB CONTENT: Chart of Accounts */}
          {activeTab === 'coa' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Ledger Accounts</h2>
                  <p className="text-xs text-gray-600">Complete chart of system and custom accounts.</p>
                </div>
                <button
                  onClick={() => setAccountModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors"
                >
                  <Plus size={16} /> Add Custom Account
                </button>
              </div>

              {isAccountsPending ? (
                <div className="py-8 text-center text-sm text-gray-500">Loading accounts...</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-700 text-left">
                      <tr>
                        <SortableTh label="Code" field="code" currentSort={accountsSort.sort} currentOrder={accountsSort.order} onSort={accountsSort.toggleSort} />
                        <SortableTh label="Account Name" field="name" currentSort={accountsSort.sort} currentOrder={accountsSort.order} onSort={accountsSort.toggleSort} />
                        <SortableTh label="Type" field="type" currentSort={accountsSort.sort} currentOrder={accountsSort.order} onSort={accountsSort.toggleSort} />
                        <th className="px-4 py-3 font-semibold text-right">Debit Balances</th>
                        <th className="px-4 py-3 font-semibold text-right">Credit Balances</th>
                        <th className="px-4 py-3 font-semibold text-right">Net Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {accounts.map((acc) => (
                        <tr key={acc._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono font-medium text-gray-900">{acc.code}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{acc.name}</td>
                          <td className="px-4 py-3 capitalize text-gray-500">{acc.type}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-600">{acc.debits ? acc.debits.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-600">{acc.credits ? acc.credits.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
                          <td className={`px-4 py-3 text-right tabular-nums font-semibold ${acc.balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {acc.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT: General Ledger */}
          {activeTab === 'ledger' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Journal Adjustment Log</h2>
                  <p className="text-xs text-gray-600">Chronological history of all bookkeeping events.</p>
                </div>
                <button
                  onClick={() => setJournalModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors"
                >
                  <Plus size={16} /> New Journal Entry
                </button>
              </div>

              {isJournalPending ? (
                <div className="py-8 text-center text-sm text-gray-500">Loading ledger entries...</div>
              ) : journal.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">No journal entries recorded.</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-700 text-left">
                      <tr>
                        <SortableTh label="Date" field="date" currentSort={journalSort.sort} currentOrder={journalSort.order} onSort={journalSort.toggleSort} />
                        <SortableTh label="Reference" field="reference" currentSort={journalSort.sort} currentOrder={journalSort.order} onSort={journalSort.toggleSort} />
                        <th className="px-4 py-3 font-semibold">Description</th>
                        <th className="px-4 py-3 font-semibold">Source</th>
                        <SortableTh label="Posted" field="createdAt" currentSort={journalSort.sort} currentOrder={journalSort.order} onSort={journalSort.toggleSort} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {journal.map((entry) => (
                        <Fragment key={entry._id}>
                          <tr className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-gray-600 whitespace-nowrap">
                              {new Date(entry.date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-900">{entry.reference}</td>
                            <td className="px-4 py-3 text-gray-700">{entry.description}</td>
                            <td className="px-4 py-3 capitalize text-gray-500">{entry.referenceModel || 'Manual'}</td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                              {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '—'}
                            </td>
                          </tr>
                          <tr className="bg-slate-50/50">
                            <td colSpan={5} className="px-4 py-2">
                              <div className="space-y-1">
                                {entry.lines.map((line, idx) => (
                                  <div key={line._id || idx} className="grid grid-cols-12 gap-3 text-xs">
                                    <div className="col-span-5 font-medium text-slate-700">
                                      {line.accountId?.code} — {line.accountId?.name}
                                    </div>
                                    <div className="col-span-4 text-slate-500 italic">{line.description}</div>
                                    <div className="col-span-3 grid grid-cols-2 text-right">
                                      <span className="font-mono tabular-nums text-slate-800">
                                        {line.debit > 0 ? line.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}
                                      </span>
                                      <span className="font-mono tabular-nums text-slate-800">
                                        {line.credit > 0 ? line.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT: Debtors & Creditors */}
          {activeTab === 'contacts' && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Debtors Section */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Debtors (Accounts Receivable)</h2>
                    <p className="text-xs text-gray-600">Customers who owe balance to the merchant.</p>
                  </div>
                  <button
                    onClick={() => {
                      setNewContact({ ...newContact, type: 'debtor' });
                      setContactModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-indigo-600 shrink-0"
                    title="Add Debtor"
                  >
                    <Plus size={18} />
                  </button>
                </div>

                {isContactsPending ? (
                  <div className="py-8 text-center text-sm text-gray-500">Loading contacts...</div>
                ) : contacts.filter((c) => c.type === 'debtor').length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-500">No debtors recorded.</div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-gray-700 text-left">
                        <tr>
                          <SortableTh label="Name" field="name" currentSort={contactsSort.sort} currentOrder={contactsSort.order} onSort={contactsSort.toggleSort} />
                          <SortableTh label="Type" field="type" currentSort={contactsSort.sort} currentOrder={contactsSort.order} onSort={contactsSort.toggleSort} />
                          <th className="px-4 py-3 font-semibold">Contact</th>
                          <th className="px-4 py-3 font-semibold text-right">Balance</th>
                          <SortableTh label="Added" field="createdAt" currentSort={contactsSort.sort} currentOrder={contactsSort.order} onSort={contactsSort.toggleSort} align="right" />
                          <th className="px-4 py-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {contacts.filter((c) => c.type === 'debtor').map((c) => (
                          <tr key={c._id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                            <td className="px-4 py-3 capitalize text-gray-500">{c.type}</td>
                            <td className="px-4 py-3 text-gray-500 text-xs">{c.phone || c.email || 'No contact details'}</td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800 tabular-nums">
                              {(c.outstandingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} LKR
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs text-gray-500 whitespace-nowrap">
                              {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => {
                                  setNewPayment({ contactId: c._id, amount: c.outstandingBalance || 0, paymentType: 'cash', description: 'Debtor settlement payment' });
                                  setPaymentModalOpen(true);
                                }}
                                className="text-xs font-semibold px-2.5 py-1 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                              >
                                Record Payment
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Creditors Section */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Creditors (Accounts Payable)</h2>
                    <p className="text-xs text-gray-600">Suppliers to whom we owe money for stock purchases.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setBillModalOpen(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-slate-700 text-xs font-semibold hover:bg-gray-50"
                    >
                      <Plus size={14} /> Record Bill
                    </button>
                    <button
                      onClick={() => {
                        setNewContact({ ...newContact, type: 'creditor' });
                        setContactModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-indigo-600 shrink-0"
                      title="Add Creditor"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>

                {isContactsPending ? (
                  <div className="py-8 text-center text-sm text-gray-500">Loading contacts...</div>
                ) : contacts.filter((c) => c.type === 'creditor').length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-500">No creditors recorded.</div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-gray-700 text-left">
                        <tr>
                          <SortableTh label="Name" field="name" currentSort={contactsSort.sort} currentOrder={contactsSort.order} onSort={contactsSort.toggleSort} />
                          <SortableTh label="Type" field="type" currentSort={contactsSort.sort} currentOrder={contactsSort.order} onSort={contactsSort.toggleSort} />
                          <th className="px-4 py-3 font-semibold">Contact</th>
                          <th className="px-4 py-3 font-semibold text-right">Amount Due</th>
                          <SortableTh label="Added" field="createdAt" currentSort={contactsSort.sort} currentOrder={contactsSort.order} onSort={contactsSort.toggleSort} align="right" />
                          <th className="px-4 py-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {contacts.filter((c) => c.type === 'creditor').map((c) => (
                          <tr key={c._id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                            <td className="px-4 py-3 capitalize text-gray-500">{c.type}</td>
                            <td className="px-4 py-3 text-gray-500 text-xs">{c.phone || c.email || 'No contact details'}</td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800 tabular-nums">
                              {(c.outstandingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} LKR
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs text-gray-500 whitespace-nowrap">
                              {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => {
                                  setNewPayment({ contactId: c._id, amount: c.outstandingBalance || 0, paymentType: 'bank', description: 'Creditor settlement payment' });
                                  setPaymentModalOpen(true);
                                }}
                                className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors"
                              >
                                Record Payout
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB CONTENT: Payroll */}
          {activeTab === 'payroll' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-5">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Payroll runs</h2>
                  <p className="text-xs text-gray-600">Calculate wages and release salaries for store staff.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
                  <div className="flex gap-2">
                    <select
                      value={payrollParams.month}
                      onChange={(e) => setPayrollParams({ ...payrollParams, month: Number(e.target.value) })}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm min-h-[40px]"
                    >
                      {[...Array(12)].map((_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}
                        </option>
                      ))}
                    </select>
                    <select
                      value={payrollParams.year}
                      onChange={(e) => setPayrollParams({ ...payrollParams, year: Number(e.target.value) })}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm min-h-[40px]"
                    >
                      {[2025, 2026, 2027].map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => calculatePayrollMutation.mutate(payrollParams)}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-500 transition-colors w-full sm:w-auto text-center cursor-pointer min-h-[40px]"
                  >
                    Calculate Draft Payroll
                  </button>
                </div>
              </div>

              {isPayrollPending ? (
                <div className="py-8 text-center text-sm text-gray-500">Loading payroll history...</div>
              ) : payroll.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">No payroll runs generated. Click calculate above.</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-700 text-left">
                      <tr>
                        <SortableTh label="Month" field="month" currentSort={payrollSort.sort} currentOrder={payrollSort.order} onSort={payrollSort.toggleSort} />
                        <SortableTh label="Year" field="year" currentSort={payrollSort.sort} currentOrder={payrollSort.order} onSort={payrollSort.toggleSort} />
                        <th className="px-4 py-3 font-semibold">Employees</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <SortableTh label="Created" field="createdAt" currentSort={payrollSort.sort} currentOrder={payrollSort.order} onSort={payrollSort.toggleSort} />
                        <th className="px-4 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {payroll.map((run) => (
                        <Fragment key={run._id}>
                          <tr className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {new Date(2000, run.month - 1, 1).toLocaleString('default', { month: 'long' })}
                            </td>
                            <td className="px-4 py-3 font-mono text-gray-700">{run.year}</td>
                            <td className="px-4 py-3 text-gray-600">{run.slips?.length || 0}</td>
                            <td className="px-4 py-3">
                              {run.status === 'draft' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200">
                                  <AlertCircle size={12} /> Draft
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                                  <CheckCircle size={12} /> Released & Paid
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                              {run.createdAt ? new Date(run.createdAt).toLocaleString() : '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {run.status === 'draft' && (
                                <button
                                  onClick={() => releasePayrollMutation.mutate(run._id)}
                                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors"
                                >
                                  Approve & Release Wages
                                </button>
                              )}
                            </td>
                          </tr>
                          {run.slips?.length > 0 && (
                            <tr className="bg-slate-50/50">
                              <td colSpan={6} className="px-4 py-2">
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-xs text-left">
                                    <thead>
                                      <tr className="text-slate-500">
                                        <th className="py-1">Employee</th>
                                        <th className="py-1 text-right">Basic</th>
                                        <th className="py-1 text-right">Allowances</th>
                                        <th className="py-1 text-right">OT Pay</th>
                                        <th className="py-1 text-right">Tax Withheld</th>
                                        <th className="py-1 text-right font-semibold text-slate-700">Net Pay</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {run.slips.map((slip, i) => (
                                        <tr key={slip.userId || i}>
                                          <td className="py-1.5 font-medium text-slate-700">{slip.employeeName}</td>
                                          <td className="py-1.5 text-right tabular-nums">{(slip.basicSalary || 0).toLocaleString()}</td>
                                          <td className="py-1.5 text-right tabular-nums">{(slip.allowances || 0).toLocaleString()}</td>
                                          <td className="py-1.5 text-right tabular-nums">{(slip.overtimePay || 0).toLocaleString()}</td>
                                          <td className="py-1.5 text-right tabular-nums">{(slip.taxWithheld || 0).toLocaleString()}</td>
                                          <td className="py-1.5 text-right font-semibold tabular-nums text-slate-800">{(slip.netPay || 0).toLocaleString()}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT: Financial Reports */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              {/* Filter Banner */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => setReportType('pl')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      reportType === 'pl' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Profit & Loss
                  </button>
                  <button
                    onClick={() => setReportType('bs')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      reportType === 'bs' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Balance Sheet
                  </button>
                  <button
                    onClick={() => setReportType('cf')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      reportType === 'cf' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Cash Flow
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                  {reportType !== 'bs' ? (
                    <div className="flex gap-3 w-full sm:w-auto">
                      <label className="text-xs text-gray-500 font-semibold flex-1 sm:flex-initial">
                        From
                        <input
                          type="date"
                          value={reportFilters.start}
                          onChange={(e) => setReportFilters({ ...reportFilters, start: e.target.value })}
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm min-h-[40px]"
                        />
                      </label>
                      <label className="text-xs text-gray-500 font-semibold flex-1 sm:flex-initial">
                        To
                        <input
                          type="date"
                          value={reportFilters.end}
                          onChange={(e) => setReportFilters({ ...reportFilters, end: e.target.value })}
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm min-h-[40px]"
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="text-xs text-gray-500 font-semibold w-full sm:w-auto">
                      As Of Date
                      <input
                        type="date"
                        value={reportFilters.date}
                        onChange={(e) => setReportFilters({ ...reportFilters, date: e.target.value })}
                        className="mt-1 block w-full sm:w-48 rounded-lg border border-gray-300 px-3 py-1.5 text-sm min-h-[40px]"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* REPORT DISPLAY AREA */}
              {reportType === 'pl' && (
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
                  {isPlPending ? (
                    <div className="py-12 text-center text-sm text-gray-500">Generating report...</div>
                  ) : plReport ? (
                    <div className="space-y-6 max-w-2xl mx-auto">
                      <div className="text-center border-b border-gray-200 pb-4">
                        <h3 className="text-xl font-bold text-gray-900">Profit & Loss Statement</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          For the period {new Date(plReport.startDate).toLocaleDateString()} to {new Date(plReport.endDate).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Revenues */}
                      <div className="space-y-2">
                        <p className="text-sm font-bold text-slate-800 uppercase tracking-wider">Revenue</p>
                        {plReport.items.filter(item => item.type === 'revenue').map(item => (
                          <div key={item.code} className="flex justify-between text-sm pl-4">
                            <span>{item.code} — {item.name}</span>
                            <span className="font-mono tabular-nums">{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-semibold border-t border-slate-200 pt-1.5">
                          <span>Total Revenue</span>
                          <span className="font-mono tabular-nums">{plReport.totalRevenues.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                      {/* Expenses */}
                      <div className="space-y-2">
                        <p className="text-sm font-bold text-slate-800 uppercase tracking-wider">Operating Expenses</p>
                        {plReport.items.filter(item => item.type === 'expense').map(item => (
                          <div key={item.code} className="flex justify-between text-sm pl-4">
                            <span>{item.code} — {item.name}</span>
                            <span className="font-mono tabular-nums">{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-semibold border-t border-slate-200 pt-1.5">
                          <span>Total Operating Expenses</span>
                          <span className="font-mono tabular-nums">{plReport.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                      {/* Net income */}
                      <div className="border-t-2 border-slate-900 pt-3 flex justify-between text-lg font-bold">
                        <span>Net Profit / Loss</span>
                        <span className={`font-mono tabular-nums ${plReport.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {plReport.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })} LKR
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {reportType === 'bs' && (
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
                  {isBsPending ? (
                    <div className="py-12 text-center text-sm text-gray-500">Generating report...</div>
                  ) : bsReport ? (
                    <div className="space-y-6 max-w-2xl mx-auto">
                      <div className="text-center border-b border-gray-200 pb-4">
                        <h3 className="text-xl font-bold text-gray-900">Balance Sheet</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          As of {new Date(bsReport.date).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Assets */}
                      <div className="space-y-2">
                        <p className="text-sm font-bold text-slate-800 uppercase tracking-wider">Assets</p>
                        {bsReport.items.filter(item => item.type === 'asset').map(item => (
                          <div key={item.code} className="flex justify-between text-sm pl-4">
                            <span>{item.code} — {item.name}</span>
                            <span className="font-mono tabular-nums">{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-semibold border-t border-slate-200 pt-1.5">
                          <span>Total Assets</span>
                          <span className="font-mono tabular-nums">{bsReport.totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                      {/* Liabilities */}
                      <div className="space-y-2">
                        <p className="text-sm font-bold text-slate-800 uppercase tracking-wider">Liabilities</p>
                        {bsReport.items.filter(item => item.type === 'liability').map(item => (
                          <div key={item.code} className="flex justify-between text-sm pl-4">
                            <span>{item.code} — {item.name}</span>
                            <span className="font-mono tabular-nums">{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-semibold border-t border-slate-200 pt-1.5">
                          <span>Total Liabilities</span>
                          <span className="font-mono tabular-nums">{bsReport.totalLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                      {/* Equity */}
                      <div className="space-y-2">
                        <p className="text-sm font-bold text-slate-800 uppercase tracking-wider">Equity</p>
                        {bsReport.items.filter(item => item.type === 'equity').map(item => (
                          <div key={item.code} className="flex justify-between text-sm pl-4">
                            <span>{item.code} — {item.name}</span>
                            <span className="font-mono tabular-nums">{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm pl-4 text-slate-600 italic">
                          <span>Current Period Retained Income</span>
                          <span className="font-mono tabular-nums">{bsReport.currentPeriodProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-sm font-semibold border-t border-slate-200 pt-1.5">
                          <span>Total Equity</span>
                          <span className="font-mono tabular-nums">{bsReport.totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                      {/* Double entry assurance */}
                      <div className="border-t-2 border-slate-900 pt-3 space-y-1.5">
                        <div className="flex justify-between text-md font-bold">
                          <span>Total Assets</span>
                          <span className="font-mono tabular-nums">{bsReport.totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })} LKR</span>
                        </div>
                        <div className="flex justify-between text-md font-bold">
                          <span>Total Liabilities & Equity</span>
                          <span className="font-mono tabular-nums">{(bsReport.totalLiabilities + bsReport.totalEquity).toLocaleString(undefined, { minimumFractionDigits: 2 })} LKR</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {reportType === 'cf' && (
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
                  {isCfPending ? (
                    <div className="py-12 text-center text-sm text-gray-500">Generating report...</div>
                  ) : cfReport ? (
                    <div className="space-y-6 max-w-2xl mx-auto">
                      <div className="text-center border-b border-gray-200 pb-4">
                        <h3 className="text-xl font-bold text-gray-900">Direct Cash Flow Statement</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          For the period {new Date(cfReport.startDate).toLocaleDateString()} to {new Date(cfReport.endDate).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between text-sm">
                          <span>Total Cash Receipts / Inflows</span>
                          <span className="font-mono text-green-700 font-semibold">+{cfReport.cashReceipts.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Total Cash Payments / Outflows</span>
                          <span className="font-mono text-red-700 font-semibold">-{cfReport.cashPayments.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                      <div className="border-t-2 border-slate-900 pt-3 flex justify-between text-lg font-bold">
                        <span>Net Cash Flow</span>
                        <span className={`font-mono tabular-nums ${cfReport.netCashFlow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {cfReport.netCashFlow.toLocaleString(undefined, { minimumFractionDigits: 2 })} LKR
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* MODALS */}
          {/* Account Modal */}
          {accountModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
              <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Ledger Account</h3>
                <form onSubmit={(e) => { e.preventDefault(); createAccountMutation.mutate(newAccount); }} className="space-y-3">
                  <label className="block text-xs text-gray-600">
                    Code
                    <input
                      required
                      type="text"
                      value={newAccount.code}
                      onChange={(e) => setNewAccount({ ...newAccount, code: e.target.value })}
                      placeholder="e.g. 1005"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-xs text-gray-600">
                    Name
                    <input
                      required
                      type="text"
                      value={newAccount.name}
                      onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                      placeholder="e.g. Petty Cash"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-xs text-gray-600">
                    Type
                    <select
                      value={newAccount.type}
                      onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="asset">Asset</option>
                      <option value="liability">Liability</option>
                      <option value="equity">Equity</option>
                      <option value="revenue">Revenue</option>
                      <option value="expense">Expense</option>
                    </select>
                  </label>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setAccountModalOpen(false)} className="px-3 py-2 text-sm text-gray-700">Cancel</button>
                    <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold">Create Account</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Journal Modal */}
          {journalModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
              <div className="bg-white rounded-xl max-w-2xl w-full p-5 shadow-xl border border-gray-200 max-h-[85vh] overflow-y-auto">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Post Manual Journal Entry</h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (Math.abs(journalTotalDebits - journalTotalCredits) > 0.01) {
                      toast.error('Double-entry validation failed: Total Debits must equal Total Credits.');
                      return;
                    }
                    createJournalMutation.mutate(newJournal);
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <label className="block text-xs text-gray-600">
                      Date
                      <input
                        required
                        type="date"
                        value={newJournal.date}
                        onChange={(e) => setNewJournal({ ...newJournal, date: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-xs text-gray-600">
                      Reference
                      <input
                        required
                        type="text"
                        value={newJournal.reference}
                        onChange={(e) => setNewJournal({ ...newJournal, reference: e.target.value })}
                        placeholder="e.g. Inv-001"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                  <label className="block text-xs text-gray-600">
                    Description
                    <input
                      required
                      type="text"
                      value={newJournal.description}
                      onChange={(e) => setNewJournal({ ...newJournal, description: e.target.value })}
                      placeholder="Enter adjustment memo..."
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>

                  {/* Entry Lines */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-700">Debits & Credits lines</p>
                    {newJournal.lines.map((line, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <select
                          required
                          value={line.accountId}
                          onChange={(e) => handleJournalLineChange(idx, 'accountId', e.target.value)}
                          className="w-1/3 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                        >
                          <option value="">Select Account</option>
                          {accounts.map(a => (
                            <option key={a._id} value={a._id}>{a.code} — {a.name}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => handleJournalLineChange(idx, 'description', e.target.value)}
                          placeholder="Line description"
                          className="w-1/3 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={line.debit}
                          onChange={(e) => handleJournalLineChange(idx, 'debit', Number(e.target.value))}
                          placeholder="Debit"
                          className="w-1/6 rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-right font-mono"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={line.credit}
                          onChange={(e) => handleJournalLineChange(idx, 'credit', Number(e.target.value))}
                          placeholder="Credit"
                          className="w-1/6 rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-right font-mono"
                        />
                        {newJournal.lines.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeJournalLine(idx)}
                            className="text-red-500 text-sm font-semibold hover:opacity-80"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addJournalLine}
                      className="text-xs text-indigo-600 font-semibold hover:underline"
                    >
                      + Add line
                    </button>
                  </div>

                  {/* Balancing display */}
                  <div className="flex justify-between text-xs font-semibold bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                    <span>Total Debits: {journalTotalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    <span>Total Credits: {journalTotalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    <span className={Math.abs(journalTotalDebits - journalTotalCredits) <= 0.01 ? 'text-green-700' : 'text-red-700'}>
                      Difference: {Math.abs(journalTotalDebits - journalTotalCredits).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setJournalModalOpen(false)} className="px-3 py-2 text-sm text-gray-700">Cancel</button>
                    <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold">Post Entry</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Contact Modal */}
          {accountModalOpen === false && contactModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
              <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Contact</h3>
                <form onSubmit={(e) => { e.preventDefault(); createContactMutation.mutate(newContact); }} className="space-y-3">
                  <label className="block text-xs text-gray-600">
                    Name
                    <input
                      required
                      type="text"
                      value={newContact.name}
                      onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                      placeholder="e.g. Suppliers Inc."
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-xs text-gray-600">
                    Type
                    <select
                      value={newContact.type}
                      onChange={(e) => setNewContact({ ...newContact, type: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="debtor">Debtor (Customer)</option>
                      <option value="creditor">Creditor (Supplier)</option>
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs text-gray-600">
                      Phone
                      <input
                        type="text"
                        value={newContact.phone}
                        onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-xs text-gray-600">
                      Email
                      <input
                        type="email"
                        value={newContact.email}
                        onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                  <label className="block text-xs text-gray-600">
                    Address
                    <input
                      type="text"
                      value={newContact.address}
                      onChange={(e) => setNewContact({ ...newContact, address: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setContactModalOpen(false)} className="px-3 py-2 text-sm text-gray-700">Cancel</button>
                    <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold">Save Contact</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Payment Modal */}
          {paymentModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
              <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Record Payment / Payout</h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    postPaymentMutation.mutate({
                      id: newPayment.contactId,
                      payload: {
                        amount: newPayment.amount,
                        paymentType: newPayment.paymentType,
                        description: newPayment.description
                      }
                    });
                  }}
                  className="space-y-3"
                >
                  <label className="block text-xs text-gray-600">
                    Amount
                    <input
                      required
                      type="number"
                      value={newPayment.amount}
                      onChange={(e) => setNewPayment({ ...newPayment, amount: Number(e.target.value) })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
                    />
                  </label>
                  <label className="block text-xs text-gray-600">
                    Payment Method
                    <select
                      value={newPayment.paymentType}
                      onChange={(e) => setNewPayment({ ...newPayment, paymentType: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="cash">Cash on Hand</option>
                      <option value="bank">Bank Account Transfer</option>
                    </select>
                  </label>
                  <label className="block text-xs text-gray-600">
                    Description / Note
                    <input
                      type="text"
                      value={newPayment.description}
                      onChange={(e) => setNewPayment({ ...newPayment, description: e.target.value })}
                      placeholder="Memo note..."
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setPaymentModalOpen(false)} className="px-3 py-2 text-sm text-gray-700">Cancel</button>
                    <button type="submit" className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold">Post Settlement</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Bill Modal */}
          {billModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
              <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Record Supplier Bill</h3>
                <form onSubmit={(e) => { e.preventDefault(); postBillMutation.mutate(newBill); }} className="space-y-3">
                  <label className="block text-xs text-gray-600">
                    Supplier Name
                    <input
                      required
                      type="text"
                      value={newBill.supplierName}
                      onChange={(e) => setNewBill({ ...newBill, supplierName: e.target.value })}
                      placeholder="e.g. Vegetable Supplier"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-xs text-gray-600">
                    Invoice Amount
                    <input
                      required
                      type="number"
                      value={newBill.amount}
                      onChange={(e) => setNewBill({ ...newBill, amount: Number(e.target.value) })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs text-gray-600">
                      Invoice Number
                      <input
                        type="text"
                        value={newBill.invoiceNumber}
                        onChange={(e) => setNewBill({ ...newBill, invoiceNumber: e.target.value })}
                        placeholder="INV-1025"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
                      />
                    </label>
                    <label className="block text-xs text-gray-600">
                      Bill Date
                      <input
                        type="date"
                        value={newBill.date}
                        onChange={(e) => setNewBill({ ...newBill, date: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                  <label className="block text-xs text-gray-600">
                    Description / Note
                    <input
                      type="text"
                      value={newBill.description}
                      onChange={(e) => setNewBill({ ...newBill, description: e.target.value })}
                      placeholder="e.g. Monthly stock replenishment"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setBillModalOpen(false)} className="px-3 py-2 text-sm text-gray-700">Cancel</button>
                    <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold">Post Supplier Bill</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
