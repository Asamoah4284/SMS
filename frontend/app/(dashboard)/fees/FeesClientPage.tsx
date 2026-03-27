'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Modal, PageHeader, AdminOnly } from '@/components/ui';
import { classLevelLabels } from '@/lib/theme';
import {
  Banknote, ChevronRight, Plus, Trash2, Edit2,
  CheckCircle2, AlertTriangle, Clock, Loader2, Settings,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Term { id: string; name: string; year: number; isCurrent: boolean; }

interface FeeStructure {
  id: string; name: string; amount: number;
  classLevel: string | null;
  term: { id: string; name: string; year: number } | null;
  _count: { feePayments: number };
}

interface ClassOverview {
  id: string; name: string; level: string;
  classTeacher: { name: string } | null;
  totalStudents: number;
  feeStructure: { id: string; name: string; amount: number } | null;
  totalDue: number | null;
  totalCollected: number;
  fullyPaid: number; halfPaid: number; partial: number; unpaid: number;
  noStructure: number;
  collectionRate: number | null;
}

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : ''; }
const API = process.env.NEXT_PUBLIC_API_URL;

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function FeesClientPage() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedTermId, setSelectedTermId] = useState('');
  const [classes, setClasses] = useState<ClassOverview[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [termsLoading, setTermsLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'overview' | 'structures'>('overview');
  const [structureModal, setStructureModal] = useState<FeeStructure | null | 'new'>(null);

  useEffect(() => {
    const token = getToken();
    fetch(`${API}/terms`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        const list: Term[] = d.terms ?? [];
        setTerms(list);
        const cur = list.find((t) => t.isCurrent);
        setSelectedTermId(cur?.id ?? list[0]?.id ?? '');
        if (list.length === 0) setLoading(false);
      })
      .catch(() => setLoading(false))
      .finally(() => setTermsLoading(false));
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedTermId) return;
    setLoading(true); setError('');
    try {
      const token = getToken();
      const [overviewRes, structRes] = await Promise.all([
        fetch(`${API}/fees/overview?termId=${selectedTermId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/fees/structures?termId=${selectedTermId}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!overviewRes.ok) throw new Error('Failed to fetch overview');
      setClasses((await overviewRes.json()).classes ?? []);
      setStructures(structRes.ok ? (await structRes.json()).structures ?? [] : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally { setLoading(false); }
  }, [selectedTermId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeleteStructure = async (id: string) => {
    if (!confirm('Delete this fee structure?')) return;
    const token = getToken();
    const res = await fetch(`${API}/fees/structures/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) { alert(data.message); return; }
    fetchData();
  };

  const selectedTerm = terms.find((t) => t.id === selectedTermId);
  const totalCollected = classes.reduce((s, c) => s + c.totalCollected, 0);
  const totalDue = classes.reduce((s, c) => s + (c.totalDue ?? 0), 0);

  return (
    <AdminOnly>
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Fees"
        subtitle="Track and manage student fee payments"
      />

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white shadow-sm"
          value={selectedTermId}
          onChange={(e) => setSelectedTermId(e.target.value)}
        >
          {terms.map((t) => (
            <option key={t.id} value={t.id}>{t.name} {t.year}{t.isCurrent ? ' ★' : ''}</option>
          ))}
        </select>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(['overview', 'structures'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'structures' ? 'Fee Structures' : 'Overview'}
            </button>
          ))}
        </div>
        {tab === 'structures' && (
          <Button variant="primary" size="sm" onClick={() => setStructureModal('new')} className="ml-auto">
            <Plus size={14} className="mr-1" />New Structure
          </Button>
        )}
      </div>

      {error && <Alert type="error" message={error} />}

      {/* Summary cards */}
      {!loading && tab === 'overview' && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">Total Due</p>
            <p className="text-2xl font-bold text-gray-900">GHS {totalDue.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">Total Collected</p>
            <p className="text-2xl font-bold text-success-700">GHS {totalCollected.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">Outstanding</p>
            <p className="text-2xl font-bold text-danger-600">GHS {Math.max(0, totalDue - totalCollected).toLocaleString()}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : tab === 'overview' ? (
        <ClassOverviewList classes={classes} termId={selectedTermId} />
      ) : (
        <FeeStructuresList
          structures={structures}
          onEdit={(s) => setStructureModal(s)}
          onDelete={handleDeleteStructure}
        />
      )}

      {structureModal !== null && (
        <FeeStructureModal
          structure={structureModal === 'new' ? null : structureModal}
          termId={selectedTermId}
          onClose={() => setStructureModal(null)}
          onSaved={() => { setStructureModal(null); fetchData(); }}
        />
      )}
    </div>
    </AdminOnly>
  );
}

// ─── Class Overview List ──────────────────────────────────────────────────────

function ClassOverviewList({ classes, termId }: { classes: ClassOverview[]; termId: string }) {
  if (classes.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Banknote size={40} className="mx-auto mb-3 opacity-40" />
        <p>No classes found</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {classes.map((cls) => {
        const rate = cls.collectionRate;
        const hasStructure = !!cls.feeStructure;

        return (
          <Link
            key={cls.id}
            href={`/fees/${cls.id}?termId=${termId}`}
            className="flex items-center gap-4 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:border-primary-300 hover:shadow-md transition-all group"
          >
            {/* Rate ring */}
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gray-50 shrink-0 relative">
              {hasStructure ? (
                <span className={`text-sm font-bold ${
                  (rate ?? 0) >= 80 ? 'text-success-600' : (rate ?? 0) >= 50 ? 'text-warning-600' : 'text-danger-600'
                }`}>{rate ?? 0}%</span>
              ) : (
                <Settings size={18} className="text-gray-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900 group-hover:text-primary-700">{cls.name}</p>
                {!hasStructure && <span className="text-xs text-warning-600 bg-warning-50 px-2 py-0.5 rounded-full">No fee set</span>}
              </div>
              <p className="text-xs text-gray-500">
                {cls.classTeacher?.name ?? 'No class teacher'} · {cls.totalStudents} students
                {hasStructure && ` · GHS ${cls.feeStructure!.amount.toLocaleString()}`}
              </p>
              {/* Progress bar */}
              {hasStructure && cls.totalStudents > 0 && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        (rate ?? 0) >= 80 ? 'bg-success-400' : (rate ?? 0) >= 50 ? 'bg-warning-400' : 'bg-danger-400'
                      }`}
                      style={{ width: `${Math.min(rate ?? 0, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {cls.fullyPaid} paid · {cls.partial + cls.halfPaid} partial · {cls.unpaid} unpaid
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {hasStructure && (
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-gray-900">GHS {cls.totalCollected.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">of GHS {(cls.totalDue ?? 0).toLocaleString()}</p>
                </div>
              )}
              <ChevronRight size={18} className="text-gray-400 group-hover:text-primary-600" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ─── Fee Structures List ──────────────────────────────────────────────────────

function FeeStructuresList({ structures, onEdit, onDelete }: {
  structures: FeeStructure[];
  onEdit: (s: FeeStructure) => void;
  onDelete: (id: string) => void;
}) {
  if (structures.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Settings size={40} className="mx-auto mb-3 opacity-40" />
        <p className="font-medium">No fee structures for this term</p>
        <p className="text-sm mt-1">Create a fee structure to start tracking payments.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {structures.map((s) => (
        <div key={s.id} className="flex items-center justify-between bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div>
            <p className="font-semibold text-gray-900">{s.name}</p>
            <p className="text-sm text-gray-500">
              GHS {s.amount.toLocaleString()}
              {s.classLevel && ` · ${classLevelLabels[s.classLevel] ?? s.classLevel}`}
              {' · '}{s._count.feePayments} payments recorded
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onEdit(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors">
              <Edit2 size={15} />
            </button>
            <button onClick={() => onDelete(s.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-danger-600 hover:bg-danger-50 transition-colors">
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Fee Structure Modal ──────────────────────────────────────────────────────

const CLASS_LEVELS = [
  'BASIC_1','BASIC_2','BASIC_3','BASIC_4','BASIC_5','BASIC_6',
  'JHS_1','JHS_2','JHS_3',
];

function FeeStructureModal({ structure, termId, onClose, onSaved }: {
  structure: FeeStructure | null;
  termId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: structure?.name ?? '',
    amount: structure?.amount?.toString() ?? '',
    classLevel: structure?.classLevel ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    const token = getToken();
    const method = structure ? 'PUT' : 'POST';
    const url = structure ? `${API}/fees/structures/${structure.id}` : `${API}/fees/structures`;
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, termId }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.message); return; }
    onSaved();
  };

  return (
    <Modal isOpen title={structure ? 'Edit Fee Structure' : 'New Fee Structure'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert type="error" message={error} />}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input type="text"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            placeholder="e.g. Term 1 School Fees"
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount (GHS) *</label>
          <input type="number" min="0" step="0.01"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            placeholder="e.g. 800"
            value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Applies to Class Level</label>
          <select
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            value={form.classLevel} onChange={(e) => setForm({ ...form, classLevel: e.target.value })}
          >
            <option value="">All levels (generic)</option>
            {CLASS_LEVELS.map((l) => (
              <option key={l} value={l}>{classLevelLabels[l] ?? l}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin mr-1" />}
            {structure ? 'Save Changes' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
