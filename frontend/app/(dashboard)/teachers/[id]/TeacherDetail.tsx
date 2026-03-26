'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Alert } from '@/components/ui';
import {
  GraduationCap, Hash, Phone, Mail, BookOpen, Users,
  CalendarCheck, Clock, CheckCircle2, XCircle, AlertTriangle,
  FileText, Calendar, Award, TrendingDown, ChevronRight,
  UserCheck, UserX, ClipboardList,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
type LeaveType = 'SICK_LEAVE' | 'PERSONAL_LEAVE' | 'MATERNITY_LEAVE' | 'PATERNITY_LEAVE' | 'STUDY_LEAVE' | 'OTHER';
type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface TimetableEntry {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subject: { name: string; code: string | null };
  class: { name: string };
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: AttendanceStatus;
  checkIn: string | null;
  checkOut: string | null;
  note: string | null;
}

interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  excused: number;
  rate: number;
}

interface LeaveRequest {
  id: string;
  type: LeaveType;
  reason: string;
  startDate: string;
  endDate: string;
  status: RequestStatus;
  adminNote: string | null;
  createdAt: string;
}

interface ClassPerformance {
  avgScore: number;
  topStudents: Array<{ id: string; name: string; avgScore: number }>;
  struggling: Array<{ id: string; name: string; avgScore: number }>;
}

interface TeacherData {
  id: string;
  staffId: string;
  qualification: string | null;
  user: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    isActive: boolean;
    joinedAt: string;
  };
  classTeacherOf: { id: string; name: string; studentCount: number } | null;
  subjects: Array<{ id: string; name: string; code: string | null; class: { id: string; name: string } }>;
  timetable: TimetableEntry[];
  attendance: { summary: AttendanceSummary; records: AttendanceRecord[] };
  leaveRequests: LeaveRequest[];
  classPerformance: ClassPerformance | null;
}

