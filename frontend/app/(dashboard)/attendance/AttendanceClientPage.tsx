'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, PageHeader } from '@/components/ui';
import {
  CalendarCheck, Users, GraduationCap, ChevronRight,
  CheckCircle2, X, Clock, Shield, UserCheck, UserX,
  BarChart3, AlertTriangle, Loader2, Phone, Search,
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
  PRESENT: { label: 'Present', icon: CheckCircle2, bg: 'bg-success-50', activeBg: 'bg-success-500', text: 'text-success-700', activeText: 'text-white', border: 'border-success-200', accent: 'border-l-success-700' },
  LATE:    { label: 'Late',    icon: Clock,         bg: 'bg-warning-50', activeBg: 'bg-warning-500', text: 'text-warning-700', activeText: 'text-white', border: 'border-warning-200', accent: 'border-l-warning-700' },
  ABSENT:  { label: 'Absent',  icon: X,             bg: 'bg-danger-50',  activeBg: 'bg-danger-500',  text: 'text-danger-700',  activeText: 'text-white', border: 'border-danger-200', accent: 'border-l-danger-700' },
  EXCUSED: { label: 'Excused', icon: Shield,        bg: 'bg-blue-50',    activeBg: 'bg-blue-500',    text: 'text-blue-700',    activeText: 'text-white', border: 'border-blue-200', accent: 'border-l-blue-700' },
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

// ─── Shared small components ──────────────────────────────────────────────────

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
  icon: typeof GraduationCap;
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
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide truncate">{label}</p>
        <p className="text-xl font-bold text-gray-900 tabular-nums leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function ClassListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-[76px] bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
      <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AttendanceClientPage() {
  const [user, setUser] = useState<{ role: UserRole; firstName: string; lastName: string } | null>(null);

  useEffect(() => { Promise.resolve().then(() => setUser(getUser())); }, []);

  if (!user) return <div className="p-8 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  if (user.role === 'TEACHER') return <TeacherView />;
  return <AdminView />;
}

// ─── Admin View ───────────────────────────────────────────────────────────────

function AdminView() {
  const [tab, setTab] = useState<Tab>('students');
  const [date, setDate] = useState(todayStr());

  return (
    <div className="p-4 sm:p-6 max-w-[1200px] mx-auto animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
            <CalendarCheck className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Attendance</h1>
            <p className="text-sm text-gray-500 mt-0.5">{formatDate(date)}</p>
          </div>
        </div>
        <div className="relative shrink-0">
          <CalendarCheck className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
            className="pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 shadow-sm"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100/80 rounded-xl w-fit">
        {(['students', 'teachers'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
              tab === t
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'students' ? 'Student Attendance' : 'Teacher Attendance'}
          </button>
        ))}
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
  const [search, setSearch] = useState('');

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

  const filteredClasses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.classTeacher?.name ?? '').toLowerCase().includes(q)
    );
  }, [classes, search]);

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
  const pendingCount = classes.length - markedCount;
  const completionPct = classes.length ? Math.round((markedCount / classes.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Total Classes" value={String(classes.length)} icon={GraduationCap} accent="primary" />
        <StatCard label="Marked Today" value={`${markedCount} / ${classes.length}`} icon={CheckCircle2} accent="success" />
        <StatCard
          label="Not Yet Marked"
          value={String(pendingCount)}
          sub={pendingCount > 0 ? 'Requires attention' : 'All complete'}
          icon={AlertTriangle}
          accent="warning"
        />
      </div>

      {/* Progress banner */}
      {classes.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-sm font-semibold text-gray-800">Daily completion</p>
            <span className="text-sm font-bold text-primary-700 tabular-nums">{completionPct}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                completionPct === 100 ? 'bg-emerald-500' : completionPct >= 50 ? 'bg-primary-500' : 'bg-amber-500'
              }`}
              style={{ width: `${completionPct}%` }}
            />
          </div>
          {pendingCount > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              {pendingCount} class{pendingCount !== 1 ? 'es' : ''} still need attendance marked for this date.
            </p>
          )}
        </div>
      )}

      {/* Class list */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Classes</h2>
            <p className="text-xs text-gray-500 mt-0.5">Tap a class to view or mark attendance</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search class or teacher…"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-400 focus:bg-white"
            />
          </div>
        </div>

        <div className="hidden md:grid md:grid-cols-[minmax(0,2fr)_auto_auto_minmax(0,1.5fr)_auto] gap-3 px-4 py-2 bg-gray-50/80 border-b border-gray-100 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
          <span>Class</span>
          <span className="text-center w-16">Students</span>
          <span className="text-center w-24">Status</span>
          <span>Attendance</span>
          <span className="w-5" />
        </div>

        <div className="divide-y divide-gray-50">
          {filteredClasses.length === 0 ? (
            <div className="py-12 text-center">
              <GraduationCap className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600">No classes found</p>
              <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
            </div>
          ) : (
            filteredClasses.map((cls) => (
              <button
                key={cls.id}
                onClick={() => setSelectedClassId(cls.id)}
                className="w-full text-left hover:bg-primary-50/30 transition-colors group"
              >
                <div className="flex items-center gap-3 px-4 py-3 md:grid md:grid-cols-[minmax(0,2fr)_auto_auto_minmax(0,1.5fr)_auto] md:gap-3 md:items-center">
                  <div className="flex items-center gap-3 min-w-0 flex-1 md:flex-none">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold shrink-0">
                      {cls.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-primary-800 truncate">{cls.name}</p>
                      <p className="text-xs text-gray-500 truncate">{cls.classTeacher?.name ?? 'No teacher assigned'}</p>
                    </div>
                  </div>

                  <span className="hidden md:flex items-center justify-center gap-1 text-sm text-gray-700 font-medium tabular-nums w-16">
                    <Users className="w-3.5 h-3.5 text-gray-400" />
                    {cls.totalStudents}
                  </span>

                  <div className="md:w-24 md:flex md:justify-center shrink-0 ml-auto md:ml-0">
                    {cls.isMarked ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold rounded-md">
                        <CheckCircle2 className="w-3 h-3" /> Marked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold rounded-md">
                        <AlertTriangle className="w-3 h-3" /> Pending
                      </span>
                    )}
                  </div>

                  <div className="hidden md:flex items-center gap-2 min-w-0">
                    {cls.counts && cls.rate !== null ? (
                      <>
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden min-w-[60px]">
                          <div
                            className={`h-full rounded-full ${cls.rate >= 80 ? 'bg-emerald-500' : cls.rate >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${cls.rate}%` }}
                          />
                        </div>
                        <span className={`text-xs font-bold tabular-nums w-9 text-right ${cls.rate >= 80 ? 'text-emerald-700' : cls.rate >= 60 ? 'text-amber-700' : 'text-red-700'}`}>
                          {cls.rate}%
                        </span>
                        <div className="hidden lg:flex items-center gap-1 text-[10px] text-gray-400 shrink-0">
                          <span className="text-emerald-600 font-medium">{cls.counts.PRESENT}P</span>
                          <span className="text-red-500 font-medium">{cls.counts.ABSENT}A</span>
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">Not marked yet</span>
                    )}
                  </div>

                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors shrink-0 hidden md:block" />
                </div>

                {/* Mobile meta row */}
                <div className="flex md:hidden items-center gap-3 px-4 pb-3 -mt-1 pl-[3.25rem] text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {cls.totalStudents} students
                  </span>
                  {cls.rate !== null && (
                    <span className={`font-semibold ${cls.rate >= 80 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {cls.rate}% present
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { label: 'Present', val: present, icon: CheckCircle2, accent: 'success' as const },
          { label: 'Late', val: late, icon: Clock, accent: 'warning' as const },
          { label: 'Absent', val: absent, icon: UserX, accent: 'slate' as const },
          { label: 'Excused', val: excused, icon: Shield, accent: 'primary' as const },
        ]).map(({ label, val, icon, accent }) => (
          <StatCard key={label} label={label} value={String(val)} icon={icon} accent={accent} />
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Staff roster</h2>
          <p className="text-xs text-gray-500 mt-0.5">{teachers.length} teachers · tap Edit to update status</p>
        </div>
        <div className="hidden md:grid md:grid-cols-[minmax(0,2fr)_auto_auto_auto_auto] gap-3 px-4 py-2 bg-gray-50/80 border-b border-gray-100 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
          <span>Teacher</span>
          <span>Class</span>
          <span>Check-in</span>
          <span>Status</span>
          <span />
        </div>
        <div className="divide-y divide-gray-50">
          {teachers.map((t) => {
            const cfg = t.status ? STATUS_CFG[t.status] : null;
            const isEditing = editingId === t.id;
            return (
              <div key={t.id} className="px-4 py-3 hover:bg-gray-50/50 transition-colors">
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
      <div className="p-4 sm:p-6 md:p-8 max-w-[1400px] mx-auto animate-fade-in">
        <PageHeader title="Attendance" />
        <div className="bg-white border border-gray-200 rounded-2xl p-10 sm:p-16 text-center shadow-sm">
          <CalendarCheck className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">No class assigned</h3>
          <p className="text-gray-500">You are not assigned as a class teacher. Contact admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1400px] mx-auto animate-fade-in space-y-4 sm:space-y-6">
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
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus | undefined>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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

      // Pre-fill statuses: if already marked use existing, else leave unselected
      const initial: Record<string, AttendanceStatus | undefined> = {};
      d.students.forEach((s: AttendanceStudent) => {
        initial[s.id] = (s.status as AttendanceStatus) ?? undefined;
      });
      setStatuses(initial);
      setNotes({});
      setSubmitted(d.alreadyMarked);
      setIsEditing(false);
      setSearchTerm('');
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
        status: statuses[s.id],
        note: notes[s.id] || undefined,
      }));
      const hasUnselected = records.some((r) => !r.status);
      if (hasUnselected) {
        throw new Error('Please choose attendance status for every student (or use Mark all)');
      }
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendance/students/mark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ classId, date, records }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result.message || result.error || `Could not save attendance (${res.status})`);
      }
      setSubmitted(true);
      setIsEditing(false);
      fetchAttendance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save attendance. Please try again.');
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
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredStudents = normalizedSearch
    ? data.students.filter((student) =>
        student.name.toLowerCase().includes(normalizedSearch) ||
        student.studentId.toLowerCase().includes(normalizedSearch) ||
        (student.parentPhone ?? '').toLowerCase().includes(normalizedSearch)
      )
    : data.students;

  const counts = Object.values(statuses).reduce((acc, s) => {
    if (!s) return acc;
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(Object.keys(STATUS_CFG) as AttendanceStatus[]).map((s) => {
            const cfg = STATUS_CFG[s];
            const count = data.students.filter((st) => st.status === s).length;
            return (
              <div key={s} className={`flex flex-col items-center gap-1 p-3.5 rounded-2xl border-l-4 ${cfg.accent} ${cfg.bg}`}>
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
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 sm:px-6 py-3 border-b border-gray-100 bg-gray-50/50">
          <div className="relative min-w-0">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search student name, ID or phone"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        <div className="px-4 sm:px-6 py-2.5 bg-white border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center justify-between">
          <span>{filteredStudents.length} Students</span>
          {showMarkingUI && (
            <span className="font-normal text-gray-400 normal-case">
              {counts['PRESENT'] ?? 0} present · {counts['ABSENT'] ?? 0} absent · {counts['LATE'] ?? 0} late
            </span>
          )}
        </div>
        <div className="divide-y divide-gray-100">
          {filteredStudents.map((student, idx) => {
            const currentStatus = statuses[student.id];

            return (
              <div key={student.id} className="flex items-start gap-3 px-4 sm:px-6 py-3">
                {/* Index + avatar */}
                <span className="text-xs text-gray-400 font-mono w-5 text-center flex-shrink-0">{idx + 1}</span>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${showMarkingUI ? (currentStatus ? STATUS_CFG[currentStatus].bg : 'bg-gray-100') : 'bg-gray-100'} ${showMarkingUI ? (currentStatus ? STATUS_CFG[currentStatus].text : 'text-gray-600') : 'text-gray-600'}`}>
                  {student.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0 sm:flex sm:items-center sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    {/* Name */}
                    <Link href={`/students/${student.id}`} className="text-sm font-semibold text-gray-900 hover:text-primary-700 block truncate leading-tight">
                      {student.name}
                    </Link>
                    {student.parentPhone && (
                      <a href={`tel:${student.parentPhone}`} className="text-xs text-gray-400 flex items-center gap-1 hover:text-primary-600 mt-0.5">
                        <Phone className="w-3 h-3" />{student.parentPhone}
                      </a>
                    )}
                  </div>

                  {/* Status buttons (mark mode) or badge (view mode) */}
                  {showMarkingUI ? (
                    <div className="flex gap-1.5 mt-2 sm:mt-0 sm:flex-shrink-0">
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
                    <div className="mt-2 sm:mt-0 sm:flex-shrink-0">
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
              </div>
            );
          })}
          {filteredStudents.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-500">
              No students match your search.
            </div>
          )}
        </div>
      </div>

      {/* Submit bar */}
      {showMarkingUI && (
        <div className="sticky bottom-0 bg-white border border-gray-200 rounded-2xl shadow-sm px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
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
