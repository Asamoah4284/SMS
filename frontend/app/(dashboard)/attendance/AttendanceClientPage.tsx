'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, PageHeader } from '@/components/ui';
import {
  CalendarCheck, Users, GraduationCap, ChevronRight,
  CheckCircle2, X, Clock, Shield, UserCheck, UserX,
  BarChart3, AlertTriangle, Loader2, Phone,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRole = 'ADMIN' | 'TEACHER' | 'PARENT';

interface AttendanceStudent {
  id: string;
  studentId: string;
  name: string;
  gender: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | null;
  note: string | null;
  attendanceId: string | null;
  parentName: string | null;
  parentPhone: string | null;
}

interface ClassAttendanceSummary {
  id: string;
  name: string;
  level: string;
  classTeacher: { id: string; name: string } | null;
  totalStudents: number;
  marked: number;
  isMarked: boolean;
  counts: { PRESENT: number; ABSENT: number; LATE: number; EXCUSED: number } | null;
  rate: number | null;
}

interface TeacherAttendanceRecord {
  id: string;
  staffId: string;
  name: string;
  phone: string;
  classTeacherOf: { id: string; name: string } | null;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | null;
  checkIn: string | null;
  note: string | null;
  attendanceId: string | null;
}

type Tab = 'students' | 'teachers';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG = {
  PRESENT: { label: 'Present', icon: CheckCircle2, bg: 'bg-success-50', activeBg: 'bg-success-500', text: 'text-success-700', activeText: 'text-white', border: 'border-success-200' },
  LATE:    { label: 'Late',    icon: Clock,         bg: 'bg-warning-50', activeBg: 'bg-warning-500', text: 'text-warning-700', activeText: 'text-white', border: 'border-warning-200' },
  ABSENT:  { label: 'Absent',  icon: X,             bg: 'bg-danger-50',  activeBg: 'bg-danger-500',  text: 'text-danger-700',  activeText: 'text-white', border: 'border-danger-200' },
  EXCUSED: { label: 'Excused', icon: Shield,        bg: 'bg-blue-50',    activeBg: 'bg-blue-500',    text: 'text-blue-700',    activeText: 'text-white', border: 'border-blue-200' },
} as const;

type AttendanceStatus = keyof typeof STATUS_CFG;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(str: string) {
  return new Date(str + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
}

function getUser(): { role: UserRole; firstName: string; lastName: string } | null {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AttendanceClientPage() {
  const [user, setUser] = useState<{ role: UserRole; firstName: string; lastName: string } | null>(null);

  useEffect(() => { setUser(getUser()); }, []);

  if (!user) return <div className="p-8 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  if (user.role === 'TEACHER') return <TeacherView />;
  return <AdminView />;
}

// ─── Admin View ───────────────────────────────────────────────────────────────

function AdminView() {
  const [tab, setTab] = useState<Tab>('students');
  const [date, setDate] = useState(todayStr());

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-fade-in space-y-6">
      <PageHeader
        title="Attendance"
        subtitle={formatDate(date)}
        actions={
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
          />
        }
      />

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {(['students', 'teachers'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors capitalize ${
                tab === t
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t === 'students' ? 'Student Attendance' : 'Teacher Attendance'}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'students' && <AdminStudentAttendance date={date} />}
      {tab === 'teachers' && <AdminTeacherAttendance date={date} />}
    </div>
  );
}

// ─── Admin: Student Attendance (class overview + drill-down) ──────────────────

function AdminStudentAttendance({ date }: { date: string }) {
  const [classes, setClasses] = useState<ClassAttendanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/attendance/classes?date=${date}`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      if (!res.ok) throw new Error('Failed to load class attendance');
      const data = await res.json();
      setClasses(data.classes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchClasses(); setSelectedClassId(null); }, [fetchClasses]);

  if (selectedClassId) {
    return (
      <AttendanceMarkView
        classId={selectedClassId}
        date={date}
        isAdmin
        onBack={() => { setSelectedClassId(null); fetchClasses(); }}
      />
    );
  }

  if (loading) return <ClassListSkeleton />;
  if (error) return <Alert type="error" message={error} />;

  const markedCount = classes.filter((c) => c.isMarked).length;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard icon={<GraduationCap className="w-5 h-5 text-primary-600" />} label="Total Classes" value={String(classes.length)} bg="bg-primary-50" />
        <SummaryCard icon={<CheckCircle2 className="w-5 h-5 text-success-600" />} label="Marked Today" value={`${markedCount} / ${classes.length}`} bg="bg-success-50" />
        <SummaryCard icon={<AlertTriangle className="w-5 h-5 text-warning-600" />} label="Not Yet Marked" value={String(classes.length - markedCount)} bg="bg-warning-50" />
      </div>

      {/* Class list */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
        <div className="grid grid-cols-[2fr_1fr_1fr_2fr_auto] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
          <span>Class</span>
          <span>Students</span>
          <span>Status</span>
          <span className="hidden lg:block">Attendance</span>
          <span />
        </div>
        <div className="divide-y divide-gray-100">
          {classes.map((cls) => (
            <button
              key={cls.id}
              onClick={() => setSelectedClassId(cls.id)}
              className="w-full grid grid-cols-[2fr_1fr_1fr_2fr_auto] gap-4 items-center px-6 py-4 hover:bg-gray-50 transition-colors group text-left"
            >
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 group-hover:text-primary-700 truncate">{cls.name}</p>
                <p className="text-xs text-gray-400">{cls.classTeacher?.name ?? 'No teacher assigned'}</p>
              </div>
              <span className="text-sm text-gray-700 font-medium">{cls.totalStudents}</span>
              <div>
                {cls.isMarked ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-success-50 border border-success-200 text-success-700 text-xs font-bold rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Marked
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-warning-50 border border-warning-200 text-warning-700 text-xs font-bold rounded-full">
                    <AlertTriangle className="w-3 h-3" /> Pending
                  </span>
                )}
              </div>
              <div className="hidden lg:flex items-center gap-3">
                {cls.counts && cls.rate !== null ? (
                  <>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-2 rounded-full ${cls.rate >= 80 ? 'bg-success-500' : cls.rate >= 60 ? 'bg-warning-500' : 'bg-danger-500'}`}
                        style={{ width: `${cls.rate}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold w-8 text-right ${cls.rate >= 80 ? 'text-success-700' : 'text-danger-700'}`}>{cls.rate}%</span>
                  </>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Admin: Teacher Attendance ────────────────────────────────────────────────

function AdminTeacherAttendance({ date }: { date: string }) {
  const [teachers, setTeachers] = useState<TeacherAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('ABSENT');
  const [editNote, setEditNote] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/attendance/teachers?date=${date}`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setTeachers(data.teachers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teacher attendance');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

  const handleSave = async (teacherId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendance/teachers/${teacherId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ date, status: editStatus, note: editNote }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setEditingId(null);
      fetchTeachers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const present = teachers.filter((t) => t.status === 'PRESENT').length;
  const absent = teachers.filter((t) => !t.status || t.status === 'ABSENT').length;
  const late = teachers.filter((t) => t.status === 'LATE').length;
  const excused = teachers.filter((t) => t.status === 'EXCUSED').length;

  if (loading) return <ClassListSkeleton />;
  if (error) return <Alert type="error" message={error} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        {([
          { label: 'Present', val: present, cfg: STATUS_CFG.PRESENT },
          { label: 'Late', val: late, cfg: STATUS_CFG.LATE },
          { label: 'Absent', val: absent, cfg: STATUS_CFG.ABSENT },
          { label: 'Excused', val: excused, cfg: STATUS_CFG.EXCUSED },
        ]).map(({ label, val, cfg }) => (
          <div key={label} className={`${cfg.bg} border ${cfg.border} rounded-2xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${cfg.text}`}>{val}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
          <span>Teacher</span>
          <span>Class</span>
          <span>Check-in</span>
          <span>Status</span>
          <span />
        </div>
        <div className="divide-y divide-gray-100">
          {teachers.map((t) => {
            const cfg = t.status ? STATUS_CFG[t.status] : null;
            const isEditing = editingId === t.id;
            return (
              <div key={t.id} className="px-6 py-4">
                {isEditing ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{t.staffId}</p>
                    </div>
                    <div className="flex gap-2">
                      {(Object.keys(STATUS_CFG) as AttendanceStatus[]).map((s) => {
                        const c = STATUS_CFG[s];
                        const active = editStatus === s;
                        return (
                          <button
                            key={s}
                            onClick={() => setEditStatus(s)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${active ? `${c.activeBg} ${c.activeText} border-transparent` : `${c.bg} ${c.text} ${c.border}`}`}
                          >
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      placeholder="Note (optional)"
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-40"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSave(t.id)} loading={saving}>Save</Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${cfg ? cfg.bg : 'bg-gray-100'} ${cfg ? cfg.text : 'text-gray-500'}`}>
                        {t.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{t.staffId}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-600">{t.classTeacherOf?.name ?? '—'}</span>
                    <span className="text-xs text-gray-500">
                      {t.checkIn ? new Date(t.checkIn).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                    <div>
                      {cfg ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                          {cfg.label}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No record</span>
                      )}
                      {t.note && <p className="text-xs text-gray-400 mt-0.5 italic">{t.note}</p>}
                    </div>
                    <button
                      onClick={() => {
                        setEditingId(t.id);
                        setEditStatus((t.status as AttendanceStatus) ?? 'ABSENT');
                        setEditNote(t.note ?? '');
                      }}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Teacher View ─────────────────────────────────────────────────────────────

function TeacherView() {
  const [classId, setClassId] = useState<string | null>(null);
  const [className, setClassName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getToken();
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendance/my-class`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setClassId(d.classId);
        setClassName(d.className ?? '');
      })
      .catch(() => setError('Failed to load class info'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (error) return <div className="p-8"><Alert type="error" message={error} /></div>;

  if (!classId) {
    return (
      <div className="p-8 max-w-[1400px] mx-auto animate-fade-in">
        <PageHeader title="Attendance" />
        <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center shadow-[var(--shadow-card)]">
          <CalendarCheck className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">No class assigned</h3>
          <p className="text-gray-500">You are not assigned as a class teacher. Contact admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-fade-in space-y-6">
      <PageHeader title="Attendance" subtitle={className} />
      <AttendanceMarkView classId={classId} date={todayStr()} isAdmin={false} onBack={() => {}} />
    </div>
  );
}

// ─── Attendance Mark/View Component (shared) ──────────────────────────────────

function AttendanceMarkView({
  classId,
  date,
  isAdmin,
  onBack,
}: {
  classId: string;
  date: string;
  isAdmin: boolean;
  onBack: () => void;
}) {
  const [data, setData] = useState<{ className: string; alreadyMarked: boolean; students: AttendanceStudent[]; classTeacher: { id: string; name: string } | null } | null>(null);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const isToday = date === todayStr();
  const canEdit = isAdmin || isToday;

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/attendance/students?classId=${classId}&date=${date}`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      if (!res.ok) throw new Error('Failed to load attendance');
      const d = await res.json();
      setData(d);

      // Pre-fill statuses: if already marked use existing, else default to PRESENT
      const initial: Record<string, AttendanceStatus> = {};
      d.students.forEach((s: AttendanceStudent) => {
        initial[s.id] = (s.status as AttendanceStatus) ?? 'PRESENT';
      });
      setStatuses(initial);
      setNotes({});
      setSubmitted(d.alreadyMarked);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [classId, date]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const handleMarkAll = (status: AttendanceStatus) => {
    if (!data) return;
    const all: Record<string, AttendanceStatus> = {};
    data.students.forEach((s) => { all[s.id] = status; });
    setStatuses(all);
  };

  const handleSubmit = async () => {
    if (!data) return;
    setSubmitting(true);
    setError('');
    try {
      const records = data.students.map((s) => ({
        studentId: s.id,
        status: statuses[s.id] ?? 'PRESENT',
        note: notes[s.id] || undefined,
      }));
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendance/students/mark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ classId, date, records }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Failed to mark attendance');
      setSubmitted(true);
      setIsEditing(false);
      fetchAttendance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark attendance');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="space-y-3">
      {[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
    </div>
  );

  if (error) return <Alert type="error" message={error} />;
  if (!data) return null;

  const showMarkingUI = !data.alreadyMarked || isEditing;

  const counts = Object.values(statuses).reduce(
    (acc, s) => { acc[s] = (acc[s] ?? 0) + 1; return acc; },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          {isAdmin && (
            <button onClick={onBack} className="text-sm text-primary-600 hover:text-primary-700 font-medium mb-1 flex items-center gap-1">
              ← All Classes
            </button>
          )}
          <h2 className="text-xl font-bold text-gray-900">{data.className}</h2>
          <p className="text-sm text-gray-500">{formatDate(date)}</p>
        </div>
        {data.alreadyMarked && !isEditing && canEdit && (
          <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
            {isAdmin ? 'Edit Attendance' : 'Contact admin to edit'}
          </Button>
        )}
      </div>

      {/* Read-only notice for teachers on past dates */}
      {!isToday && !isAdmin && (
        <div className="bg-warning-50 border border-warning-200 rounded-xl px-4 py-3 text-sm text-warning-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          This is a past date. Attendance is read-only. Contact admin to make changes.
        </div>
      )}

      {/* Already marked summary */}
      {data.alreadyMarked && !isEditing && (
        <div className="grid grid-cols-4 gap-3">
          {(Object.keys(STATUS_CFG) as AttendanceStatus[]).map((s) => {
            const cfg = STATUS_CFG[s];
            const count = data.students.filter((st) => st.status === s).length;
            return (
              <div key={s} className={`flex flex-col items-center gap-1 p-4 rounded-2xl border ${cfg.bg} ${cfg.border}`}>
                <p className={`text-2xl font-bold ${cfg.text}`}>{count}</p>
                <p className="text-xs text-gray-500">{cfg.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick-mark buttons (only in mark mode) */}
      {showMarkingUI && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Mark all:</span>
          {(Object.keys(STATUS_CFG) as AttendanceStatus[]).map((s) => {
            const cfg = STATUS_CFG[s];
            return (
              <button
                key={s}
                onClick={() => handleMarkAll(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${cfg.bg} ${cfg.text} ${cfg.border} hover:opacity-80`}
              >
                All {cfg.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Student list */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between">
          <span>{data.students.length} Students</span>
          {showMarkingUI && (
            <span className="font-normal text-gray-400 normal-case">
              {counts['PRESENT'] ?? 0} present · {counts['ABSENT'] ?? 0} absent · {counts['LATE'] ?? 0} late
            </span>
          )}
        </div>
        <div className="divide-y divide-gray-100">
          {data.students.map((student, idx) => {
            const currentStatus = statuses[student.id] ?? 'PRESENT';

            return (
              <div key={student.id} className="flex items-center gap-3 px-6 py-3.5">
                {/* Index + avatar */}
                <span className="text-xs text-gray-400 font-mono w-5 text-center flex-shrink-0">{idx + 1}</span>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${showMarkingUI ? (STATUS_CFG[currentStatus]?.bg ?? 'bg-gray-100') : 'bg-gray-100'} ${showMarkingUI ? (STATUS_CFG[currentStatus]?.text ?? 'text-gray-600') : 'text-gray-600'}`}>
                  {student.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <Link href={`/students/${student.id}`} className="text-sm font-semibold text-gray-900 hover:text-primary-700 truncate block">
                    {student.name}
                  </Link>
                  {student.parentPhone && (
                    <a href={`tel:${student.parentPhone}`} className="text-xs text-gray-400 flex items-center gap-1 hover:text-primary-600">
                      <Phone className="w-3 h-3" />{student.parentPhone}
                    </a>
                  )}
                </div>

                {/* Status buttons (mark mode) or badge (view mode) */}
                {showMarkingUI ? (
                  <div className="flex gap-1.5">
                    {(Object.keys(STATUS_CFG) as AttendanceStatus[]).map((s) => {
                      const cfg = STATUS_CFG[s];
                      const active = currentStatus === s;
                      const Icon = cfg.icon;
                      return (
                        <button
                          key={s}
                          title={cfg.label}
                          onClick={() => setStatuses((prev) => ({ ...prev, [student.id]: s }))}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all border ${
                            active
                              ? `${cfg.activeBg} ${cfg.activeText} border-transparent shadow-sm`
                              : `${cfg.bg} ${cfg.text} ${cfg.border} opacity-50 hover:opacity-100`
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div>
                    {student.status ? (
                      (() => {
                        const cfg = STATUS_CFG[student.status as AttendanceStatus];
                        return (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                            {cfg.label}
                          </span>
                        );
                      })()
                    ) : (
                      <span className="text-xs text-gray-400 italic">Not marked</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Submit bar */}
      {showMarkingUI && (
        <div className="sticky bottom-0 bg-white border border-gray-200 rounded-2xl shadow-lg px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex gap-4 text-sm">
            {(Object.keys(STATUS_CFG) as AttendanceStatus[]).map((s) => {
              const cfg = STATUS_CFG[s];
              const count = counts[s] ?? 0;
              if (count === 0) return null;
              return (
                <span key={s} className={`font-bold ${cfg.text}`}>
                  {count} {cfg.label}
                </span>
              );
            })}
          </div>
          <div className="flex gap-2">
            {isEditing && (
              <Button variant="secondary" onClick={() => { setIsEditing(false); fetchAttendance(); }} disabled={submitting}>
                Cancel
              </Button>
            )}
            <Button onClick={handleSubmit} loading={submitting} icon={<CheckCircle2 className="w-4 h-4" />}>
              {data.alreadyMarked ? 'Update Attendance' : 'Submit Attendance'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared small components ──────────────────────────────────────────────────

function SummaryCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: string; bg: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-[var(--shadow-card)] flex items-center gap-4">
      <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>{icon}</div>
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function ClassListSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
    </div>
  );
}
