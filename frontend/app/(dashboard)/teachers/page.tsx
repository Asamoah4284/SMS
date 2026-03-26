'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Button, Modal, Input, Alert,
  SkeletonTable, PageHeader,
} from '@/components/ui';
import {
  UserPlus, GraduationCap, Phone, Hash,
  CheckCircle2, Clock, Upload, Download,
  AlertTriangle, BookOpen,
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

interface InviteResult {
  staffId: string;
  maskedPhone: string;
  name: string;
}

interface BulkRow {
  firstName: string;
  lastName: string;
  phone: string;
  qualification: string;
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

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

  const handleInviteSuccess = (result: InviteResult) => {
    setInviteResult(result);
    fetchTeachers();
  };

  const closeInvite = () => { setInviteOpen(false); setInviteResult(null); };

  return (
    <div className="p-6 max-w-[1600px] mx-auto animate-fade-in">
      <PageHeader
        title="Teachers"
        subtitle={loading ? '' : `${teachers.length} staff member${teachers.length !== 1 ? 's' : ''}`}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Upload className="w-4 h-4" />} onClick={() => setBulkOpen(true)}>
              Bulk Import
            </Button>
            <Button icon={<UserPlus className="w-4 h-4" />} onClick={() => setInviteOpen(true)}>
              Invite Teacher
            </Button>
          </div>
        }
      />

      {error && <Alert type="error" message={error} className="mb-6" onDismiss={() => setError('')} />}

      {loading ? (
        <SkeletonTable rows={6} />
      ) : teachers.length === 0 ? (
        <EmptyState onInvite={() => setInviteOpen(true)} />
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {teachers.map((t) => (
              <TeacherCard key={t.id} teacher={t} />
            ))}
          </div>

          <div className="hidden md:block">
            <TeachersTable teachers={teachers} />
          </div>
        </>
      )}

      <Modal isOpen={inviteOpen} onClose={closeInvite} title={inviteResult ? 'Invitation Sent!' : 'Invite Teacher'} size="sm">
        {inviteResult ? (
          <InviteSuccessView result={inviteResult} onDone={closeInvite} onInviteAnother={() => setInviteResult(null)} />
        ) : (
          <InviteForm onSuccess={handleInviteSuccess} onCancel={closeInvite} />
        )}
      </Modal>

      <Modal isOpen={bulkOpen} onClose={() => setBulkOpen(false)} title="Bulk Import Teachers" size="lg">
        <BulkImportForm onDone={() => { setBulkOpen(false); fetchTeachers(); }} onCancel={() => setBulkOpen(false)} />
      </Modal>
    </div>
  );
}

// ─── Teachers Table ───────────────────────────────────────────────────────────