type Tab = 'overview' | 'timetable' | 'attendance' | 'leaves';

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TeacherDetail({ teacherId }: { teacherId: string }) {
  const [teacher, setTeacher] = useState<TeacherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const fetchTeacher = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/teachers/${teacherId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Teacher not found');
      setTeacher(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teacher');
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => { fetchTeacher(); }, [fetchTeacher]);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 md:p-8 max-w-[1400px] mx-auto animate-fade-in space-y-6">
        <div className="h-8 w-40 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (error) return <div className="p-4 sm:p-6 md:p-8"><Alert type="error" message={error} /></div>;
  if (!teacher) return null;

  const fullName = `${teacher.user.firstName} ${teacher.user.lastName}`.trim();
  const initials = `${teacher.user.firstName[0] ?? ''}${teacher.user.lastName[0] ?? ''}`.toUpperCase();

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1400px] mx-auto animate-fade-in space-y-6">
      {/* Back */}
      <Link href="/teachers" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium">
        ← Back to Teachers
      </Link>

      {/* Profile header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-700 border border-gray-200 flex items-center justify-center font-bold text-xl flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                  {fullName}
                </h1>
              </div>
              {teacher.user.isActive ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 px-2 py-1 text-[11px] font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 px-2 py-1 text-[11px] font-semibold">
                  <Clock className="w-3.5 h-3.5" />
                  Pending
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-500 font-mono mb-3">
              <Hash className="w-3.5 h-3.5" />
              {teacher.staffId}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-gray-600">
              <span className="flex items-center gap-1.5 min-w-0">
                <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="truncate">{teacher.user.phone}</span>
              </span>
              {teacher.user.email && (
                <span className="flex items-center gap-1.5 min-w-0">
                  <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="truncate">{teacher.user.email}</span>
                </span>
              )}
              {teacher.qualification && (
                <span className="flex items-center gap-1.5 min-w-0">
                  <GraduationCap className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="truncate">{teacher.qualification}</span>
                </span>
              )}
              <span className="flex items-center gap-1.5 min-w-0">
                <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="truncate">
                  Joined{' '}
                  {new Date(teacher.user.joinedAt).toLocaleDateString('en-GB', {
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </span>
            </div>
          </div>
          {teacher.classTeacherOf && (
            <Link
              href={`/classes/${teacher.classTeacherOf.id}`}
              className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 hover:bg-gray-100 transition-colors w-full sm:w-auto sm:min-w-[220px]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <BookOpen className="w-5 h-5 text-gray-700 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 font-semibold">Class Teacher</p>
                  <p className="text-sm font-bold text-gray-900 truncate">{teacher.classTeacherOf.name}</p>
                  <p className="text-xs text-gray-500">{teacher.classTeacherOf.studentCount} students</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
            </Link>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStat
          icon={<Users className="w-5 h-5 text-blue-700" />}
          label={teacher.classTeacherOf ? 'Class Students' : 'Students Taught'}
          value={teacher.classTeacherOf ? String(teacher.classTeacherOf.studentCount) : '—'}
          colorClass="bg-white"
        />
        <MiniStat
          icon={<BookOpen className="w-5 h-5 text-amber-700" />}
          label="Subjects"
          value={String(teacher.subjects.length)}
          colorClass="bg-white"
        />
        <MiniStat
          icon={<CalendarCheck className="w-5 h-5 text-emerald-700" />}
          label="Attendance Rate"
          value={`${teacher.attendance.summary.rate}%`}
          colorClass="bg-white"
        />
        <MiniStat
          icon={<FileText className="w-5 h-5 text-purple-700" />}
          label="Leave Requests"
          value={String(teacher.leaveRequests.length)}
          colorClass="bg-white"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {(['overview', 'timetable', 'attendance', 'leaves'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'leaves' && teacher.leaveRequests.filter((l) => l.status === 'PENDING').length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-warning-100 text-warning-700 rounded-full">
                  {teacher.leaveRequests.filter((l) => l.status === 'PENDING').length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && <OverviewTab teacher={teacher} />}
      {activeTab === 'timetable' && <TimetableTab timetable={teacher.timetable} isClassTeacher={!!teacher.classTeacherOf} />}
      {activeTab === 'attendance' && <AttendanceTab attendance={teacher.attendance} />}
      {activeTab === 'leaves' && <LeavesTab leaves={teacher.leaveRequests} />}
    </div>
  );
}

// ─── Mini Stat ────────────────────────────────────────────────────────────────

function MiniStat({ icon, label, value, colorClass }: { icon: React.ReactNode; label: string; value: string; colorClass: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className={`w-9 h-9 ${colorClass} rounded-xl flex items-center justify-center mb-2`}>{icon}</div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ teacher }: { teacher: TeacherData }) {
  return (
    <div className="space-y-5">
      {/* Subjects list */}
      {teacher.subjects.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-gray-500" /> Subjects Teaching
          </h3>
          <div className="space-y-2">
            {teacher.subjects.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2.5 px-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                    <BookOpen className="w-3.5 h-3.5 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{s.name}</p>
                    {s.code && <p className="text-xs text-gray-500 font-mono">{s.code}</p>}
                  </div>
                </div>
                <Link href={`/classes/${s.class.id}`} className="flex items-center gap-1.5 text-sm text-primary-700 font-semibold hover:underline">
                  {s.class.name} <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Class performance (if class teacher) */}
      {teacher.classPerformance && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-[var(--shadow-card)]">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-warning-500" /> Class Performance ({teacher.classTeacherOf?.name})
          </h3>
          <div className="mb-5">
            <div className="flex justify-between text-sm text-gray-600 mb-1.5">
              <span>Class average</span>
              <span className="font-bold text-gray-900">{teacher.classPerformance.avgScore}%</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-3 rounded-full ${teacher.classPerformance.avgScore >= 70 ? 'bg-success-500' : teacher.classPerformance.avgScore >= 50 ? 'bg-warning-500' : 'bg-danger-500'}`}
                style={{ width: `${teacher.classPerformance.avgScore}%` }}
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Top Students</p>
              <div className="space-y-2.5">
                {teacher.classPerformance.topStudents.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? 'bg-warning-100 text-warning-700' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</div>
                    <span className="flex-1 text-sm font-medium text-gray-800 truncate">{s.name}</span>
                    <span className="text-xs font-bold text-success-700">{s.avgScore}%</span>
                  </div>
                ))}
              </div>
            </div>
            {teacher.classPerformance.struggling.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Needs Support</p>
                <div className="space-y-2.5">
                  {teacher.classPerformance.struggling.map((s) => (
                    <div key={s.id} className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-danger-50 flex items-center justify-center flex-shrink-0">
                        <TrendingDown className="w-3 h-3 text-danger-600" />
                      </div>
                      <span className="flex-1 text-sm font-medium text-gray-800 truncate">{s.name}</span>
                      <span className="text-xs font-bold text-danger-700">{s.avgScore}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {teacher.subjects.length === 0 && !teacher.classTeacherOf && (
        <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-600">No assignments yet</p>
          <p className="text-sm text-gray-400 mt-1">This teacher has no class or subject assignments</p>
        </div>
      )}
    </div>
  );
}

// ─── Timetable Tab ────────────────────────────────────────────────────────────

function TimetableTab({ timetable, isClassTeacher }: { timetable: TimetableEntry[]; isClassTeacher: boolean }) {
  if (timetable.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl py-16 text-center shadow-[var(--shadow-card)]">
        <CalendarCheck className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        <p className="font-semibold text-gray-600">No timetable set</p>
        <p className="text-sm text-gray-400 mt-1">Timetable entries will appear here once configured</p>
      </div>
    );
  }

  // Group by day
  const byDay: Record<number, TimetableEntry[]> = {};
  timetable.forEach((entry) => {
    if (!byDay[entry.dayOfWeek]) byDay[entry.dayOfWeek] = [];
    byDay[entry.dayOfWeek].push(entry);
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        {isClassTeacher ? 'Full class timetable' : 'Your teaching schedule across classes'}
      </p>
      {[1, 2, 3, 4, 5].map((day) => {
        const entries = byDay[day];
        if (!entries || entries.length === 0) return null;
        return (
          <div key={day} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="font-bold text-gray-900 text-sm">{DAY_NAMES[day]}</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="text-center min-w-[70px]">
                    <p className="text-xs font-bold text-gray-900">{entry.startTime}</p>
                    <p className="text-xs text-gray-400">{entry.endTime}</p>
                  </div>
                  <div className="w-0.5 h-8 bg-primary-200 rounded-full flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{entry.subject.name}</p>
                    {entry.subject.code && <p className="text-xs text-gray-400 font-mono">{entry.subject.code}</p>}
                  </div>
                  {!isClassTeacher && (
                    <Link href={`/classes/${entry.class.name}`} className="flex items-center gap-1.5 text-xs font-semibold text-primary-700 bg-primary-50 px-2.5 py-1 rounded-lg">
                      <BookOpen className="w-3 h-3" />
                      {entry.class.name}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────

function AttendanceTab({ attendance }: { attendance: { summary: AttendanceSummary; records: AttendanceRecord[] } }) {
  const { summary, records } = attendance;

  const statusConfig: Record<AttendanceStatus, { label: string; icon: React.ReactNode; cls: string }> = {
    PRESENT: { label: 'Present', icon: <UserCheck className="w-3.5 h-3.5" />, cls: 'bg-success-50 text-success-700 border-success-200' },
    ABSENT: { label: 'Absent', icon: <UserX className="w-3.5 h-3.5" />, cls: 'bg-danger-50 text-danger-700 border-danger-200' },
    LATE: { label: 'Late', icon: <Clock className="w-3.5 h-3.5" />, cls: 'bg-warning-50 text-warning-700 border-warning-200' },
    EXCUSED: { label: 'Excused', icon: <CheckCircle2 className="w-3.5 h-3.5" />, cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  };

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-[var(--shadow-card)]">
        <h3 className="font-bold text-gray-900 mb-4">This Term</h3>
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1.5">
            <span>Attendance rate</span>
            <span className="font-bold text-gray-900">{summary.rate}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-3 rounded-full ${summary.rate >= 80 ? 'bg-success-500' : summary.rate >= 60 ? 'bg-warning-500' : 'bg-danger-500'}`}
              style={{ width: `${summary.rate}%` }}
            />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {([
            { key: 'present', val: summary.present, label: 'Present', bg: 'bg-success-50', text: 'text-success-700' },
            { key: 'absent', val: summary.absent, label: 'Absent', bg: 'bg-danger-50', text: 'text-danger-700' },
            { key: 'late', val: summary.late, label: 'Late', bg: 'bg-warning-50', text: 'text-warning-700' },
            { key: 'excused', val: summary.excused, label: 'Excused', bg: 'bg-blue-50', text: 'text-blue-700' },
          ] as const).map(({ key, val, label, bg, text }) => (
            <div key={key} className={`flex flex-col items-center gap-1 py-3 rounded-xl ${bg}`}>
              <p className={`text-2xl font-bold ${text}`}>{val}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Records table */}
      {records.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
          <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
            <span>Date</span>
            <span>Status</span>
            <span className="hidden md:block">Check In</span>
            <span className="hidden md:block">Check Out</span>
          </div>
          <div className="divide-y divide-gray-100">
            {records.map((record) => {
              const cfg = statusConfig[record.status];
              return (
                <div key={record.id} className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-4 items-center px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {new Date(record.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.cls} w-fit`}>
                    {cfg.icon} {cfg.label}
                  </span>
                  <span className="hidden md:block text-sm text-gray-600">
                    {record.checkIn ? new Date(record.checkIn).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                  <span className="hidden md:block text-sm text-gray-600">
                    {record.checkOut ? new Date(record.checkOut).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-10 text-center">
          <CalendarCheck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No attendance records this term</p>
        </div>
      )}
    </div>
  );
}

// ─── Leaves Tab ───────────────────────────────────────────────────────────────

const LEAVE_LABELS: Record<LeaveType, string> = {
  SICK_LEAVE: 'Sick Leave',
  PERSONAL_LEAVE: 'Personal Leave',
  MATERNITY_LEAVE: 'Maternity Leave',
  PATERNITY_LEAVE: 'Paternity Leave',
  STUDY_LEAVE: 'Study Leave',
  OTHER: 'Other',
};

function LeavesTab({ leaves }: { leaves: LeaveRequest[] }) {
  const statusConfig: Record<RequestStatus, { label: string; icon: React.ReactNode; cls: string }> = {
    PENDING: { label: 'Pending', icon: <Clock className="w-3 h-3" />, cls: 'bg-warning-50 text-warning-700 border-warning-200' },
    APPROVED: { label: 'Approved', icon: <CheckCircle2 className="w-3 h-3" />, cls: 'bg-success-50 text-success-700 border-success-200' },
    REJECTED: { label: 'Rejected', icon: <XCircle className="w-3 h-3" />, cls: 'bg-danger-50 text-danger-700 border-danger-200' },
  };

  if (leaves.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl py-16 text-center shadow-[var(--shadow-card)]">
        <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        <p className="font-semibold text-gray-600">No leave requests</p>
        <p className="text-sm text-gray-400 mt-1">Leave requests submitted by this teacher will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {leaves.map((leave) => {
        const cfg = statusConfig[leave.status];
        const days = Math.ceil((new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return (
          <div key={leave.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
              <div>
                <p className="font-bold text-gray-900">{LEAVE_LABELS[leave.type]}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {new Date(leave.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' → '}
                  {new Date(leave.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  <span className="ml-2 text-gray-400">({days} day{days !== 1 ? 's' : ''})</span>
                </p>
              </div>
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.cls}`}>
                {cfg.icon} {cfg.label}
              </span>
            </div>
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{leave.reason}</p>
            {leave.adminNote && (
              <p className="text-sm text-gray-600 mt-2 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                <span className="italic">{leave.adminNote}</span>
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
