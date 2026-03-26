'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Button, Modal, Alert,
  Badge, SkeletonTable, PageHeader,
} from '@/components/ui';
import {
  UserPlus, GraduationCap, Search, ChevronRight,
  Users, Upload, Download,
  CheckCircle2, AlertTriangle,
} from 'lucide-react';

interface Student {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  gender: 'MALE' | 'FEMALE';
  isActive: boolean;
  class: { id: string; name: string; level: string } | null;
  parentName: string | null;
  parentPhone: string | null;
}

interface ClassOption {
  id: string;
  name: string;
  level: string;
}

export default function StudentsClientPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken');
      const params = new URLSearchParams({ limit: '50' });
      if (search) params.set('search', search);
      if (classFilter) params.set('classId', classFilter);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/students?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load students');
      const data = await res.json();
      setStudents(data.data);
      setTotal(data.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [search, classFilter]);

  const fetchClasses = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/classes?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setClasses(data.classes ?? data.data ?? []);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  useEffect(() => {
    const t = setTimeout(() => fetchStudents(), 300);
    return () => clearTimeout(t);
  }, [fetchStudents]);

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto animate-fade-in">
      <PageHeader
        title="Students"
        subtitle={loading ? '' : `${total} student${total !== 1 ? 's' : ''}`}
        actions={
          <div className="flex w-full sm:w-auto gap-2">
            <Button variant="secondary" onClick={() => setBulkOpen(true)} icon={<Upload className="w-4 h-4" />}>
              Bulk Import
            </Button>
          </div>
        }
      />

      {error && <Alert type="error" message={error} className="mb-6" onDismiss={() => setError('')} />}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or student ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.25 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
          />
        </div>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="px-4 py-2.25 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
        >
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <SkeletonTable rows={8} />
      ) : students.length === 0 ? (
        <EmptyState onAdd={() => router.push('/students/new')} />
      ) : (
        <>
          <div className="md:hidden space-y-2">
            {students.map((s) => (
              <StudentMobileCard key={s.id} student={s} />
            ))}
          </div>

          <div className="hidden md:block bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[2fr_1fr_1fr_2fr_auto] gap-4 px-5 py-2.5 bg-white border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              <span>Student</span>
              <span>Class</span>
              <span>Gender</span>
              <span>Guardian</span>
              <span />
            </div>
            <div className="divide-y divide-gray-100">
              {students.map((s) => (
                <StudentRow key={s.id} student={s} />
              ))}
            </div>
          </div>
        </>
      )}

      <BulkImportModal
        isOpen={bulkOpen}
        classes={classes}
        onClose={() => setBulkOpen(false)}
        onSuccess={() => { setBulkOpen(false); fetchStudents(); }}
      />
    </div>
  );
}

function StudentMobileCard({ student }: { student: Student }) {
  const fullName = `${student.firstName} ${student.lastName}`.trim();
  const initials = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`.toUpperCase();

  return (
    <Link
      href={`/students/${student.id}`}
      className="block bg-white border border-gray-200 rounded-2xl p-3.5 shadow-sm active:bg-gray-50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-700 border border-gray-200 flex items-center justify-center font-bold text-sm shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{fullName}</p>
            <p className="text-xs text-gray-400">{student.studentId}</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-1" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
          {student.class ? student.class.name : 'Unassigned'}
        </span>
        <Badge variant={student.gender === 'MALE' ? 'info' : 'warning'}>
          {student.gender === 'MALE' ? 'Male' : 'Female'}
        </Badge>
      </div>

      {(student.parentName || student.parentPhone) && (
        <div className="mt-3 text-xs text-gray-500 border-t border-gray-100 pt-2.5">
          <p className="truncate">
            {student.parentName ?? 'Guardian'}
            {student.parentPhone ? ` • ${student.parentPhone}` : ''}
          </p>
        </div>
      )}
    </Link>
  );
}

function StudentRow({ student }: { student: Student }) {
  const fullName = `${student.firstName} ${student.lastName}`.trim();
  const initials = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`.toUpperCase();

  return (
    <Link
      href={`/students/${student.id}`}
      className="grid grid-cols-[2fr_1fr_1fr_2fr_auto] gap-4 items-center px-5 py-3 hover:bg-gray-50/60 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-700 border border-gray-200 flex items-center justify-center font-bold text-sm flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">
            {fullName}
          </p>
          <p className="text-xs text-gray-400">{student.studentId}</p>
        </div>
      </div>

      <div className="text-sm text-gray-700">
        {student.class ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
            {student.class.name}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">Unassigned</span>
        )}
      </div>

      <div className="hidden sm:block">
        <Badge variant={student.gender === 'MALE' ? 'info' : 'warning'}>
          {student.gender === 'MALE' ? 'M' : 'F'}
        </Badge>
      </div>

      <div className="hidden lg:flex items-center gap-2 min-w-0">
        {student.parentName ? (
          <>
            <Users className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-gray-700 truncate">{student.parentName}</p>
              {student.parentPhone && (
                <p className="text-xs text-gray-400">{student.parentPhone}</p>
              )}
            </div>
          </>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        )}
      </div>

      <ChevronRight className="w-4 h-4 text-gray-300" />
    </Link>
  );
}

// ─── Bulk Import Modal ────────────────────────────────────────────────────────

interface BulkRow {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  classId: string;
  guardianName: string;
  guardianPhone: string;
}

