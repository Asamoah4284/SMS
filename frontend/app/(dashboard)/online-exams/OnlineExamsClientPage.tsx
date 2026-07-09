'use client';

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Modal } from '@/components/ui';
import {
  Plus,
  Loader2,
  FileText,
  Monitor,
  Search,
  ChevronDown,
  Clock,
  HelpCircle,
  Users,
  ArrowRight,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

interface OnlineExam {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  status: string;
  totalMarks: number;
  class: { id: string; name: string };
  subject: { id: string; name: string };
  term: { id: string; name: string; year: number };
  _count: { questions: number; attempts: number };
}

interface Term {
  id: string;
  name: string;
  year: number;
  isCurrent: boolean;
}
interface ClassItem {
  id: string;
  name: string;
}
interface Subject {
  id: string;
  name: string;
}

type StatusFilter = 'all' | 'DRAFT' | 'PUBLISHED' | 'CLOSED';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
}
const API = process.env.NEXT_PUBLIC_API_URL;

const selectClass =
  'appearance-none border border-gray-200 rounded-lg pl-2.5 pr-8 py-1.5 text-xs sm:text-sm bg-white shadow-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-400/40 focus:border-primary-300 transition-shadow';

const fieldInput =
  'w-full px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-400 transition-shadow';

function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
        {required && <span className="text-danger-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-1 leading-snug">{hint}</p>}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof FileText;
  accent: 'primary' | 'success' | 'warning' | 'slate';
}) {
  const accents = {
    primary: 'bg-primary-50 text-primary-700 border-primary-100',
    success: 'bg-success-50 text-success-700 border-success-100',
    warning: 'bg-warning-50 text-warning-800 border-warning-100',
    slate: 'bg-gray-50 text-gray-700 border-gray-100',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-3">
      <div className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center ${accents[accent]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide truncate">{label}</p>
        <p className="text-lg font-bold text-gray-900 tabular-nums leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function statusBadge(status: string) {
  const map: Record<string, { variant: 'success' | 'warning' | 'default' | 'info'; label: string }> = {
    PUBLISHED: { variant: 'success', label: 'Live' },
    DRAFT: { variant: 'warning', label: 'Draft' },
    CLOSED: { variant: 'default', label: 'Closed' },
  };
  const cfg = map[status] ?? { variant: 'default' as const, label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function statusAccent(status: string) {
  if (status === 'PUBLISHED') return 'from-emerald-600 via-primary-800 to-primary-900';
  if (status === 'CLOSED') return 'from-slate-700 via-slate-800 to-slate-900';
  return 'from-amber-600 via-primary-900 to-slate-900';
}

export default function OnlineExamsClientPage() {
  const [exams, setExams] = useState<OnlineExam[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [classFilter, setClassFilter] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    instructions: '',
    durationMinutes: '45',
    startAt: '',
    endAt: '',
    classId: '',
    subjectId: '',
    termId: '',
  });

  const fetchExams = useCallback(async () => {
    const token = getToken();
    const res = await fetch(`${API}/online-exams`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setExams(await res.json());
  }, []);

  useEffect(() => {
    const token = getToken();
    Promise.all([
      fetch(`${API}/terms`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`${API}/classes?limit=100`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`${API}/subjects`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([termsData, classesData, subjectsData]) => {
        const list: Term[] = termsData.terms ?? [];
        setTerms(list);
        setClasses(classesData.classes ?? classesData ?? []);
        setSubjects(subjectsData.subjects ?? subjectsData ?? []);
        const cur = list.find((t) => t.isCurrent);
        setForm((f) => ({ ...f, termId: cur?.id ?? list[0]?.id ?? '' }));
      })
      .catch(() => setError('Failed to load exam setup data'))
      .finally(() => setLoading(false));
    fetchExams();
  }, [fetchExams]);

  const stats = useMemo(() => {
    const published = exams.filter((e) => e.status === 'PUBLISHED').length;
    const draft = exams.filter((e) => e.status === 'DRAFT').length;
    const closed = exams.filter((e) => e.status === 'CLOSED').length;
    const questions = exams.reduce((s, e) => s + e._count.questions, 0);
    const attempts = exams.reduce((s, e) => s + e._count.attempts, 0);
    return { total: exams.length, published, draft, closed, questions, attempts };
  }, [exams]);

  const filteredExams = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exams.filter((exam) => {
      if (statusFilter !== 'all' && exam.status !== statusFilter) return false;
      if (classFilter && exam.class.id !== classFilter) return false;
      if (!q) return true;
      const hay = [
        exam.title,
        exam.description,
        exam.class.name,
        exam.subject.name,
        exam.term.name,
        String(exam.term.year),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [exams, search, statusFilter, classFilter]);

  const resetForm = () => {
    const cur = terms.find((t) => t.isCurrent);
    setForm({
      title: '',
      description: '',
      instructions: '',
      durationMinutes: '45',
      startAt: '',
      endAt: '',
      classId: classFilter || '',
      subjectId: '',
      termId: cur?.id ?? terms[0]?.id ?? '',
    });
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const createExam = async () => {
    if (!form.title.trim() || !form.classId || !form.subjectId || !form.termId) {
      alert('Please fill in title, class, subject, and term.');
      return;
    }
    setCreating(true);
    const token = getToken();
    try {
      const res = await fetch(`${API}/online-exams`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          durationMinutes: parseInt(form.durationMinutes, 10),
          startAt: form.startAt || null,
          endAt: form.endAt || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Failed to create exam');
      }
      setModalOpen(false);
      fetchExams();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create exam');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-4 px-4 py-4 sm:px-6 md:px-8 max-w-[1400px] mx-auto min-h-full">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="hidden sm:flex w-9 h-9 rounded-lg bg-primary-600 text-white items-center justify-center shrink-0">
            <Monitor className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-gray-900">Online Exams</h1>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 sm:line-clamp-1">
              CBT exams with auto-marking and manual theory grading
            </p>
          </div>
        </div>
        <Button variant="primary" size="sm" onClick={openCreateModal}>
          <Plus className="w-3.5 h-3.5 mr-1" /> New Exam
        </Button>
      </div>

      {error && <Alert type="error" message={error} />}

      {/* Stats */}
      {!loading && exams.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total exams" value={String(stats.total)} icon={FileText} accent="primary" />
          <StatCard
            label="Live"
            value={String(stats.published)}
            sub={stats.draft ? `${stats.draft} draft` : undefined}
            icon={CheckCircle2}
            accent="success"
          />
          <StatCard
            label="Questions"
            value={String(stats.questions)}
            sub="Across all exams"
            icon={HelpCircle}
            accent="slate"
          />
          <StatCard
            label="Attempts"
            value={String(stats.attempts)}
            sub={stats.closed ? `${stats.closed} closed` : 'Student submissions'}
            icon={Users}
            accent="warning"
          />
        </div>
      )}

      {/* Toolbar */}
      {!loading && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-0.5 bg-gray-100 p-0.5 rounded-lg w-fit border border-gray-100">
            {(['all', 'DRAFT', 'PUBLISHED', 'CLOSED'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {s === 'all' ? 'All' : s === 'PUBLISHED' ? 'Live' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <select
                className={selectClass}
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
              >
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <div className="relative flex-1 min-w-[180px] sm:max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search exams…"
                className="w-full pl-8 pr-3 py-1.5 text-xs sm:text-sm border border-gray-200 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-400/40"
              />
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-primary-600" />
        </div>
      ) : exams.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
          <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5 text-primary-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">No online exams yet</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm leading-relaxed">
              Create your first CBT exam — add questions, publish when ready, and students can take it from their portal.
            </p>
            <Button variant="primary" size="sm" className="mt-4" onClick={openCreateModal}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Create your first exam
            </Button>
          </div>
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm py-10 text-center">
          <p className="text-sm text-gray-500">No exams match your filters.</p>
          <button
            type="button"
            className="text-xs text-primary-600 hover:underline mt-2"
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
              setClassFilter('');
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredExams.map((exam) => (
            <article
              key={exam.id}
              className="group bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden hover:shadow-md hover:border-gray-200/80 transition-all flex flex-col"
            >
              <div className={`relative h-20 bg-gradient-to-br ${statusAccent(exam.status)} overflow-hidden`}>
                <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_20%_30%,white_0%,transparent_55%)]" />
                <div className="absolute inset-0 flex items-end justify-between p-3">
                  <div className="min-w-0">
                    {statusBadge(exam.status)}
                  </div>
                  <span className="text-[10px] font-medium text-white/80 bg-black/20 px-1.5 py-0.5 rounded tabular-nums">
                    {exam.totalMarks} marks
                  </span>
                </div>
              </div>

              <div className="p-3 flex flex-col flex-1">
                <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 group-hover:text-primary-800 transition-colors">
                  {exam.title}
                </h3>
                {exam.description && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-snug">{exam.description}</p>
                )}

                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-gray-50 text-gray-600 text-[10px] font-medium border border-gray-100">
                    {exam.class.name}
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-primary-50 text-primary-700 text-[10px] font-medium border border-primary-100">
                    {exam.subject.name}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-gray-50 text-center">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Duration</p>
                    <p className="text-xs font-semibold text-gray-800 tabular-nums flex items-center justify-center gap-0.5 mt-0.5">
                      <Clock className="w-3 h-3 text-gray-400" />
                      {exam.durationMinutes}m
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Questions</p>
                    <p className="text-xs font-semibold text-gray-800 tabular-nums mt-0.5">{exam._count.questions}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Attempts</p>
                    <p className="text-xs font-semibold text-gray-800 tabular-nums mt-0.5">{exam._count.attempts}</p>
                  </div>
                </div>

                <p className="text-[10px] text-gray-400 mt-2">
                  {exam.term.name} {exam.term.year}
                </p>

                <Link
                  href={`/online-exams/${exam.id}`}
                  className="mt-2.5 flex items-center justify-center gap-1 w-full py-1.5 rounded-lg text-xs font-medium text-primary-700 bg-primary-50 border border-primary-100 hover:bg-primary-100 transition-colors"
                >
                  Manage exam
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {modalOpen && (
        <Modal
          isOpen
          onClose={() => setModalOpen(false)}
          title="Create online exam"
          size="lg"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={createExam} loading={creating}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Create exam
              </Button>
            </>
          }
        >
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            Set up the exam shell — you can add questions and publish from the exam page after creating it.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <FormField label="Title" required>
                <input
                  className={fieldInput}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Mathematics Mid-Term CBT"
                  required
                />
              </FormField>
            </div>

            <FormField label="Class" required>
              <div className="relative">
                <select
                  className={`${selectClass} w-full`}
                  value={form.classId}
                  onChange={(e) => setForm({ ...form, classId: e.target.value })}
                  required
                >
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </FormField>

            <FormField label="Subject" required>
              <div className="relative">
                <select
                  className={`${selectClass} w-full`}
                  value={form.subjectId}
                  onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                  required
                >
                  <option value="">Select subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </FormField>

            <FormField label="Term" required>
              <div className="relative">
                <select
                  className={`${selectClass} w-full`}
                  value={form.termId}
                  onChange={(e) => setForm({ ...form, termId: e.target.value })}
                  required
                >
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.year}
                      {t.isCurrent ? ' ★' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </FormField>

            <FormField label="Duration" required hint="Time limit in minutes.">
              <input
                type="number"
                min="1"
                className={`${fieldInput} tabular-nums`}
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                required
              />
            </FormField>

            <div className="sm:col-span-2">
              <FormField label="Description">
                <textarea
                  className={`${fieldInput} min-h-[64px] resize-y`}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief summary for staff…"
                  rows={2}
                />
              </FormField>
            </div>

            <div className="sm:col-span-2">
              <FormField label="Instructions" hint="Shown to students before they start.">
                <textarea
                  className={`${fieldInput} min-h-[64px] resize-y`}
                  value={form.instructions}
                  onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                  placeholder="Rules, allowed materials, etc."
                  rows={2}
                />
              </FormField>
            </div>

            <FormField label="Start (optional)" hint="Leave blank to open manually when published.">
              <input
                type="datetime-local"
                className={fieldInput}
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
              />
            </FormField>

            <FormField label="End (optional)">
              <input
                type="datetime-local"
                className={fieldInput}
                value={form.endAt}
                onChange={(e) => setForm({ ...form, endAt: e.target.value })}
              />
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  );
}