function TeachersTable({ teachers }: { teachers: Teacher[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-2.5 bg-white border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
        <span>Teacher</span>
        <span>Staff ID</span>
        <span className="hidden md:block">Phone</span>
        <span className="hidden lg:block">Class</span>
        <span className="hidden lg:block">Subjects</span>
        <span className="text-right">Status</span>
      </div>
      <div className="divide-y divide-gray-100">
        {teachers.map((teacher) => (
          <TeacherRow key={teacher.id} teacher={teacher} />
        ))}
      </div>
    </div>
  );
}

function TeacherRow({ teacher }: { teacher: Teacher }) {
  const fullName = `${teacher.user.firstName} ${teacher.user.lastName}`.trim();
  const initials = `${teacher.user.firstName[0] ?? ''}${teacher.user.lastName[0] ?? ''}`.toUpperCase();

  return (
    <Link
      href={`/teachers/${teacher.id}`}
      className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 items-center px-5 py-3 hover:bg-gray-50/60 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{fullName || '—'}</p>
          {teacher.qualification && (
            <p className="text-xs text-gray-500 truncate">{teacher.qualification}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-sm font-mono font-semibold text-gray-700">
        <Hash className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        {teacher.staffId}
      </div>

      <div className="hidden md:flex items-center gap-1.5 text-sm text-gray-600">
        <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        {teacher.user.phone}
      </div>

      <div className="hidden lg:block text-sm text-gray-600 truncate">
        {teacher.classTeacherOf ? (
          <span className="font-medium text-gray-700">{teacher.classTeacherOf.name}</span>
        ) : (
          <span className="text-gray-400 italic text-xs">Not assigned</span>
        )}
      </div>

      <div className="hidden lg:flex items-center gap-1.5 text-sm text-gray-600">
        {teacher.subjectCount > 0 ? (
          <><BookOpen className="w-3.5 h-3.5 text-gray-400" />{teacher.subjectCount} subject{teacher.subjectCount !== 1 ? 's' : ''}</>
        ) : (
          <span className="text-gray-400 italic text-xs">None</span>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        {teacher.user.isActive ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 px-2 py-1 text-[11px] font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" /> Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 px-2 py-1 text-[11px] font-semibold">
            <Clock className="w-3.5 h-3.5" /> Pending
          </span>
        )}
      </div>
    </Link>
  );
}

function TeacherCard({ teacher }: { teacher: Teacher }) {
  const fullName = `${teacher.user.firstName} ${teacher.user.lastName}`.trim();
  const initials = `${teacher.user.firstName[0] ?? ''}${teacher.user.lastName[0] ?? ''}`.toUpperCase();

  return (
    <Link
      href={`/teachers/${teacher.id}`}
      className="block bg-white border border-gray-200 rounded-2xl p-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-base font-bold text-gray-700 shrink-0">
          {initials}
        </div>

        <div className="min-w-0 flex-1 flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{fullName || '—'}</p>
              <div className="mt-1 space-y-0.5">
                <p className="text-[11px] font-semibold text-gray-500 truncate">
                  <span className="text-gray-400 uppercase tracking-wider">ID:</span>{' '}
                  <span className="font-mono text-gray-600">{teacher.staffId}</span>
                </p>
                <p className="text-[11px] font-semibold text-gray-500 truncate">
                  <span className="text-gray-400 uppercase tracking-wider">Phone:</span>{' '}
                  <span className="text-gray-600">{teacher.user.phone}</span>
                </p>
              </div>
            </div>

            <div className="pt-0.5">
              {teacher.user.isActive ? (
                <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2 py-1 text-[11px] font-semibold shrink-0">
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 px-2 py-1 text-[11px] font-semibold shrink-0">
                  Pending
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[11px]">
            <div className="min-w-0">
              <p className="text-gray-400 font-semibold uppercase tracking-wider">Class</p>
              <p className="text-gray-700 font-semibold truncate">
                {teacher.classTeacherOf?.name ?? 'Not assigned'}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-gray-400 font-semibold uppercase tracking-wider">Subjects</p>
              <p className="text-gray-700 font-semibold">
                {teacher.subjectCount > 0 ? `${teacher.subjectCount}` : '—'}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end">
            <span className="inline-flex items-center justify-center rounded-lg bg-gray-100 text-gray-700 px-3 py-2 text-xs font-semibold">
              View
            </span>
          </div>
        </div>
      </div>
    </Link>
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

// ─── Invite Form ──────────────────────────────────────────────────────────────

interface ClassOption { id: string; name: string; level: string; hasTeacher: boolean; }

function InviteForm({ onSuccess, onCancel }: { onSuccess: (result: InviteResult) => void; onCancel: () => void }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [isClassTeacher, setIsClassTeacher] = useState(false);
  const [classId, setClassId] = useState('');
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch classes when class teacher toggle is turned on
  useEffect(() => {
    if (!isClassTeacher || classes.length > 0) return;
    setLoadingClasses(true);
    const token = localStorage.getItem('accessToken');
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/classes?limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setClasses(
          (d.classes ?? []).map((c: { id: string; name: string; level: string; classTeacher: unknown }) => ({
            id: c.id,
            name: c.name,
            level: c.level,
            hasTeacher: !!c.classTeacher,
          }))
        );
      })
      .catch(() => {})
      .finally(() => setLoadingClasses(false));
  }, [isClassTeacher, classes.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setError('All fields are required.');
      return;
    }
    if (isClassTeacher && !classId) {
      setError('Please select a class for this class teacher.');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const body: Record<string, string> = { firstName, lastName, phone };
      if (isClassTeacher && classId) body.classId = classId;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send invitation');
      onSuccess({ staffId: data.staffId, maskedPhone: data.phone, name: `${firstName} ${lastName}` });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const availableClasses = classes.filter((c) => !c.hasTeacher);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}

      <div className="grid grid-cols-2 gap-3">
        <Input label="First Name" placeholder="Kwame" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <Input label="Last Name" placeholder="Asante" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </div>

      <Input
        label="Phone Number" placeholder="024XXXXXXX" inputMode="tel"
        value={phone} onChange={(e) => setPhone(e.target.value)}
        helperText="An SMS with Staff ID and invitation code will be sent here."
      />

      {/* Class teacher toggle */}
      <div className="border border-gray-200 rounded-xl p-4 space-y-3">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-sm font-semibold text-gray-900">Class Teacher</p>
            <p className="text-xs text-gray-500 mt-0.5">Assign this teacher to a class now</p>
          </div>
          <div
            onClick={() => { setIsClassTeacher(!isClassTeacher); setClassId(''); }}
            className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${isClassTeacher ? 'bg-primary-600' : 'bg-gray-200'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isClassTeacher ? 'translate-x-6' : 'translate-x-1'}`} />
          </div>
        </label>

        {isClassTeacher && (
          <div>
            {loadingClasses ? (
              <p className="text-sm text-gray-400">Loading classes...</p>
            ) : availableClasses.length === 0 ? (
              <p className="text-sm text-warning-700 bg-warning-50 rounded-lg px-3 py-2">All classes already have teachers assigned</p>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Select Class</label>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                >
                  <option value="">Choose a class...</option>
                  {availableClasses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {!isClassTeacher && (
          <p className="text-xs text-gray-400">Subject assignments can be added from the teacher&apos;s profile after they join</p>
        )}
      </div>

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button type="submit" loading={loading} className="flex-1">Send Invitation</Button>
      </div>
    </form>
  );
}

function InviteSuccessView({ result, onDone, onInviteAnother }: { result: InviteResult; onDone: () => void; onInviteAnother: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center text-center gap-3 py-2">
        <div className="w-14 h-14 rounded-full bg-success-100 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-success-600" />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-lg">{result.name}</p>
          <p className="text-sm text-gray-500">has been invited successfully</p>
        </div>
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 font-medium">Staff ID</span>
          <span className="font-mono font-bold text-gray-900 text-base">{result.staffId}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 font-medium">SMS sent to</span>
          <span className="font-semibold text-gray-700">{result.maskedPhone}</span>
        </div>
      </div>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onInviteAnother} className="flex-1">Invite Another</Button>
        <Button onClick={onDone} className="flex-1">Done</Button>
      </div>
    </div>
  );
}

function EmptyState({ onInvite }: { onInvite: () => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-[var(--shadow-card)] flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mb-4">
        <GraduationCap className="w-8 h-8 text-primary-500" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">No teachers yet</h3>
      <p className="text-gray-500 max-w-sm mb-6">
        Invite your first teacher. They&apos;ll receive an SMS with their Staff ID and a code to set up their account.
      </p>
      <Button icon={<UserPlus className="w-4 h-4" />} onClick={onInvite}>Invite First Teacher</Button>
    </div>
  );
}
