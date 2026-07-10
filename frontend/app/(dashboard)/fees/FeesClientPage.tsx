'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Modal, PageHeader, AdminOnly } from '@/components/ui';
import { classLevelLabels } from '@/lib/theme';
import {
  Banknote,
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  Settings,
  Search,
  Users,
  BookOpen,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Term { id: string; name: string; year: number; isCurrent: boolean; }

type FeeCategory = 'TUITION' | 'UNIFORM' | 'OTHER';

interface FeeStructure {
  id: string; name: string; amount: number;
  category: FeeCategory;
  isRequired?: boolean;
  notes: string | null;
  classLevel: string | null;
  term: { id: string; name: string; year: number } | null;
  _count: { feePayments: number };
}

interface FeeLevelMeta {
  level: string;
  classes: { id: string; name: string }[];
}

const FEE_CATEGORY_LABEL: Record<FeeCategory, string> = {
  TUITION: 'School / Tuition',
  UNIFORM: 'Uniform',
  OTHER: 'Other fee',
};

interface ClassOverview {
  id: string; name: string; level: string;
  section: string | null;
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
    <div className="animate-fade-in space-y-6 px-5 py-6 sm:px-8 md:px-10 lg:px-12 max-w-[1600px] mx-auto">
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
              {t === 'structures' ? 'Fee items' : 'Overview'}
            </button>
          ))}
        </div>
        {tab === 'structures' && (
          <Button variant="primary" size="sm" onClick={() => setStructureModal('new')} className="ml-auto">
            <Plus size={14} className="mr-1" />Add fee item
          </Button>
        )}
      </div>

      {error && <Alert type="error" message={error} />}

      {/* Summary cards */}
      {!loading && tab === 'overview' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm animate-pulse dark:bg-white dark:border-gray-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="h-5 w-28 bg-gray-200 rounded-md" />
                  <div className="mt-2 h-4 w-36 bg-gray-100 rounded-full" />
                </div>
                <div className="h-5 w-24 bg-gray-100 rounded-full" />
              </div>
              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="h-4 w-24 bg-gray-100 rounded-md" />
                <div className="h-4 w-28 bg-gray-100 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : tab === 'overview' ? (
        <ClassOverviewList classes={classes} termId={selectedTermId} />
      ) : (
        <>
          <p className="text-sm text-gray-600 max-w-3xl">
            Add <strong>school fees</strong> (tuition) per class level, plus <strong>uniform</strong> or <strong>other</strong> charges
            (maintenance, robotics, music, graduation, etc.). Leave &quot;Applies to class level&quot; empty for a fee that applies to{' '}
            <em>all</em> classes (e.g. school-wide maintenance).
          </p>
          <FeeStructuresList
            structures={structures}
            onEdit={(s) => setStructureModal(s)}
            onDelete={handleDeleteStructure}
          />
        </>
      )}

      {structureModal !== null && (
        <FeeStructureModal
          isOpen={structureModal !== null}
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

// ─── Class Overview List (same card grid pattern as Results / examination) ───

function feeStatusBadge(cls: ClassOverview) {
  const hasStructure = !!cls.feeStructure;
  if (!hasStructure) {
    return (
      <Badge variant="warning" className="gap-1">
        <Settings className="w-3 h-3" />
        No fee set
      </Badge>
    );
  }
  if (cls.totalStudents === 0) {
    return (
      <Badge variant="default" className="gap-1 border-gray-200 bg-gray-50 text-gray-600">
        <Users className="w-3 h-3" />
        No students
      </Badge>
    );
  }
  const rate = cls.collectionRate ?? 0;
  if (rate >= 100) {
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle2 className="w-3 h-3" />
        Complete
      </Badge>
    );
  }
  if (rate > 0) {
    return (
      <Badge variant="warning" className="gap-1">
        <Clock className="w-3 h-3" />
        In progress
      </Badge>
    );
  }
  return (
    <Badge variant="default" className="gap-1 border-gray-200 bg-gray-50 text-gray-600">
      <AlertTriangle className="w-3 h-3" />
      Outstanding
    </Badge>
  );
}

function ClassOverviewList({ classes, termId }: { classes: ClassOverview[]; termId: string }) {
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter((cls) => {
      const levelLabel = classLevelLabels[cls.level as keyof typeof classLevelLabels] ?? cls.level;
      const section = cls.section?.trim() ?? '';
      const teacher = cls.classTeacher?.name?.toLowerCase() ?? '';
      const statusBits = [
        cls.feeStructure ? 'in progress complete outstanding' : 'no fee set',
        feeStatusLabel(cls),
      ].join(' ');
      const haystack = [cls.name, levelLabel, section, teacher, statusBits].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [classes, searchQuery]);

  if (classes.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Banknote size={40} className="mx-auto mb-3 opacity-40" />
        <p>No classes found</p>
      </div>
    );
  }

  const feeHref = (classId: string) =>
    `/fees/${classId}${termId ? `?termId=${termId}` : ''}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setSearchQuery(searchInput.trim());
            }}
            placeholder="Search class name, level, section, teacher, status…"
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-white dark:border-gray-200 dark:text-gray-900"
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

      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm dark:bg-white dark:border-gray-200">
          <p className="text-sm text-gray-500">No classes match your search.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((cls) => {
            const rate = cls.collectionRate ?? 0;
            const hasStructure = !!cls.feeStructure;
            const levelLabel =
              classLevelLabels[cls.level as keyof typeof classLevelLabels] ?? cls.level;
            const subLabel = cls.section?.trim()
              ? `${levelLabel} · Section ${cls.section!.trim()}`
              : levelLabel;
            const hasTeacher = Boolean(cls.classTeacher);

            return (
              <div
                key={cls.id}
                className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm dark:bg-white dark:border-gray-200"
              >
                <Link
                  href={feeHref(cls.id)}
                  className="group block rounded-xl transition-colors hover:bg-gray-50/80"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-bold text-gray-900 truncate">
                        {cls.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border border-gray-200 bg-gray-50 text-gray-700">
                          {subLabel}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {feeStatusBadge(cls)}
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-gray-500" />
                      <span className="font-semibold text-gray-900">
                        {cls.totalStudents}
                      </span>
                      <span className="text-sm text-gray-500">students</span>
                    </div>
                    <div className="text-right min-w-0">
                      <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                        Class teacher
                      </p>
                      <p
                        className={`text-sm font-semibold truncate ${
                          hasTeacher ? 'text-gray-900' : 'text-gray-400'
                        }`}
                      >
                        {hasTeacher ? cls.classTeacher!.name : 'Not assigned'}
                      </p>
                    </div>
                  </div>

                  {hasStructure && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-gray-600">
                          Collected{' '}
                          <span className="font-semibold text-gray-900">
                            GHS {cls.totalCollected.toLocaleString()}
                          </span>
                        </span>
                        <span className="text-gray-500 text-xs tabular-nums">
                          of GHS {(cls.totalDue ?? 0).toLocaleString()}
                        </span>
                      </div>
                      {cls.totalStudents > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                rate >= 80
                                  ? 'bg-success-400'
                                  : rate >= 50
                                    ? 'bg-warning-400'
                                    : 'bg-danger-400'
                              }`}
                              style={{ width: `${Math.min(rate, 100)}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-gray-400 shrink-0 tabular-nums">
                            {rate}%
                          </span>
                        </div>
                      )}
                      {cls.totalStudents > 0 && (
                        <p className="text-[11px] text-gray-400">
                          {cls.fullyPaid} paid · {cls.partial + cls.halfPaid} partial · {cls.unpaid}{' '}
                          unpaid
                        </p>
                      )}
                    </div>
                  )}
                </Link>

                <div className="mt-3 pt-3 border-t border-gray-100">
                  <Link
                    href={`/timetable?classId=${cls.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Timetable
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Plain label for search matching (no JSX). */
function feeStatusLabel(cls: ClassOverview): string {
  if (!cls.feeStructure) return 'no fee set';
  if (cls.totalStudents === 0) return 'no students';
  const rate = cls.collectionRate ?? 0;
  if (rate >= 100) return 'complete';
  if (rate > 0) return 'in progress';
  return 'outstanding';
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
        <div key={s.id} className="flex items-center justify-between bg-white rounded-2xl px-5 py-4 border border-gray-100 shadow-sm">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                  s.category === 'TUITION'
                    ? 'bg-primary-50 text-primary-800 border border-primary-100'
                    : s.category === 'UNIFORM'
                      ? 'bg-violet-50 text-violet-800 border border-violet-100'
                      : 'bg-amber-50 text-amber-900 border border-amber-100'
                }`}
              >
                {FEE_CATEGORY_LABEL[s.category]}
              </span>
              <p className="font-semibold text-gray-900">{s.name}</p>
              {s.isRequired === false && (
                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                  Optional
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              GHS {s.amount.toLocaleString()}
              {s.classLevel ? ` · ${classLevelLabels[s.classLevel] ?? s.classLevel}` : ' · All levels'}
              {s.isRequired === false ? ' · Optional charge' : ' · Required'}
              {s.notes ? ` · ${s.notes}` : ''}
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

function FeeStructureModal({ isOpen, structure, termId, onClose, onSaved }: {
  isOpen: boolean;
  structure: FeeStructure | null;
  termId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [levelOptions, setLevelOptions] = useState<FeeLevelMeta[]>([]);
  const [levelsLoading, setLevelsLoading] = useState(false);
  const [form, setForm] = useState({
    name: structure?.name ?? '',
    amount: structure?.amount?.toString() ?? '',
    category: (structure?.category ?? 'TUITION') as FeeCategory,
    notes: structure?.notes ?? '',
    isRequired: structure?.isRequired !== false,
    schoolWide: !structure?.classLevel && !structure,
    selectedLevels: structure?.classLevel ? [structure.classLevel] : [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setLevelsLoading(true);
    const token = getToken();
    fetch(`${API}/fees/meta`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setLevelOptions(d.levels ?? []))
      .catch(() => setLevelOptions([]))
      .finally(() => setLevelsLoading(false));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    Promise.resolve().then(() => {
      setForm({
        name: structure?.name ?? '',
        amount: structure?.amount?.toString() ?? '',
        category: (structure?.category ?? 'TUITION') as FeeCategory,
        notes: structure?.notes ?? '',
        isRequired: structure?.isRequired !== false,
        schoolWide: !structure?.classLevel && !structure,
        selectedLevels: structure?.classLevel ? [structure.classLevel] : [],
      });
      setError('');
    });
  }, [isOpen, structure]);

  const toggleLevel = (level: string) => {
    setForm((f) => {
      const has = f.selectedLevels.includes(level);
      return {
        ...f,
        schoolWide: false,
        selectedLevels: has
          ? f.selectedLevels.filter((l) => l !== level)
          : [...f.selectedLevels, level],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!structure && !form.schoolWide && form.selectedLevels.length === 0) {
      setError('Select at least one class level, or choose school-wide.');
      return;
    }
    setSaving(true); setError('');
    const token = getToken();
    const method = structure ? 'PUT' : 'POST';
    const url = structure ? `${API}/fees/structures/${structure.id}` : `${API}/fees/structures`;
    const body = structure
      ? {
          name: form.name,
          amount: form.amount,
          classLevel: form.schoolWide ? null : form.selectedLevels[0] ?? null,
          termId,
          category: form.category,
          notes: form.notes.trim() || null,
          isRequired: form.isRequired,
        }
      : {
          name: form.name,
          amount: form.amount,
          classLevels: form.schoolWide ? [] : form.selectedLevels,
          termId,
          category: form.category,
          notes: form.notes.trim() || null,
          isRequired: form.isRequired,
        };
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.message); return; }
    onSaved();
  };

  return (
    <Modal isOpen={isOpen} title={structure ? 'Edit fee item' : 'Add fee item'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert type="error" message={error} />}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
          <select
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            value={form.category}
            onChange={(e) => {
              const category = e.target.value as FeeCategory;
              setForm({
                ...form,
                category,
                isRequired: category === 'TUITION' ? true : form.isRequired,
              });
            }}
          >
            <option value="TUITION">{FEE_CATEGORY_LABEL.TUITION}</option>
            <option value="UNIFORM">{FEE_CATEGORY_LABEL.UNIFORM}</option>
            <option value="OTHER">{FEE_CATEGORY_LABEL.OTHER}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment type *</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, isRequired: true })}
              className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                form.isRequired
                  ? 'bg-primary-50 border-primary-200 text-primary-800'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Required
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, isRequired: false })}
              className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                !form.isRequired
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Optional
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Required fees count toward a student&apos;s balance and payment status. Optional fees (e.g. clubs) can be paid separately.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input type="text"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            placeholder="e.g. Term 1 Tuition, Robotics, Maintenance"
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {structure ? 'Class level' : 'Applies to class levels'}
          </label>
          {levelsLoading ? (
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading classes…
            </p>
          ) : levelOptions.length === 0 ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              No classes found. Add classes first, or use school-wide below.
            </p>
          ) : structure ? (
            <select
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              value={form.schoolWide ? '' : form.selectedLevels[0] ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                setForm({
                  ...form,
                  schoolWide: !v,
                  selectedLevels: v ? [v] : [],
                });
              }}
            >
              <option value="">All classes (school-wide)</option>
              {levelOptions.map((opt) => (
                <option key={opt.level} value={opt.level}>
                  {classLevelLabels[opt.level] ?? opt.level}
                </option>
              ))}
            </select>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-100 rounded-xl p-3">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 rounded border-gray-300"
                  checked={form.schoolWide}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      schoolWide: e.target.checked,
                      selectedLevels: e.target.checked ? [] : form.selectedLevels,
                    })
                  }
                />
                <span className="text-sm font-medium text-gray-800">All classes (school-wide)</span>
              </label>
              {!form.schoolWide &&
                levelOptions.map((opt) => (
                  <label key={opt.level} className="flex items-start gap-2 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      className="mt-1 rounded border-gray-300"
                      checked={form.selectedLevels.includes(opt.level)}
                      onChange={() => toggleLevel(opt.level)}
                    />
                    <span className="text-sm">
                      <span className="font-semibold text-gray-900">
                        {classLevelLabels[opt.level] ?? opt.level}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {opt.classes.map((c) => c.name).join(', ')}
                      </span>
                    </span>
                  </label>
                ))}
            </div>
          )}
          {!structure && !form.schoolWide && form.selectedLevels.length > 1 && (
            <p className="text-xs text-primary-700 mt-1 font-medium">
              Creates one fee item per selected level ({form.selectedLevels.length} total).
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
          <input
            type="text"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            placeholder="e.g. Graduands only…"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin mr-1" />}
            {structure ? 'Save Changes' : form.selectedLevels.length > 1 ? `Create ${form.selectedLevels.length} items` : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
