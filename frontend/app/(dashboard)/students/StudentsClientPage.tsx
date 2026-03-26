'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Button, Modal, Input, Alert,
  Badge, SkeletonTable, PageHeader,
} from '@/components/ui';
import {
  UserPlus, GraduationCap, Search, ChevronRight,
  Users, Phone, Calendar, Upload, Download,
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

interface AddForm {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  classId: string;
  guardianName: string;
  guardianPhone: string;
  guardianAddress: string;
}

const EMPTY_FORM: AddForm = {
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  address: '',
  classId: '',
  guardianName: '',
  guardianPhone: '',
  guardianAddress: '',
};

export default function StudentsClientPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [addOpen, setAddOpen] = useState(false);
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
    <div className="p-8 max-w-[1600px] mx-auto animate-fade-in">
      <PageHeader
        title="Students"
        subtitle={loading ? '' : `${total} student${total !== 1 ? 's' : ''}`}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setBulkOpen(true)} icon={<Upload className="w-4 h-4" />}>
              Bulk Import
            </Button>
            <Button onClick={() => setAddOpen(true)} icon={<UserPlus className="w-4 h-4" />}>
              Add Student
            </Button>
          </div>
        }
      />

      {error && <Alert type="error" message={error} className="mb-6" onDismiss={() => setError('')} />}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or student ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
          />
        </div>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
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
        <EmptyState onAdd={() => setAddOpen(true)} />
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
          <div className="grid grid-cols-[2fr_1fr_1fr_2fr_auto] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
            <span>Student</span>
            <span>Class</span>
            <span className="hidden sm:block">Gender</span>
            <span className="hidden lg:block">Guardian</span>
            <span />
          </div>
          <div className="divide-y divide-gray-100">
            {students.map((s) => (
              <StudentRow key={s.id} student={s} />
            ))}
          </div>
        </div>
      )}

      <AddStudentModal
        isOpen={addOpen}
        classes={classes}
        onClose={() => setAddOpen(false)}
        onSuccess={() => { setAddOpen(false); fetchStudents(); }}
      />

      <BulkImportModal
        isOpen={bulkOpen}
        classes={classes}
        onClose={() => setBulkOpen(false)}
        onSuccess={() => { setBulkOpen(false); fetchStudents(); }}
      />
    </div>
  );
}

function StudentRow({ student }: { student: Student }) {
  const fullName = `${student.firstName} ${student.lastName}`.trim();
  const initials = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`.toUpperCase();

  return (
    <Link
      href={`/students/${student.id}`}
      className="grid grid-cols-[2fr_1fr_1fr_2fr_auto] gap-4 items-center px-6 py-4 hover:bg-gray-50 transition-colors group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate group-hover:text-primary-700 transition-colors">
            {fullName}
          </p>
          <p className="text-xs text-gray-400">{student.studentId}</p>
        </div>
      </div>

      <div className="text-sm text-gray-700">
        {student.class ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 text-xs font-semibold rounded-full">
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

      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
    </Link>
  );
}

function AddStudentModal({
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
  const [form, setForm] = useState<AddForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<AddForm>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');

  const set = (field: keyof AddForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((e2) => ({ ...e2, [field]: undefined }));
  };

  const validate = () => {
    const errs: Partial<AddForm> = {};
    if (!form.firstName.trim()) errs.firstName = 'First name is required';
    if (!form.lastName.trim()) errs.lastName = 'Last name is required';
    if (!form.gender) errs.gender = 'Gender is required';
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    setApiError('');
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          middleName: form.middleName.trim() || undefined,
          lastName: form.lastName.trim(),
          dateOfBirth: form.dateOfBirth || undefined,
          gender: form.gender,
          address: form.address.trim() || undefined,
          classId: form.classId || undefined,
          guardianName: form.guardianName.trim() || undefined,
          guardianPhone: form.guardianPhone.trim() || undefined,
          guardianAddress: form.guardianAddress.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add student');
      setForm(EMPTY_FORM);
      onSuccess();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to add student');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setApiError('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Student"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting} className="flex-1">
            Add Student
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {apiError && <Alert type="error" message={apiError} onDismiss={() => setApiError('')} />}

        {/* Student info */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <GraduationCap className="w-3.5 h-3.5" /> Student Information
          </p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Input
              label="First Name *"
              placeholder="e.g. Kofi"
              value={form.firstName}
              onChange={set('firstName')}
              error={errors.firstName}
            />
            <Input
              label="Middle Name"
              placeholder="Optional"
              value={form.middleName}
              onChange={set('middleName')}
            />
            <Input
              label="Last Name *"
              placeholder="e.g. Mensah"
              value={form.lastName}
              onChange={set('lastName')}
              error={errors.lastName}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Gender *</label>
              <select
                value={form.gender}
                onChange={set('gender')}
                className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all ${errors.gender ? 'border-danger-500' : 'border-gray-200'}`}
              >
                <option value="">Select gender</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
              {errors.gender && <p className="mt-1 text-xs font-medium text-danger-600">{errors.gender}</p>}
            </div>
            <Input
              label="Date of Birth"
              type="date"
              value={form.dateOfBirth}
              onChange={set('dateOfBirth')}
              icon={<Calendar className="w-4 h-4" />}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Class</label>
              <select
                value={form.classId}
                onChange={set('classId')}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
              >
                <option value="">No class assigned</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <Input
              label="Address"
              placeholder="Home address"
              value={form.address}
              onChange={set('address')}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100" />

        {/* Guardian info */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Users className="w-3.5 h-3.5" /> Guardian / Parent
          </p>
          <p className="text-xs text-gray-500 mb-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            If the guardian's phone matches an existing parent account, the student will be linked automatically.
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Input
              label="Guardian Name"
              placeholder="e.g. Ama Mensah"
              value={form.guardianName}
              onChange={set('guardianName')}
            />
            <Input
              label="Guardian Phone"
              placeholder="e.g. 0241234567"
              type="tel"
              value={form.guardianPhone}
              onChange={set('guardianPhone')}
              icon={<Phone className="w-4 h-4" />}
            />
          </div>
          <Input
            label="Guardian Address"
            placeholder="If different from student's address"
            value={form.guardianAddress}
            onChange={set('guardianAddress')}
          />
        </div>
      </div>
    </Modal>
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
