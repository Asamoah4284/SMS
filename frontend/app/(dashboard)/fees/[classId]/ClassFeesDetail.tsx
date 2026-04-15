'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Alert, Button, Modal, AdminOnly } from '@/components/ui';
import { ChevronLeft, Banknote, Plus, Trash2, Loader2, Save, Search } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Term { id: string; name: string; year: number; isCurrent: boolean; }
interface FeeStructure { id: string; name: string; amount: number; category?: string }

interface SupplementaryFee {
  id: string;
  name: string;
  amount: number;
  category: string;
  notes: string | null;
}

interface StudentPayment {
  id: string;
  studentId: string;
  name: string;
  parentName: string | null;
  parentPhone: string | null;
  amountDue: number;
  tuitionDue?: number;
  supplementaryTotal?: number;
  totalPaid: number;
  balance: number;
  status: 'FULLY_PAID' | 'HALF_PAID' | 'PARTIAL' | 'UNPAID' | 'NO_STRUCTURE';
  payments: PaymentRecord[];
}

interface PaymentRecord {
  id: string;
  amountPaid: number;
  paymentMethod: string | null;
  receiptNumber: string | null;
  paidAt: string | null;
  feeStructure: { id: string; name: string; amount: number };
}

type Filter = 'ALL' | 'UNPAID' | 'PARTIAL' | 'HALF_PAID' | 'FULLY_PAID';

