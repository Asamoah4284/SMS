'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  Button, Modal, Alert, Badge,
  SkeletonTable, AdminOnly,
} from '@/components/ui';
import {
  GraduationCap, Phone, Hash,
  CheckCircle2, Clock, Upload, Download,
  AlertTriangle, BookOpen, Trash2,
  Plus, Search, Users, UserCheck, ArrowRight,
} from 'lucide-react';

interface Teacher {
  id: string;
  staffId: string;
  qualification: string | null;
  subjectCount: number;
  classTeacherOf: { id: string; name: string; studentCount: number } | null;
  user: {
    firstName: string;
    lastName: string;
    phone: string;
    isActive: boolean;
  };
}

interface BulkRow {
  firstName: string;
  lastName: string;
  phone: string;
  qualification: string;
}

const AVATAR_COLORS = [
  'bg-blue-50 text-blue-700 border-blue-100',
  'bg-violet-50 text-violet-700 border-violet-100',
  'bg-emerald-50 text-emerald-700 border-emerald-100',
  'bg-amber-50 text-amber-800 border-amber-100',
  'bg-rose-50 text-rose-700 border-rose-100',
  'bg-cyan-50 text-cyan-700 border-cyan-100',
];

function avatarColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatClassName(name: string | null | undefined) {
  if (!name) return null;
  return name
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
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
  icon: typeof Users;
  accent: 'primary' | 'success' | 'warning' | 'slate';
}) {
  const accents = {
    primary: 'bg-primary-50 text-primary-700 border-primary-100',
    success: 'bg-success-50 text-success-700 border-success-100',
    warning: 'bg-warning-50 text-warning-800 border-warning-100',
    slate: 'bg-gray-50 text-gray-700 border-gray-100',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      <div className={`shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center ${accents[accent]}`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-gray-900 tabular-nums leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending'>('all');

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/teachers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load teachers');
      const data = await res.json();
      setTeachers(data.teachers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teachers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

  const stats = useMemo(() => {
    const active = teachers.filter((t) => t.user.isActive).length;
    const classTeachers = teachers.filter((t) => t.classTeacherOf).length;
    const withSubjects = teachers.filter((t) => t.subjectCount > 0).length;
    return { total: teachers.length, active, classTeachers, withSubjects };
  }, [teachers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teachers.filter((t) => {
      if (statusFilter === 'active' && !t.user.isActive) return false;
      if (statusFilter === 'pending' && t.user.isActive) return false;
      if (!q) return true;
      const name = `${t.user.firstName} ${t.user.lastName}`.toLowerCase();
      return (
        name.includes(q) ||
        t.staffId.toLowerCase().includes(q) ||
        t.user.phone.includes(q) ||
        (t.classTeacherOf?.name ?? '').toLowerCase().includes(q)
      );
    });
  }, [teachers, search, statusFilter]);

  return (
    <AdminOnly>
    <div className="px-5 py-6 sm:px-8 max-w-[1600px] mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
              <GraduationCap className="w-6 h-6 text-primary-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-primary-600 uppercase tracking-wide mb-1">Staff directory</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">Teachers</h1>
              <p className="text-sm text-gray-500 mt-1 max-w-lg">
                Manage staff accounts, class assignments, and subject teaching loads.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              variant="secondary"
              icon={<Upload className="w-4 h-4" />}
              onClick={() => setBulkOpen(true)}
            >
              Bulk import
            </Button>
            <Link href="/teachers/new">
              <Button icon={<Plus className="w-4 h-4" />}>Add teacher</Button>
            </Link>
          </div>
        </div>
      </div>

      {!loading && teachers.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total staff" value={String(stats.total)} icon={Users} accent="primary" />
          <StatCard label="Active" value={String(stats.active)} sub={`${stats.total - stats.active} pending`} icon={UserCheck} accent="success" />
          <StatCard label="Class teachers" value={String(stats.classTeachers)} icon={GraduationCap} accent="slate" />
          <StatCard label="Teaching subjects" value={String(stats.withSubjects)} sub="with assignments" icon={BookOpen} accent="warning" />
        </div>
      )}

      {error && <Alert type="error" message={error} className="mb-2" onDismiss={() => setError('')} />}

      {!loading && teachers.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              placeholder="Search by name, staff ID, phone, or class…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-400"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'active', 'pending'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={[
                  'px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors capitalize',
                  statusFilter === key
                    ? 'bg-primary-50 text-primary-800 border-primary-200'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
                ].join(' ')}
              >
                {key === 'all' ? 'All' : key}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={6} />
      ) : teachers.length === 0 ? (
        <EmptyState onBulk={() => setBulkOpen(true)} />
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
          <p className="text-sm font-medium text-gray-700">No teachers match your search.</p>
          <button type="button" onClick={() => { setSearch(''); setStatusFilter('all'); }} className="text-sm text-primary-600 font-semibold mt-2 hover:underline">
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {filtered.map((t) => (
              <TeacherCard key={t.id} teacher={t} onDeleted={fetchTeachers} />
            ))}
          </div>

          <div className="hidden md:block">
            <TeachersTable teachers={filtered} fetchTeachers={fetchTeachers} />
          </div>
        </>
      )}

      <p className="text-xs text-gray-400 text-center pb-2">
        {!loading && teachers.length > 0 && `Showing ${filtered.length} of ${teachers.length} staff`}
      </p>

      <Modal isOpen={bulkOpen} onClose={() => setBulkOpen(false)} title="Bulk Import Teachers" size="lg">
        <BulkImportForm onDone={() => { setBulkOpen(false); fetchTeachers(); }} onCancel={() => setBulkOpen(false)} />
      </Modal>
    </div>
    </AdminOnly>
  );
}

// ─── Teachers Table ───────────────────────────────────────────────────────────

function TeachersTable({ teachers, fetchTeachers }: { teachers: Teacher[]; fetchTeachers: () => void }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto_auto] gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50/80 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
        <span>Teacher</span>
        <span>Staff ID</span>
        <span>Phone</span>
        <span>Class</span>
        <span>Subjects</span>
        <span className="text-right">Status</span>
        <span className="w-10" aria-hidden />
      </div>
      <div className="divide-y divide-gray-50">
        {teachers.map((teacher) => (
          <TeacherRow key={teacher.id} teacher={teacher} onDeleted={fetchTeachers} />
        ))}
      </div>
    </div>
  );
}

