'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Alert, Badge } from '@/components/ui';
import { getGrade } from '@/lib/theme';
import {
  GraduationCap, Calendar, MapPin, Phone, Users,
  CheckCircle2, UserX, Clock, AlertCircle,
  BookOpen, Banknote, UserCheck, TrendingUp,
  ChevronRight, Hash, ExternalLink,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttendanceSummary {
  PRESENT: number;
  ABSENT: number;
  LATE: number;
  EXCUSED: number;
  total: number;
  rate: number | null;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  note: string | null;
  term: { name: string; year: number };
}

interface ResultRecord {
  id: string;
  classScore: number | null;
  examScore: number | null;
  totalScore: number | null;
  grade: string | null;
  position: number | null;
  remarks: string | null;
  subject: { id: string; name: string };
  term: { id: string; name: string; year: number };
}

interface FeePayment {
  id: string;
  amountPaid: number;
  paymentStatus: string;
  paymentMethod: string | null;
  receiptNumber: string | null;
  paidAt: string | null;
  feeStructure: { name: string; amount: number };
  term: { name: string; year: number };
}

interface ParentInfo {
  id: string;
  user: { id: string; firstName: string; lastName: string; phone: string; email: string | null };
  children: Array<{ id: string; studentId: string; firstName: string; lastName: string }>;
}

interface StudentData {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: 'MALE' | 'FEMALE';
  address: string | null;
  isActive: boolean;
  enrolledAt: string;
  parentName: string | null;
  parentPhone: string | null;
  class: {
    id: string;
    name: string;
    level: string;
    classTeacher: { id: string; user: { firstName: string; lastName: string } } | null;
  } | null;
  parent: ParentInfo | null;
  attendances: AttendanceRecord[];
  results: ResultRecord[];
  feePayments: FeePayment[];
  attendanceSummary: AttendanceSummary;
}

type Tab = 'overview' | 'attendance' | 'results' | 'fees';

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function StudentDetail({ studentId }: { studentId: string }) {
  const [student, setStudent] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const fetchStudent = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/students/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Student not found');
      setStudent(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load student');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { fetchStudent(); }, [fetchStudent]);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 md:p-8 max-w-[1200px] mx-auto animate-fade-in space-y-5">
        <div className="h-8 w-32 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (error || !student) return (
    <div className="p-8">
      <Alert type="error" message={error || 'Student not found'} />
    </div>
  );

  const fullName = `${student.firstName} ${student.lastName}`;
  const initials = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`.toUpperCase();
  const age = student.dateOfBirth
    ? Math.floor((Date.now() - new Date(student.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const parentName = student.parent
    ? `${student.parent.user.firstName} ${student.parent.user.lastName}`
    : student.parentName;
  const parentPhone = student.parent?.user.phone ?? student.parentPhone;
  const parentLinked = !!student.parent;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'attendance', label: 'Attendance', count: student.attendances.length },
    { id: 'results', label: 'Results', count: student.results.length },
    { id: 'fees', label: 'Fees', count: student.feePayments.length },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1200px] mx-auto animate-fade-in space-y-5">
      {/* Back */}
      <Link href="/students" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium">
        ← Back to Students
      </Link>

      {/* Profile Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-lg flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{fullName}</h1>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                  student.isActive
                    ? 'bg-success-50 text-success-700 border-success-100'
                    : 'bg-gray-50 text-gray-700 border-gray-200'
                }`}
              >
                {student.isActive ? 'Active' : 'Inactive'}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-gray-50 text-gray-700 border-gray-200">
                {student.gender === 'MALE' ? 'Male' : 'Female'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-500 font-mono mb-3">
              <Hash className="w-3.5 h-3.5" />
              {student.studentId}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-600">
              {age !== null && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {age} years old
                </span>
              )}
              {student.address && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {student.address}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                Enrolled {new Date(student.enrolledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Class chip */}
          {student.class && (
            <Link
              href={`/classes/${student.class.id}`}
              className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 hover:bg-gray-100 transition-colors"
            >
              <GraduationCap className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-xs text-gray-500 font-medium">Class</p>
                <p className="text-sm font-bold text-gray-900">{student.class.name}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </Link>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5 text-success-600" />}
          label="Attendance Rate"
          value={student.attendanceSummary.rate !== null ? `${student.attendanceSummary.rate}%` : '—'}
          sub={`${student.attendanceSummary.PRESENT} present of ${student.attendanceSummary.total} days`}
          colorClass="bg-success-50"
          highlight={student.attendanceSummary.rate !== null ? (student.attendanceSummary.rate >= 80 ? 'success' : 'danger') : undefined}
        />
        <StatCard
          icon={<BookOpen className="w-5 h-5 text-info-600" />}
          label="Subjects"
          value={String(new Set(student.results.map((r) => r.subject.id)).size)}
          sub={`${student.results.length} result record${student.results.length !== 1 ? 's' : ''}`}
          colorClass="bg-blue-50"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-primary-600" />}
          label="Avg Score"
          value={(() => {
            const scores = student.results.filter(r => r.totalScore !== null).map(r => r.totalScore as number);
            return scores.length > 0 ? `${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}%` : '—';
          })()}
          sub="Across all subjects"
          colorClass="bg-primary-50"
        />
        <StatCard
          icon={<Banknote className="w-5 h-5 text-warning-600" />}
          label="Fee Balance"
          value={(() => {
            const unpaid = student.feePayments.filter(f => f.paymentStatus !== 'FULLY_PAID');
            if (unpaid.length === 0) return 'Paid';
            const bal = unpaid.reduce((s, f) => s + (f.feeStructure.amount - f.amountPaid), 0);
            return `GHS ${bal.toLocaleString()}`;
          })()}
          sub={student.feePayments.length === 0 ? 'No fee records' : `${student.feePayments.length} payment record${student.feePayments.length !== 1 ? 's' : ''}`}
          colorClass="bg-warning-50"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && <OverviewTab student={student} parentName={parentName} parentPhone={parentPhone} parentLinked={parentLinked} age={age} />}
      {activeTab === 'attendance' && <AttendanceTab attendances={student.attendances} summary={student.attendanceSummary} />}
      {activeTab === 'results' && <ResultsTab results={student.results} />}
      {activeTab === 'fees' && <FeesTab payments={student.feePayments} />}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, sub, colorClass, highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  colorClass: string;
  highlight?: 'success' | 'danger';
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className={`w-9 h-9 ${colorClass} rounded-xl flex items-center justify-center mb-3`}>{icon}</div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-bold ${highlight === 'success' ? 'text-success-700' : highlight === 'danger' ? 'text-danger-700' : 'text-gray-900'}`}>
        {value}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  student, parentName, parentPhone, parentLinked, age,
}: {
  student: StudentData;
  parentName: string | null | undefined;
  parentPhone: string | null | undefined;
  parentLinked: boolean;
  age: number | null;
}) {
  return (
    <div className="grid md:grid-cols-2 gap-5">
      {/* Personal Info */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-gray-400" /> Personal Details
        </h3>
        <dl className="space-y-3">
          {student.dateOfBirth && (
            <InfoRow icon={<Calendar className="w-4 h-4" />} label="Date of Birth"
              value={`${new Date(student.dateOfBirth).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} (Age ${age})`}
            />
          )}
          <InfoRow icon={<Users className="w-4 h-4" />} label="Gender"
            value={student.gender === 'MALE' ? 'Male' : 'Female'}
          />
          {student.address && (
            <InfoRow icon={<MapPin className="w-4 h-4" />} label="Address" value={student.address} />
          )}
          {student.class && (
            <InfoRow icon={<GraduationCap className="w-4 h-4" />} label="Class">
              <Link href={`/classes/${student.class.id}`} className="font-semibold text-gray-900 hover:underline flex items-center gap-1">
                {student.class.name}
                <ExternalLink className="w-3 h-3" />
              </Link>
            </InfoRow>
          )}
          {student.class?.classTeacher && (
            <InfoRow icon={<UserCheck className="w-4 h-4" />} label="Class Teacher">
              <Link href={`/teachers/${student.class.classTeacher.id}`} className="font-semibold text-gray-900 hover:underline flex items-center gap-1">
                {student.class.classTeacher.user.firstName} {student.class.classTeacher.user.lastName}
                <ExternalLink className="w-3 h-3" />
              </Link>
            </InfoRow>
          )}
        </dl>
      </div>

      {/* Guardian / Parent */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" /> Guardian / Parent
          </h3>
          {parentLinked && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-success-50 border border-success-100 text-success-700 text-xs font-semibold rounded-full">
              <CheckCircle2 className="w-3 h-3" /> Portal account linked
            </span>
          )}
        </div>
        {parentName || parentPhone ? (
          <dl className="space-y-3">
            {parentName && (
              <InfoRow icon={<Users className="w-4 h-4" />} label="Name">
                {parentLinked && student.parent ? (
                  <Link href={`/parents/${student.parent.id}`} className="font-semibold text-gray-900 hover:underline flex items-center gap-1">
                    {parentName} <ExternalLink className="w-3 h-3" />
                  </Link>
                ) : (
                  <span className="font-semibold text-gray-900">{parentName}</span>
                )}
              </InfoRow>
            )}
            {parentPhone && (
              <InfoRow icon={<Phone className="w-4 h-4" />} label="Phone">
                <a href={`tel:${parentPhone}`} className="font-semibold text-gray-900 hover:underline">
                  {parentPhone}
                </a>
              </InfoRow>
            )}
            {parentLinked && student.parent && student.parent.children.length > 1 && (
              <InfoRow icon={<Users className="w-4 h-4" />} label="Siblings">
                <div className="flex flex-wrap gap-1.5">
                  {student.parent.children
                    .filter((c) => c.id !== student.id)
                    .map((sib) => (
                      <Link
                        key={sib.id}
                        href={`/students/${sib.id}`}
                        className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-full transition-colors"
                      >
                        {sib.firstName} {sib.lastName}
                      </Link>
                    ))}
                </div>
              </InfoRow>
            )}
          </dl>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="w-8 h-8 text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">No guardian info recorded</p>
          </div>
        )}
      </div>

      {/* Quick Attendance Summary */}
      {student.attendanceSummary.total > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm md:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">Attendance Summary (Last 30 Records)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {([
              { label: 'Present', key: 'PRESENT', icon: <UserCheck className="w-4 h-4" />, bg: 'bg-success-50', text: 'text-success-700' },
              { label: 'Absent', key: 'ABSENT', icon: <UserX className="w-4 h-4" />, bg: 'bg-danger-50', text: 'text-danger-700' },
              { label: 'Late', key: 'LATE', icon: <Clock className="w-4 h-4" />, bg: 'bg-warning-50', text: 'text-warning-700' },
              { label: 'Excused', key: 'EXCUSED', icon: <CheckCircle2 className="w-4 h-4" />, bg: 'bg-blue-50', text: 'text-blue-700' },
            ] as const).map(({ label, key, icon, bg, text }) => (
              <div key={label} className={`flex flex-col items-center gap-1 p-3 rounded-xl ${bg}`}>
                <div className={text}>{icon}</div>
                <p className={`text-xl font-bold ${text}`}>{student.attendanceSummary[key]}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-3 rounded-full ${(student.attendanceSummary.rate ?? 0) >= 80 ? 'bg-success-500' : (student.attendanceSummary.rate ?? 0) >= 60 ? 'bg-warning-500' : 'bg-danger-500'}`}
                style={{ width: `${student.attendanceSummary.rate ?? 0}%` }}
              />
            </div>
            <span className={`text-sm font-bold ${(student.attendanceSummary.rate ?? 0) >= 80 ? 'text-success-700' : 'text-danger-700'}`}>
              {student.attendanceSummary.rate ?? 0}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon, label, value, children,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        {children ?? <p className="text-sm font-semibold text-gray-900">{value}</p>}
      </div>
    </div>
  );
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  PRESENT: { label: 'Present', bg: 'bg-success-50', text: 'text-success-700', border: 'border-success-200' },
  ABSENT: { label: 'Absent', bg: 'bg-danger-50', text: 'text-danger-700', border: 'border-danger-200' },
  LATE: { label: 'Late', bg: 'bg-warning-50', text: 'text-warning-700', border: 'border-warning-200' },
  EXCUSED: { label: 'Excused', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
};

function AttendanceTab({
  attendances,
  summary,
}: {
  attendances: AttendanceRecord[];
  summary: AttendanceSummary;
}) {
  if (attendances.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl py-14 text-center shadow-sm">
        <AlertCircle className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-500">No attendance records yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Rate bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Attendance Rate</h3>
          <span className={`text-2xl font-bold ${(summary.rate ?? 0) >= 80 ? 'text-success-700' : 'text-danger-700'}`}>
            {summary.rate ?? 0}%
          </span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-4">
          <div
            className={`h-3 rounded-full ${(summary.rate ?? 0) >= 80 ? 'bg-success-500' : (summary.rate ?? 0) >= 60 ? 'bg-warning-500' : 'bg-danger-500'}`}
            style={{ width: `${summary.rate ?? 0}%` }}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <div key={key} className={`text-center p-3 rounded-xl ${cfg.bg}`}>
              <p className={`text-xl font-bold ${cfg.text}`}>{summary[key as keyof AttendanceSummary] as number}</p>
              <p className="text-xs text-gray-500">{cfg.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Records table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider">Recent Records</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {attendances.map((a) => {
            const cfg = STATUS_CONFIG[a.status];
            return (
              <div key={a.id} className="flex items-center justify-between px-6 py-3.5">
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-gray-900">
                    {new Date(a.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {a.note && <p className="text-xs text-gray-400 italic">{a.note}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{a.term.name} {a.term.year}</span>
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Results Tab ──────────────────────────────────────────────────────────────

function ResultsTab({ results }: { results: ResultRecord[] }) {
  if (results.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl py-14 text-center shadow-sm">
        <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-500">No results recorded yet</p>
      </div>
    );
  }

  // Group by term
  const byTerm: Record<string, ResultRecord[]> = {};
  results.forEach((r) => {
    const key = `${r.term.name} ${r.term.year}`;
    if (!byTerm[key]) byTerm[key] = [];
    byTerm[key].push(r);
  });

  return (
    <div className="space-y-5">
      {Object.entries(byTerm).map(([termLabel, termResults]) => {
        const scores = termResults.filter(r => r.totalScore !== null).map(r => r.totalScore as number);
        const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
        return (
          <div key={termLabel} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">{termLabel}</h3>
              {avg !== null && (
                <ScoreBadge score={avg} large />
              )}
            </div>
            <div className="divide-y divide-gray-100">
              {termResults.map((r) => (
                <div key={r.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center px-6 py-3.5">
                  <span className="text-sm font-semibold text-gray-900">{r.subject.name}</span>
                  <span className="text-xs text-gray-500">
                    <span className="font-medium text-gray-700">{r.classScore ?? '—'}</span>
                    <span className="text-gray-400">/30</span>
                  </span>
                  <span className="text-xs text-gray-500">
                    <span className="font-medium text-gray-700">{r.examScore ?? '—'}</span>
                    <span className="text-gray-400">/70</span>
                  </span>
                  <span className="text-sm font-bold text-gray-900">
                    {r.totalScore !== null ? `${r.totalScore}%` : '—'}
                  </span>
                  {r.totalScore !== null ? (
                    <ScoreBadge score={r.totalScore} />
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
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

// ─── Fees Tab ─────────────────────────────────────────────────────────────────

const FEE_STATUS_CONFIG = {
  FULLY_PAID: { label: 'Fully Paid', variant: 'success' as const },
  HALF_PAID: { label: 'Half Paid', variant: 'warning' as const },
  PARTIAL: { label: 'Partial', variant: 'warning' as const },
  UNPAID: { label: 'Unpaid', variant: 'error' as const },
};

function FeesTab({ payments }: { payments: FeePayment[] }) {
  if (payments.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl py-14 text-center shadow-sm">
        <Banknote className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-500">No fee records</p>
      </div>
    );
  }

  const totalDue = payments.reduce((s, f) => s + f.feeStructure.amount, 0);
  const totalPaid = payments.reduce((s, f) => s + f.amountPaid, 0);
  const balance = totalDue - totalPaid;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Due', value: `GHS ${totalDue.toLocaleString()}`, color: 'text-gray-900' },
          { label: 'Total Paid', value: `GHS ${totalPaid.toLocaleString()}`, color: 'text-success-700' },
          { label: 'Balance', value: balance > 0 ? `GHS ${balance.toLocaleString()}` : 'Cleared', color: balance > 0 ? 'text-danger-700' : 'text-success-700' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm text-center">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Payment records */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
          <span>Fee</span>
          <span>Term</span>
          <span>Amount Due</span>
          <span>Paid</span>
          <span>Status</span>
        </div>
        <div className="divide-y divide-gray-100">
          {payments.map((p) => {
            const cfg = FEE_STATUS_CONFIG[p.paymentStatus as keyof typeof FEE_STATUS_CONFIG] ?? { label: p.paymentStatus, variant: 'default' as const };
            return (
              <div key={p.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 items-center px-6 py-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{p.feeStructure.name}</p>
                  {p.receiptNumber && <p className="text-xs text-gray-400 font-mono">#{p.receiptNumber}</p>}
                </div>
                <span className="text-sm text-gray-600">{p.term.name} {p.term.year}</span>
                <span className="text-sm font-medium text-gray-700">GHS {p.feeStructure.amount.toLocaleString()}</span>
                <span className="text-sm font-bold text-gray-900">GHS {p.amountPaid.toLocaleString()}</span>
                <Badge variant={cfg.variant}>{cfg.label}</Badge>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Score Badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score, large }: { score: number; large?: boolean }) {
  const grade = getGrade(score);
  const cls =
    score >= 70 ? 'bg-success-50 text-success-700 border-success-200'
    : score >= 50 ? 'bg-warning-50 text-warning-700 border-warning-200'
    : 'bg-danger-50 text-danger-700 border-danger-200';

  return (
    <span className={`inline-flex items-center gap-1 border font-bold rounded-full ${large ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'} ${cls}`}>
      {score}% <span className="opacity-60">{grade.grade}</span>
    </span>
  );
}