const CSV_TEMPLATE = `firstName,middleName,lastName,dateOfBirth,gender,address,className,guardianName,guardianPhone
Kofi,,Mensah,2015-06-15,MALE,Accra,Basic 4A,Ama Mensah,0241234567
Abena,Akua,Boateng,2014-08-22,FEMALE,Tema,,Joseph Boateng,0251234567`;

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'students-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text: string): BulkRow[] {
  const lines = text.trim().split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  // skip header row
  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    return {
      firstName: cols[0] ?? '',
      middleName: cols[1] ?? '',
      lastName: cols[2] ?? '',
      dateOfBirth: cols[3] ?? '',
      gender: (cols[4] ?? '').toUpperCase(),
      address: cols[5] ?? '',
      classId: '',          // resolved by backend from className if provided
      guardianName: cols[7] ?? '',
      guardianPhone: cols[8] ?? '',
    };
  });
}

function BulkImportModal({
  isOpen,
  classes,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  classes: ClassOption[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [defaultClassId, setDefaultClassId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [importResult, setImportResult] = useState<{ imported: number; failed: Array<{ row: number; reason: string }> } | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
      if (parsed.length > 0) setStep('preview');
      else setApiError('No valid rows found in the CSV file.');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setSubmitting(true);
    setApiError('');
    try {
      const token = localStorage.getItem('accessToken');
      // Apply default class to rows that have no classId
      const payload = rows.map((r) => ({
        ...r,
        classId: r.classId || defaultClassId || undefined,
      }));
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/students/bulk-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ students: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Import failed');
      setImportResult(data);
      setStep('done');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep('upload');
    setRows([]);
    setDefaultClassId('');
    setApiError('');
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = '';
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Bulk Import Students"
      size="lg"
      footer={
        step === 'upload' ? (
          <Button variant="secondary" onClick={handleClose} className="flex-1">Cancel</Button>
        ) : step === 'preview' ? (
          <>
            <Button variant="secondary" onClick={() => setStep('upload')} disabled={submitting} className="flex-1">Back</Button>
            <Button onClick={handleImport} loading={submitting} className="flex-1">
              Import {rows.length} Students
            </Button>
          </>
        ) : (
          <Button onClick={() => { onSuccess(); }} className="flex-1">Done</Button>
        )
      }
    >
      {apiError && <Alert type="error" message={apiError} onDismiss={() => setApiError('')} className="mb-4" />}

      {step === 'upload' && (
        <div className="space-y-5">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 space-y-1">
            <p className="font-semibold">How bulk import works:</p>
            <ul className="list-disc list-inside space-y-0.5 text-blue-700">
              <li>Download the CSV template below</li>
              <li>Fill in student details (one per row)</li>
              <li>Upload the filled CSV file</li>
              <li>Preview and confirm the import</li>
            </ul>
          </div>

          <button
            onClick={downloadTemplate}
            className="w-full flex items-center gap-3 px-4 py-3 border border-dashed border-gray-300 rounded-xl hover:border-primary-400 hover:bg-primary-50 transition-colors text-sm font-medium text-gray-700 hover:text-primary-700"
          >
            <Download className="w-5 h-5 text-gray-400" />
            Download CSV Template
          </button>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Default Class (optional)</label>
            <select
              value={defaultClassId}
              onChange={(e) => setDefaultClassId(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            >
              <option value="">No default class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">Applied to students whose class column is blank</p>
          </div>

          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700">Click to upload CSV file</p>
            <p className="text-xs text-gray-400 mt-1">Max 500 rows</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            <span className="font-bold text-gray-900">{rows.length} students</span> ready to import. Review below before confirming.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  {['#', 'First', 'Middle', 'Last', 'DOB', 'Gender', 'Guardian', 'Phone'].map((h) => (
                    <th key={h} className="text-left px-3 py-2 text-gray-500 font-bold uppercase tracking-wider border-b border-gray-200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.slice(0, 20).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{row.firstName || <span className="text-danger-500">!</span>}</td>
                    <td className="px-3 py-2 text-gray-500">{row.middleName || '—'}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{row.lastName || <span className="text-danger-500">!</span>}</td>
                    <td className="px-3 py-2 text-gray-500">{row.dateOfBirth || '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${row.gender === 'MALE' ? 'bg-blue-50 text-blue-700' : row.gender === 'FEMALE' ? 'bg-pink-50 text-pink-700' : 'bg-danger-50 text-danger-700'}`}>
                        {row.gender || '?'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500">{row.guardianName || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{row.guardianPhone || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 20 && (
              <p className="text-xs text-gray-400 text-center py-2">...and {rows.length - 20} more rows</p>
            )}
          </div>
        </div>
      )}

      {step === 'done' && importResult && (
        <div className="py-4 space-y-5">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-success-50 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-success-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{importResult.imported} students imported</p>
              {importResult.failed.length > 0 && (
                <p className="text-sm text-warning-600 mt-1">{importResult.failed.length} rows skipped</p>
              )}
            </div>
          </div>
          {importResult.failed.length > 0 && (
            <div className="bg-warning-50 border border-warning-200 rounded-xl p-4">
              <p className="text-sm font-bold text-warning-800 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Skipped rows
              </p>
              <ul className="space-y-1">
                {importResult.failed.map((f) => (
                  <li key={f.row} className="text-xs text-warning-700">Row {f.row}: {f.reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-[var(--shadow-card)] flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mb-4">
        <GraduationCap className="w-8 h-8 text-primary-500" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">No students yet</h3>
      <p className="text-gray-500 max-w-sm mb-6">
        Add your first student to get started. You can also bulk import students via CSV.
      </p>
      <Button onClick={onAdd} icon={<UserPlus className="w-4 h-4" />}>
        Add Student
      </Button>
    </div>
  );
}