const STATUS_CFG = {
  FULLY_PAID: { label: 'Paid', bg: 'bg-success-100 text-success-800', dot: 'bg-success-400' },
  HALF_PAID:  { label: 'Half Paid', bg: 'bg-blue-50 text-blue-700', dot: 'bg-blue-400' },
  PARTIAL:    { label: 'Partial', bg: 'bg-warning-50 text-warning-700', dot: 'bg-warning-400' },
  UNPAID:     { label: 'Unpaid', bg: 'bg-danger-50 text-danger-700', dot: 'bg-danger-400' },
  NO_STRUCTURE: { label: 'No Fee Set', bg: 'bg-gray-100 text-gray-600', dot: 'bg-gray-300' },
};

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : ''; }
const API = process.env.NEXT_PUBLIC_API_URL;

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ClassFeesDetail({ classId, initialTermId }: { classId: string; initialTermId: string }) {
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedTermId, setSelectedTermId] = useState(initialTermId);
  const [students, setStudents] = useState<StudentPayment[]>([]);
  const [feeStructure, setFeeStructure] = useState<FeeStructure | null>(null);
  const [supplementaryFees, setSupplementaryFees] = useState<SupplementaryFee[]>([]);
  const [totalExpectedPerStudent, setTotalExpectedPerStudent] = useState<number | null>(null);
  const [className, setClassName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [paymentModal, setPaymentModal] = useState<StudentPayment | null>(null);

  useEffect(() => {
    const token = getToken();
    fetch(`${API}/terms`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        const list: Term[] = d.terms ?? [];
        setTerms(list);
        if (!selectedTermId) {
          const cur = list.find((t) => t.isCurrent);
          setSelectedTermId(cur?.id ?? list[0]?.id ?? '');
        }
      }).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedTermId) return;
    setLoading(true); setError('');
    try {
      const token = getToken();
      const res = await fetch(`${API}/fees/class/${classId}?termId=${selectedTermId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch class fees');
      const data = await res.json();
      setStudents(data.students ?? []);
      setFeeStructure(data.feeStructure ?? null);
      setSupplementaryFees(data.supplementaryFees ?? []);
      setTotalExpectedPerStudent(
        typeof data.totalExpectedPerStudent === 'number' ? data.totalExpectedPerStudent : null,
      );
      setClassName(data.class?.name ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally { setLoading(false); }
  }, [classId, selectedTermId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeletePayment = async (id: string) => {
    if (!confirm('Reverse this payment?')) return;
    const token = getToken();
    const res = await fetch(`${API}/fees/payments/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { alert('Failed to reverse payment'); return; }
    fetchData();
  };

  const studentsForTab = useMemo(
    () => (filter === 'ALL' ? students : students.filter((s) => s.status === filter)),
    [students, filter],
  );

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return studentsForTab;
    const digitsOnly = q.replace(/\D/g, '');
    return studentsForTab.filter((st) => {
      const name = st.name.toLowerCase();
      const parent = (st.parentName ?? '').toLowerCase();
      const phoneDigits = (st.parentPhone ?? '').replace(/\D/g, '');
      if (name.includes(q) || parent.includes(q)) return true;
      if (digitsOnly.length > 0 && phoneDigits.includes(digitsOnly)) return true;
      return false;
    });
  }, [studentsForTab, searchQuery]);

  const totalStudents = students.length;
  const fullyPaid = students.filter((s) => s.status === 'FULLY_PAID').length;
  const partial = students.filter((s) => s.status === 'PARTIAL' || s.status === 'HALF_PAID').length;
  const unpaid = students.filter((s) => s.status === 'UNPAID').length;
  const totalCollected = students.reduce((s, st) => s + st.totalPaid, 0);
  const totalDue = students.reduce((s, st) => s + st.amountDue, 0);

  const selectedTerm = terms.find((t) => t.id === selectedTermId);

  return (
    <AdminOnly>
    <div className="animate-fade-in space-y-6 px-5 py-6 sm:px-8 md:px-10 lg:px-12 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/fees" className="text-gray-400 hover:text-gray-700 transition-colors">
          <ChevronLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{className}</h1>
          <p className="text-sm text-gray-500">
            {selectedTerm ? `${selectedTerm.name} ${selectedTerm.year}` : 'Select a term'}
            {feeStructure && ` · Tuition: ${feeStructure.name} · GHS ${feeStructure.amount.toLocaleString()}`}
            {supplementaryFees.length > 0 && (
              <span>
                {' '}
                + {supplementaryFees.length} other item{supplementaryFees.length !== 1 ? 's' : ''}
                {totalExpectedPerStudent != null && (
                  <span className="font-semibold text-gray-700">
                    {' '}
                    · Expected per student: GHS {totalExpectedPerStudent.toLocaleString()}
                  </span>
                )}
              </span>
            )}
          </p>
        </div>
        <select
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white shadow-sm"
          value={selectedTermId}
          onChange={(e) => setSelectedTermId(e.target.value)}
        >
          {terms.map((t) => (
            <option key={t.id} value={t.id}>{t.name} {t.year}{t.isCurrent ? ' ★' : ''}</option>
          ))}
        </select>
      </div>

      {error && <Alert type="error" message={error} />}

      {!feeStructure && supplementaryFees.length === 0 && !loading && (
        <Alert type="warning" message="No tuition fee set for this class level and term. Go to Fees → Fee Structures to add school fees (or other charges)." />
      )}

      {!loading && supplementaryFees.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-100 rounded-2xl px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold text-amber-900 mb-2">Also billed this term (uniform / other fees)</p>
          <ul className="list-disc list-inside space-y-0.5 text-amber-900/90">
            {supplementaryFees.map((f) => (
              <li key={f.id}>
                {f.name} — GHS {f.amount.toLocaleString()}
                {f.notes ? ` (${f.notes})` : ''}
                <span className="text-amber-700/80 text-xs ml-1">[{f.category}]</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary */}
      {!loading && totalStudents > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-success-50 border border-success-100 rounded-2xl p-4 sm:p-5 text-center">
            <p className="text-2xl font-bold text-success-700">{fullyPaid}</p>
            <p className="text-xs text-success-600">Fully Paid</p>
          </div>
          <div className="bg-warning-50 border border-warning-100 rounded-2xl p-4 sm:p-5 text-center">
            <p className="text-2xl font-bold text-warning-700">{partial}</p>
            <p className="text-xs text-warning-600">Partial</p>
          </div>
          <div className="bg-danger-50 border border-danger-100 rounded-2xl p-4 sm:p-5 text-center">
            <p className="text-2xl font-bold text-danger-700">{unpaid}</p>
            <p className="text-xs text-danger-600">Unpaid</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 text-center">
            <p className="text-2xl font-bold text-gray-900">GHS {totalCollected.toLocaleString()}</p>
            <p className="text-xs text-gray-500">of GHS {totalDue.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {(['ALL', 'UNPAID', 'PARTIAL', 'HALF_PAID', 'FULLY_PAID'] as Filter[]).map((f) => {
          const count = f === 'ALL' ? totalStudents
            : f === 'PARTIAL' ? students.filter((s) => s.status === 'PARTIAL').length
            : f === 'HALF_PAID' ? students.filter((s) => s.status === 'HALF_PAID').length
            : students.filter((s) => s.status === f).length;
          const labels: Record<Filter, string> = {
            ALL: 'All', UNPAID: 'Unpaid', PARTIAL: 'Partial', HALF_PAID: 'Half Paid', FULLY_PAID: 'Paid',
          };
          return (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {labels[f]} {count > 0 && <span className="ml-1 text-xs text-gray-400">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Search students */}
      {!loading && students.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-xl">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setSearchQuery(searchInput.trim());
              }}
              placeholder="Search by student name, parent, or phone…"
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="Search students"
            />
          </div>
          <Button
            type="button"
            variant="primary"
            className="shrink-0"
            onClick={() => setSearchQuery(searchInput.trim())}
            icon={<Search className="w-4 h-4" />}
          >
            Search
          </Button>
        </div>
      )}

      {/* Student list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Banknote size={36} className="mx-auto mb-2 opacity-40" />
          <p>No students in this class</p>
        </div>
      ) : studentsForTab.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Banknote size={36} className="mx-auto mb-2 opacity-40" />
          <p>No students match this filter</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Search size={36} className="mx-auto mb-2 opacity-40" />
          <p className="font-medium text-gray-600">No students match your search.</p>
          <p className="text-sm mt-1">Try a different name or phone number.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredStudents.map((st) => {
            const cfg = STATUS_CFG[st.status];
            const isExpanded = expandedStudent === st.id;

            return (
              <div key={st.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-5 py-4 sm:px-6 sm:py-5 hover:bg-gray-50 transition-colors text-left"
                  onClick={() => setExpandedStudent(isExpanded ? null : st.id)}
                >
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{st.name}</p>
                    <p className="text-xs text-gray-500">
                      {st.parentPhone && <span className="mr-2">📞 {st.parentPhone}</span>}
                      Paid: GHS {st.totalPaid.toLocaleString()} · Balance: GHS {st.balance.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg}`}>{cfg.label}</span>
                    {st.status !== 'FULLY_PAID' && st.status !== 'NO_STRUCTURE' && (
                      <Button variant="primary" size="sm"
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setPaymentModal(st); }}
                      >
                        <Plus size={13} className="mr-0.5" />Pay
                      </Button>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4 sm:px-6 sm:py-5 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Payment History</p>
                      {feeStructure && (
                        <Button variant="ghost" size="sm" onClick={() => setPaymentModal(st)}>
                          <Plus size={13} className="mr-1" />Record Payment
                        </Button>
                      )}
                    </div>
                    {st.payments.length === 0 ? (
                      <p className="text-sm text-gray-400 py-2">No payments recorded</p>
                    ) : (
                      <div className="space-y-2">
                        {st.payments.map((p) => (
                          <div key={p.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-gray-100">
                            <div>
                              <p className="text-sm font-medium text-gray-900">GHS {p.amountPaid.toLocaleString()}</p>
                              <p className="text-xs text-gray-500">
                                {p.paymentMethod && `${p.paymentMethod} · `}
                                {p.receiptNumber && `Receipt: ${p.receiptNumber} · `}
                                {p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeletePayment(p.id)}
                              className="p-1 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {paymentModal && feeStructure && (
        <RecordPaymentModal
          student={paymentModal}
          feeStructure={feeStructure}
          termId={selectedTermId}
          onClose={() => setPaymentModal(null)}
          onSaved={() => { setPaymentModal(null); fetchData(); }}
        />
      )}
    </div>
    </AdminOnly>
  );
}

// ─── Record Payment Modal ─────────────────────────────────────────────────────

function RecordPaymentModal({ student, feeStructure, termId, onClose, onSaved }: {
  student: StudentPayment;
  feeStructure: FeeStructure;
  termId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    amountPaid: student.balance > 0 ? String(student.balance) : '',
    paymentMethod: 'Cash',
    receiptNumber: '',
    paidAt: new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const amt = parseFloat(form.amountPaid);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid positive amount');
      return;
    }
    if (amt > student.balance + 1e-6) {
      setError(
        `Amount cannot exceed remaining balance of GHS ${student.balance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      );
      return;
    }
    setSaving(true); setError('');
    const token = getToken();
    const res = await fetch(`${API}/fees/payments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: student.id,
        feeStructureId: feeStructure.id,
        termId,
        amountPaid: parseFloat(form.amountPaid),
        paymentMethod: form.paymentMethod || null,
        receiptNumber: form.receiptNumber || null,
        paidAt: form.paidAt,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.message); return; }
    onSaved();
  };

  return (
    <Modal isOpen={true} title={`Record Payment — ${student.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert type="error" message={error} />}

        <div className="bg-gray-50 rounded-xl p-3 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Total due:</span><span className="font-semibold">GHS {feeStructure.amount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Already paid:</span><span className="font-semibold text-success-600">GHS {student.totalPaid.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-200 mt-2 pt-2">
            <span>Balance:</span><span className="text-danger-600">GHS {student.balance.toLocaleString()}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid (GHS) *</label>
          <input type="number" min="0.01" step="0.01" max={student.balance}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            value={form.amountPaid}
            onChange={(e) => setForm({ ...form, amountPaid: e.target.value })} required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            >
              <option value="Cash">Cash</option>
              <option value="MoMo">Mobile Money</option>
              <option value="Bank">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input type="date"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              value={form.paidAt} onChange={(e) => setForm({ ...form, paidAt: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Number (optional)</label>
          <input type="text"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            placeholder="e.g. RCT-001"
            value={form.receiptNumber} onChange={(e) => setForm({ ...form, receiptNumber: e.target.value })}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
            Record Payment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