function TeacherRow({ teacher, onDeleted }: { teacher: Teacher; onDeleted: () => void }) {
  const fullName = `${teacher.user.firstName} ${teacher.user.lastName}`.trim();
  const initials = `${teacher.user.firstName[0] ?? ''}${teacher.user.lastName[0] ?? ''}`.toUpperCase();
  const className = formatClassName(teacher.classTeacherOf?.name);

  return (
    <div className="group grid grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto_auto] gap-4 items-center px-5 py-4 hover:bg-primary-50/30 transition-colors">
      <Link href={`/teachers/${teacher.id}`} className="flex items-center gap-3 min-w-0">
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-bold text-sm shrink-0 ${avatarColor(fullName)}`}>
          {initials}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate group-hover:text-primary-800 transition-colors">{fullName || '—'}</p>
          {teacher.qualification ? (
            <p className="text-xs text-gray-500 truncate mt-0.5">{teacher.qualification}</p>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">No qualification listed</p>
          )}
        </div>
      </Link>

      <Link href={`/teachers/${teacher.id}`} className="flex items-center gap-1.5 min-w-0">
        <span className="inline-flex items-center gap-1 rounded-lg bg-gray-50 border border-gray-100 px-2 py-1 text-xs font-mono font-semibold text-gray-700 truncate">
          <Hash className="w-3 h-3 text-gray-400 shrink-0" />
          {teacher.staffId}
        </span>
      </Link>

      <Link href={`/teachers/${teacher.id}`} className="flex items-center gap-1.5 text-sm text-gray-600 min-w-0">
        <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <span className="truncate tabular-nums">{teacher.user.phone}</span>
      </Link>

      <Link href={`/teachers/${teacher.id}`} className="min-w-0">
        {className ? (
          <span className="inline-flex items-center rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-100 px-2.5 py-1 text-xs font-semibold truncate max-w-full">
            {className}
          </span>
        ) : (
          <span className="text-xs text-gray-400">Not assigned</span>
        )}
      </Link>

      <Link href={`/teachers/${teacher.id}`} className="min-w-0">
        {teacher.subjectCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-100 px-2.5 py-1 text-xs font-semibold">
            <BookOpen className="w-3 h-3" />
            {teacher.subjectCount}
          </span>
        ) : (
          <span className="text-xs text-gray-400">None</span>
        )}
      </Link>

      <div className="flex justify-end">
        {teacher.user.isActive ? (
          <Badge variant="success">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Active
          </Badge>
        ) : (
          <Badge variant="warning">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Link
          href={`/teachers/${teacher.id}`}
          className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-all"
          title="View profile"
        >
          <ArrowRight className="w-4 h-4" />
        </Link>
        <TeacherDeleteButton teacher={teacher} onDeleted={onDeleted} />
      </div>
    </div>
  );
}

function TeacherDeleteButton({
  teacher,
  onDeleted,
}: {
  teacher: Teacher;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const remove = async () => {
    setLoading(true);
    setErr('');
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/teachers/${teacher.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      setOpen(false);
      onDeleted();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        title="Remove teacher"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className="text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors p-2"
      >
        <Trash2 className="w-4 h-4" />
      </button>
      <Modal isOpen={open} onClose={() => !loading && setOpen(false)} title="Remove teacher?" size="sm">
        <p className="text-sm text-gray-600 mb-2">
          This will permanently remove <strong>{teacher.user.firstName} {teacher.user.lastName}</strong> ({teacher.staffId}) and their login.
          Class teacher and subject assignments are cleared.
        </p>
        {err && <Alert type="error" message={err} className="mb-3" onDismiss={() => setErr('')} />}
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
          <Button type="button" variant="secondary" className="!bg-danger-600 !text-white hover:!bg-danger-700 border-0" onClick={remove} loading={loading}>
            Delete
          </Button>
        </div>
      </Modal>
    </>
  );
}

function TeacherCard({ teacher, onDeleted }: { teacher: Teacher; onDeleted: () => void }) {
  const fullName = `${teacher.user.firstName} ${teacher.user.lastName}`.trim();
  const initials = `${teacher.user.firstName[0] ?? ''}${teacher.user.lastName[0] ?? ''}`.toUpperCase();
  const className = formatClassName(teacher.classTeacherOf?.name);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-primary-500 to-indigo-500" />
      <Link href={`/teachers/${teacher.id}`} className="block p-4">
        <div className="flex items-start gap-3">
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center text-base font-bold shrink-0 ${avatarColor(fullName)}`}>
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{fullName || '—'}</p>
                <p className="text-[11px] font-mono text-gray-500 mt-0.5">{teacher.staffId}</p>
              </div>
              {teacher.user.isActive ? (
                <Badge variant="success">Active</Badge>
              ) : (
                <Badge variant="warning">Pending</Badge>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1">
                <Phone className="w-3 h-3" />
                {teacher.user.phone}
              </span>
              {className && (
                <span className="inline-flex text-[11px] font-semibold text-indigo-800 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1">
                  {className}
                </span>
              )}
              {teacher.subjectCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">
                  <BookOpen className="w-3 h-3" />
                  {teacher.subjectCount} subject{teacher.subjectCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
      <div className="flex items-center justify-between gap-2 border-t border-gray-50 px-4 py-3 bg-gray-50/50">
        <TeacherDeleteButton teacher={teacher} onDeleted={onDeleted} />
        <Link
          href={`/teachers/${teacher.id}`}
          className="inline-flex items-center gap-1 rounded-lg bg-primary-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-primary-700 transition-colors"
        >
          View profile
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

// ─── Bulk Import Form ─────────────────────────────────────────────────────────

function BulkImportForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; failed: Array<{ row: number; name?: string; error: string }> } | null>(null);

  const downloadTemplate = () => {
    const csv = 'firstName,lastName,phone,qualification\nKwame,Asante,0241234567,BSc Education\nAma,Boateng,0551234567,BA English';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'teacher-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): BulkRow[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) throw new Error('CSV must have a header and at least one data row');
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\r/g, ''));
    const required = ['firstname', 'lastname', 'phone'];
    const missing = required.filter((r) => !header.includes(r));
    if (missing.length > 0) throw new Error(`Missing columns: ${missing.join(', ')}`);

    return lines.slice(1).filter((l) => l.trim()).map((line) => {
      const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, '').replace(/\r/g, ''));
      const row: Record<string, string> = {};
      header.forEach((h, i) => { row[h] = vals[i] ?? ''; });
      return {
        firstName: row['firstname'] ?? '',
        lastName: row['lastname'] ?? '',
        phone: row['phone'] ?? '',
        qualification: row['qualification'] ?? '',
      };
    });
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');
    setRows([]);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseCSV(ev.target?.result as string);
        if (parsed.length > 100) { setParseError('Max 100 teachers per import'); return; }
        setRows(parsed);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Failed to parse file');
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/teachers/bulk-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ teachers: rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setResult(data);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center text-center gap-2 py-2">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center ${result.imported > 0 ? 'bg-success-100' : 'bg-warning-100'}`}>
            {result.imported > 0 ? <CheckCircle2 className="w-7 h-7 text-success-600" /> : <AlertTriangle className="w-7 h-7 text-warning-600" />}
          </div>
          <p className="text-xl font-bold text-gray-900">{result.imported} teacher{result.imported !== 1 ? 's' : ''} imported</p>
          {result.failed.length > 0 && <p className="text-sm text-gray-500">{result.failed.length} row{result.failed.length !== 1 ? 's' : ''} had errors</p>}
        </div>
        {result.failed.length > 0 && (
          <div className="bg-danger-50 border border-danger-200 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1.5">
            {result.failed.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="font-mono text-danger-600 font-bold flex-shrink-0">Row {f.row}:</span>
                <span className="text-danger-700">{f.name ? `${f.name} — ` : ''}{f.error}</span>
              </div>
            ))}
          </div>
        )}
        <Button onClick={onDone} className="w-full">Done</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
        <div>
          <p className="font-semibold text-gray-900 text-sm">Step 1: Download Template</p>
          <p className="text-xs text-gray-500 mt-0.5">Fill in the CSV with teacher details then upload</p>
        </div>
        <Button variant="secondary" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={downloadTemplate}>
          Template
        </Button>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Step 2: Upload Filled CSV</p>
        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-6 cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-colors">
          <Upload className="w-7 h-7 text-gray-300" />
          <span className="text-sm font-medium text-gray-600">Click to upload CSV</span>
          <span className="text-xs text-gray-400">firstName, lastName, phone, qualification (optional) · Max 100 rows</span>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </label>
      </div>

      {parseError && <Alert type="error" message={parseError} onDismiss={() => setParseError('')} />}

      {rows.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">
            Step 3: Confirm Preview — {rows.length} teacher{rows.length !== 1 ? 's' : ''}
          </p>
          <div className="border border-gray-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
            <div className="grid grid-cols-4 gap-2 px-3 py-2 bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider sticky top-0">
              <span>First Name</span><span>Last Name</span><span>Phone</span><span>Qualification</span>
            </div>
            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 px-3 py-2 border-t border-gray-100 text-sm hover:bg-gray-50">
                <span className={!row.firstName ? 'text-danger-600 italic' : 'text-gray-900'}>{row.firstName || 'Missing'}</span>
                <span className={!row.lastName ? 'text-danger-600 italic' : 'text-gray-900'}>{row.lastName || 'Missing'}</span>
                <span className={!row.phone ? 'text-danger-600 italic' : 'text-gray-500 font-mono text-xs'}>{row.phone || 'Missing'}</span>
                <span className="text-gray-400 text-xs">{row.qualification || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button onClick={handleImport} loading={loading} disabled={rows.length === 0} className="flex-1">
          Import {rows.length > 0 ? `${rows.length} Teacher${rows.length !== 1 ? 's' : ''}` : 'Teachers'}
        </Button>
      </div>
    </div>
  );
}

function EmptyState({ onBulk }: { onBulk: () => void }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-50 to-indigo-50 border border-primary-100 flex items-center justify-center mb-4">
        <GraduationCap className="w-8 h-8 text-primary-600" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">No teachers yet</h3>
      <p className="text-gray-500 max-w-sm mb-6 text-sm">
        Add staff individually or import your teacher list from a CSV file.
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        <Button variant="secondary" icon={<Upload className="w-4 h-4" />} onClick={onBulk}>
          Bulk import
        </Button>
        <Link href="/teachers/new">
          <Button icon={<Plus className="w-4 h-4" />}>Add teacher</Button>
        </Link>
      </div>
    </div>
  );
}
