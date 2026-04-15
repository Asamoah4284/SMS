'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Alert, Badge, Button, Modal } from '@/components/ui';
import { getGrade, classLevelLabels } from '@/lib/theme';
import { useUser } from '@/lib/UserContext';
import {
  GraduationCap, Calendar, MapPin, Phone, Users,
  CheckCircle2, UserX, Clock, AlertCircle,
  BookOpen, Banknote, UserCheck, TrendingUp,
  ChevronRight, Hash, ExternalLink, Plus, Loader2, Save, Trash2,
  ImageIcon, FileImage, Pencil, Briefcase,
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
  feeStructure: { id: string; name: string; amount: number };
  term: { id: string; name: string; year: number };
}

interface ParentInfo {
  id: string;
  homeAddress: string | null;
  occupation: string | null;
  user: { id: string; firstName: string; lastName: string; phone: string; email: string | null };
  children: Array<{ id: string; studentId: string; firstName: string; lastName: string }>;
}

/** Overall class rank for a term (by average subject score among classmates). */
type ClassPositionEntry = { position: number; outOf: number };

interface StudentData {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: 'MALE' | 'FEMALE';
  address: string | null;
  photo: string | null;
  healthInsuranceCard: string | null;
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
  /** Maps term id → class rank for that term */
  classPositionByTerm?: Record<string, ClassPositionEntry>;
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
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
          <div className="flex gap-4 min-w-0 flex-1">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-lg sm:text-xl shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 break-words [overflow-wrap:anywhere] leading-snug">
                  {fullName}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-2">
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
              </div>
              <div className="flex items-start gap-1.5 text-sm text-gray-500 font-mono">
                <Hash className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="break-all">{student.studentId}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-x-4 gap-y-2 text-sm text-gray-600">
                {age !== null && (
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                    {age} years old
                  </span>
                )}
                {student.address && (
                  <span className="flex items-start gap-1.5 min-w-0">
                    <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <span className="break-words">{student.address}</span>
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-xs text-gray-400">
                  Enrolled{' '}
                  {new Date(student.enrolledAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Class chip — full width on small screens, fixed block on large */}
          {student.class && (
            <Link
              href={`/classes/${student.class.id}`}
              className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 hover:bg-gray-100 transition-colors w-full lg:w-auto lg:min-w-[220px] lg:max-w-[280px] shrink-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <GraduationCap className="w-5 h-5 text-gray-500 shrink-0" />
                <div className="min-w-0 text-left">
                  <p className="text-xs text-gray-500 font-medium">Class</p>
                  <p className="text-sm sm:text-base font-bold text-gray-900 truncate">{student.class.name}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
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
            return `GHS ${bal.toLocaleString('en-GB')}`;
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

      {activeTab === 'overview' && (
        <OverviewTab
          student={student}
          parentName={parentName}
          parentPhone={parentPhone}
          parentLinked={parentLinked}
          age={age}
          onRefresh={fetchStudent}
        />
      )}
      {activeTab === 'attendance' && <AttendanceTab attendances={student.attendances} summary={student.attendanceSummary} />}
      {activeTab === 'results' && (
        <ResultsTab results={student.results} classPositionByTerm={student.classPositionByTerm} />
      )}
      {activeTab === 'fees' && (
        <FeesTab
          payments={student.feePayments}
          studentId={student.id}
          classLevel={student.class?.level ?? null}
          classNameLabel={student.class?.name ?? null}
          onPaymentRecorded={fetchStudent}
        />
      )}
    </div>
  );
}

function StudentDocumentsForm({
  studentId,
  initial,
  onSaved,
  onCancel,
}: {
  studentId: string;
  initial: { photo: string; healthInsuranceCard: string };
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [photo, setPhoto] = useState(initial.photo);
  const [healthInsuranceCard, setHealthInsuranceCard] = useState(initial.healthInsuranceCard);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/students/${studentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ photo, healthInsuranceCard }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Save failed');
      onSaved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-gray-500">
        Paste a hosted image URL (e.g. from your school storage or CDN). Same for the insurance card image/PDF link.
      </p>
      {err && <Alert type="error" message={err} onDismiss={() => setErr('')} />}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Image of the child (URL)</label>
        <input
          value={photo}
          onChange={(e) => setPhoto(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500"
          placeholder="https://…"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Health insurance card (URL)</label>
        <input
          value={healthInsuranceCard}
          onChange={(e) => setHealthInsuranceCard(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500"
          placeholder="https://…"
        />
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="submit" loading={saving}>Save</Button>
      </div>
    </form>
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
  student, parentName, parentPhone, parentLinked, age, onRefresh,
}: {
  student: StudentData;
  parentName: string | null | undefined;
  parentPhone: string | null | undefined;
  parentLinked: boolean;
  age: number | null;
  onRefresh: () => void;
}) {
  const { isAdmin } = useUser();
  const [docModal, setDocModal] = useState(false);

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
            {parentLinked && student.parent && (student.parent.homeAddress || student.parent.occupation) && (
              <>
                {student.parent.homeAddress && (
                  <InfoRow icon={<MapPin className="w-4 h-4" />} label="Parent home address" value={student.parent.homeAddress} />
                )}
                {student.parent.occupation && (
                  <InfoRow icon={<Briefcase className="w-4 h-4" />} label="Parent occupation" value={student.parent.occupation} />
                )}
              </>
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

      {/* Child photo & insurance documents */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm md:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-gray-400" /> Child photo & documents
          </h3>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setDocModal(true)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700"
            >
              <Pencil className="w-4 h-4" /> Edit
            </button>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-8">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Image of the child</p>
            {student.photo ? (
              <div className="relative w-36 h-36 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                <Image
                  src={student.photo}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="144px"
                  unoptimized={/^https?:\/\//i.test(student.photo)}
                />
              </div>
            ) : (
              <p className="text-sm text-gray-400">No image URL set</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <FileImage className="w-3.5 h-3.5" /> Health insurance card
            </p>
            {student.healthInsuranceCard ? (
              <a
                href={student.healthInsuranceCard}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-primary-600 hover:underline break-all"
              >
                Open link
              </a>
            ) : (
              <p className="text-sm text-gray-400">No scan or URL set</p>
            )}
          </div>
        </div>
      </div>

      {isAdmin && (
        <Modal isOpen={docModal} onClose={() => setDocModal(false)} title="Edit child photo & documents" size="md">
          <StudentDocumentsForm
            studentId={student.id}
            initial={{ photo: student.photo ?? '', healthInsuranceCard: student.healthInsuranceCard ?? '' }}
            onSaved={() => { setDocModal(false); onRefresh(); }}
            onCancel={() => setDocModal(false)}
          />
        </Modal>
      )}

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

function ResultsTab({
  results,
  classPositionByTerm,
}: {
  results: ResultRecord[];
  classPositionByTerm?: Record<string, ClassPositionEntry>;
}) {
  if (results.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl py-14 text-center shadow-sm">
        <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-500">No results recorded yet</p>
      </div>
    );
  }

  // Group by term (label → rows; keep first row for term id)
  const byTerm: Record<string, { rows: ResultRecord[]; termId: string }> = {};
  results.forEach((r) => {
    const key = `${r.term.name} ${r.term.year}`;
    if (!byTerm[key]) {
      byTerm[key] = { rows: [], termId: r.term.id };
    }
    byTerm[key].rows.push(r);
  });

  return (
    <div className="space-y-5">
      {Object.entries(byTerm).map(([termLabel, { rows: termResults, termId }]) => {
        const scores = termResults.filter(r => r.totalScore !== null).map(r => r.totalScore as number);
        const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
        const classPos = classPositionByTerm?.[termId];
        return (
          <div key={termLabel} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 sm:px-6 py-4 bg-gray-50 border-b border-gray-200 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0 space-y-1">
                <h3 className="font-bold text-gray-900 text-base sm:text-lg break-words pr-1">{termLabel}</h3>
                {classPos && (
                  <p className="text-sm text-gray-600">
                    <span className="text-gray-500">Class position:</span>{' '}
                    <span className="font-semibold text-gray-900 tabular-nums">
                      #{classPos.position}
                    </span>
                    <span className="text-gray-500"> of {classPos.outOf}</span>
                    <span className="text-gray-400 text-xs ml-1">(by average score)</span>
                  </p>
                )}
              </div>
              {avg !== null && (
                <div className="shrink-0 self-start sm:self-center max-w-full">
                  <ScoreBadge score={avg} large />
                </div>
              )}
            </div>
            <div className="divide-y divide-gray-100">
              {termResults.map((r) => (
                <div key={r.id} className="px-4 sm:px-6 py-4 sm:py-3.5">
                  {/* Mobile / narrow: stacked card row */}
                  <div className="md:hidden space-y-3 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-snug break-words [overflow-wrap:anywhere]">
                      {r.subject.name}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-gray-50 px-2 py-2 border border-gray-100">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Class</p>
                        <p className="font-semibold text-gray-800 tabular-nums">
                          {r.classScore ?? '—'}<span className="text-gray-400 font-normal">/30</span>
                        </p>
                      </div>
                      <div className="rounded-lg bg-gray-50 px-2 py-2 border border-gray-100">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Exam</p>
                        <p className="font-semibold text-gray-800 tabular-nums">
                          {r.examScore ?? '—'}<span className="text-gray-400 font-normal">/70</span>
                        </p>
                      </div>
                      <div className="rounded-lg bg-gray-50 px-2 py-2 border border-gray-100">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Total</p>
                        <p className="font-bold text-gray-900 tabular-nums">
                          {r.totalScore !== null ? `${r.totalScore}%` : '—'}
                        </p>
                      </div>
                      <div className="rounded-lg bg-gray-50 px-2 py-2 border border-gray-100" title="Position in class for this subject">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Pos.</p>
                        <p className="font-bold text-primary-800 tabular-nums">
                          {r.position !== null ? `#${r.position}` : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-start pt-0.5">
                      {r.totalScore !== null ? (
                        <ScoreBadge score={r.totalScore} />
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </div>
                  </div>
                  {/* md+: table-style row */}
                  <div className="hidden md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.75fr)_auto] md:gap-3 lg:gap-4 md:items-center min-w-0">
                    <span className="text-sm font-semibold text-gray-900 min-w-0 break-words">{r.subject.name}</span>
                    <span className="text-xs text-gray-500 tabular-nums">
                      <span className="font-medium text-gray-700">{r.classScore ?? '—'}</span>
                      <span className="text-gray-400">/30</span>
                    </span>
                    <span className="text-xs text-gray-500 tabular-nums">
                      <span className="font-medium text-gray-700">{r.examScore ?? '—'}</span>
                      <span className="text-gray-400">/70</span>
                    </span>
                    <span className="text-sm font-bold text-gray-900 tabular-nums">
                      {r.totalScore !== null ? `${r.totalScore}%` : '—'}
                    </span>
                    <span
                      className="text-sm font-semibold text-primary-800 tabular-nums text-center"
                      title="Position in class for this subject"
                    >
                      {r.position !== null ? `#${r.position}` : '—'}
                    </span>
                    <div className="justify-self-end shrink-0">
                      {r.totalScore !== null ? (
                        <ScoreBadge score={r.totalScore} />
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </div>
                  </div>
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

/** Fees that apply to this student: their class level, or school-wide (no level — e.g. feeding, maintenance). */
function filterFeesForStudent<T extends { classLevel: string | null }>(structures: T[], classLevel: string | null): T[] {
  if (!classLevel) return structures;
  return structures.filter((s) => s.classLevel === null || s.classLevel === classLevel);
}

/** Prefer TUITION for this class level; else first fee scoped to this level (within applicable list). */
function pickFeeStructureForClass(
  structures: Array<{ id: string; category?: string; classLevel: string | null; amount: number }>,
  classLevel: string | null,
) {
  if (!classLevel) return null;
  const tuition = structures.find((s) => s.category === 'TUITION' && s.classLevel === classLevel);
  if (tuition) return tuition;
  return structures.find((s) => s.classLevel === classLevel) ?? null;
}

/** One line’s due amount per (fee structure, term); partial payments share the same line. */
function totalDueUniqueLines(payments: FeePayment[]): number {
  const seen = new Map<string, number>();
  for (const p of payments) {
    const key = `${p.feeStructure.id}-${p.term.id}`;
    if (!seen.has(key)) seen.set(key, p.feeStructure.amount);
  }
  let s = 0;
  for (const v of seen.values()) s += v;
  return s;
}

function sumPaidForFeeLine(
  payments: FeePayment[],
  feeStructureId: string,
  termId: string,
): number {
  return payments
    .filter((p) => p.feeStructure.id === feeStructureId && p.term.id === termId)
    .reduce((s, p) => s + p.amountPaid, 0);
}

function FeesTab({ payments, studentId, classLevel, classNameLabel, onPaymentRecorded }: {
  payments: FeePayment[];
  studentId: string;
  classLevel: string | null;
  classNameLabel: string | null;
  onPaymentRecorded: () => void;
}) {
  const { isAdmin } = useUser();
  const [paymentOpen, setPaymentOpen] = useState(false);

  const totalDue = useMemo(() => totalDueUniqueLines(payments), [payments]);
  const totalPaid = payments.reduce((s, f) => s + f.amountPaid, 0);
  const balance = Math.max(0, totalDue - totalPaid);

  const handleDelete = async (id: string) => {
    if (!confirm('Reverse this payment?')) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/fees/payments/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) onPaymentRecorded();
    else alert('Failed to reverse payment');
  };

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Due', value: `GHS ${totalDue.toLocaleString('en-GB')}`, color: 'text-gray-900' },
          { label: 'Total Paid', value: `GHS ${totalPaid.toLocaleString('en-GB')}`, color: 'text-success-700' },
          { label: 'Balance', value: balance > 0 ? `GHS ${balance.toLocaleString('en-GB')}` : 'Cleared', color: balance > 0 ? 'text-danger-700' : 'text-success-700' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm text-center">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      {isAdmin && (
        <div className="flex justify-end">
          <Button variant="primary" size="sm" onClick={() => setPaymentOpen(true)}>
            <Plus size={14} className="mr-1" />Record Payment
          </Button>
        </div>
      )}

      {/* Payment records */}
      {payments.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl py-14 text-center shadow-sm">
          <Banknote className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500">No payment records yet</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3">
            <span>Fee</span><span>Term</span><span>Paid</span><span>Method</span><span></span>
          </div>
          <div className="divide-y divide-gray-100">
            {payments.map((p) => (
              <div key={p.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 items-center px-5 py-3.5">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{p.feeStructure.name}</p>
                  {p.receiptNumber && <p className="text-xs text-gray-400 font-mono">#{p.receiptNumber}</p>}
                </div>
                <span className="text-sm text-gray-600">{p.term.name} {p.term.year}</span>
                <span className="text-sm font-bold text-gray-900">GHS {p.amountPaid.toLocaleString('en-GB')}</span>
                <span className="text-sm text-gray-500 capitalize">{p.paymentMethod ?? '—'}</span>
                {isAdmin && (
                  <button onClick={() => handleDelete(p.id)}
                    className="p-1 text-gray-300 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {paymentOpen && (
        <StudentPaymentModal
          studentId={studentId}
          payments={payments}
          classLevel={classLevel}
          classNameLabel={classNameLabel}
          onClose={() => setPaymentOpen(false)}
          onSaved={() => { setPaymentOpen(false); onPaymentRecorded(); }}
        />
      )}
    </div>
  );
}

function StudentPaymentModal({ studentId, payments, classLevel, classNameLabel, onClose, onSaved }: {
  studentId: string;
  payments: FeePayment[];
  classLevel: string | null;
  classNameLabel: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const API = process.env.NEXT_PUBLIC_API_URL;
  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';

  type StructureRow = { id: string; name: string; amount: number; classLevel: string | null; category?: string };

  const [structures, setStructures] = useState<StructureRow[]>([]);
  const [terms, setTerms] = useState<Array<{ id: string; name: string; year: number; isCurrent: boolean }>>([]);
  const [form, setForm] = useState({
    feeStructureId: '', termId: '', amountPaid: '',
    paymentMethod: 'Cash', receiptNumber: '',
    paidAt: new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getToken();
    fetch(`${API}/terms`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((td) => {
        const termList = td.terms ?? [];
        setTerms(termList);
        const cur = termList.find((t: { isCurrent: boolean }) => t.isCurrent) ?? termList[0];
        if (cur) setForm((f) => ({ ...f, termId: cur.id }));
      })
      .catch(() => {});
  }, [API]);

  useEffect(() => {
    if (!form.termId) return;
    const termId = form.termId;
    const token = getToken();
    let cancelled = false;
    fetch(`${API}/fees/structures?termId=${encodeURIComponent(termId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((sd) => {
        if (cancelled) return;
        const list: StructureRow[] = sd.structures ?? [];
        setStructures(list);
        const applicable = filterFeesForStudent(list, classLevel);
        const picked = pickFeeStructureForClass(applicable, classLevel);
        const due = picked?.amount ?? 0;
        const paidSoFar = picked
          ? sumPaidForFeeLine(payments, picked.id, termId)
          : 0;
        const rem = Math.max(0, due - paidSoFar);
        setForm((f) => ({
          ...f,
          feeStructureId: picked?.id ?? '',
          amountPaid: picked && rem > 0 ? String(rem) : '',
        }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [API, form.termId, classLevel, payments]);

  const applicableStructures = useMemo(
    () => filterFeesForStudent(structures, classLevel),
    [structures, classLevel],
  );

  const selectedStructure = applicableStructures.find((s) => s.id === form.feeStructureId)
    ?? structures.find((s) => s.id === form.feeStructureId);
  const levelHint = classLevel
    ? (classLevelLabels[classLevel] ?? classNameLabel ?? classLevel)
    : null;

  const paidForSelection = form.feeStructureId && form.termId
    ? sumPaidForFeeLine(payments, form.feeStructureId, form.termId)
    : 0;
  const dueForLine = selectedStructure?.amount ?? 0;
  const remainingForLine = Math.max(0, dueForLine - paidForSelection);

  const parseAmount = (raw: string) => {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : NaN;
  };

  const amountError = (() => {
    if (!form.amountPaid.trim()) return '';
    const n = parseAmount(form.amountPaid);
    if (!Number.isFinite(n) || n <= 0) return 'Enter a valid positive amount';
    if (n > remainingForLine + 1e-6) {
      return `Amount cannot exceed remaining GHS ${remainingForLine.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} for this fee and term`;
    }
    return '';
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const amt = parseAmount(form.amountPaid);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid positive amount');
      return;
    }
    if (amt > remainingForLine + 1e-6) {
      setError(
        `Amount exceeds remaining balance of GHS ${remainingForLine.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} for this fee line.`,
      );
      return;
    }
    if (!form.feeStructureId || !form.termId || remainingForLine <= 1e-6) {
      setError(remainingForLine <= 1e-6 ? 'This fee line is already fully paid for the selected term.' : 'Select a fee and term');
      return;
    }
    setSaving(true); setError('');
    const token = getToken();
    const res = await fetch(`${API}/fees/payments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, ...form, amountPaid: parseFloat(form.amountPaid) }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(typeof data.message === 'string' ? data.message : 'Could not record payment'); return; }
    onSaved();
  };

  return (
    <Modal isOpen title="Record Payment" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert type="error" message={error} />}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fee item *</label>
          {levelHint && (
            <p className="text-xs text-gray-500 mb-1.5">
              Only fees for <strong>{levelHint}</strong> and school-wide items (feeding, etc.). Other class levels are hidden.
            </p>
          )}
          {!classLevel && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5 mb-1.5">
              This student has no class assigned — all fee items for this term are shown.
            </p>
          )}
          {classLevel && applicableStructures.length === 0 && structures.length > 0 && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5 mb-1.5">
              No fee items match this class for the selected term. Add fees under <strong>Fees → Fee items</strong> for this level or as school-wide.
            </p>
          )}
          <select required
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            value={form.feeStructureId}
            onChange={(e) => {
              const id = e.target.value;
              const s = applicableStructures.find((x) => x.id === id);
              const paid = form.termId ? sumPaidForFeeLine(payments, id, form.termId) : 0;
              const rem = s ? Math.max(0, s.amount - paid) : 0;
              setForm({
                ...form,
                feeStructureId: id,
                amountPaid: s && rem > 0 ? String(rem) : '',
              });
            }}
          >
            <option value="">Select fee item...</option>
            {applicableStructures.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.category && s.category !== 'TUITION' ? ` [${s.category}]` : ''}
                {' — '}GHS {s.amount.toLocaleString('en-GB')}
                {s.classLevel ? ` · ${classLevelLabels[s.classLevel] ?? s.classLevel}` : ' · School-wide'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Term *</label>
          <select required
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            value={form.termId}
            onChange={(e) => setForm({ ...form, termId: e.target.value })}
          >
            <option value="">Select term...</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>{t.name} {t.year}{t.isCurrent ? ' ★' : ''}</option>
            ))}
          </select>
        </div>
        {form.feeStructureId && form.termId && selectedStructure && (
          <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between text-gray-600">
              <span>Due for this fee line</span>
              <span className="font-semibold tabular-nums">GHS {dueForLine.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Already recorded</span>
              <span className="font-semibold text-success-700 tabular-nums">GHS {paidForSelection.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-200 pt-2">
              <span>Remaining</span>
              <span className={remainingForLine <= 1e-6 ? 'text-success-700' : 'text-danger-600 tabular-nums'}>
                GHS {remainingForLine.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (GHS) *</label>
            <input type="number" min="0.01" step="0.01" required
              max={remainingForLine > 0 ? remainingForLine : undefined}
              className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 ${amountError ? 'border-danger-400' : 'border-gray-200'}`}
              placeholder={selectedStructure ? String(selectedStructure.amount) : '0.00'}
              value={form.amountPaid}
              onChange={(e) => setForm({ ...form, amountPaid: e.target.value })}
            />
            {amountError && <p className="text-xs text-danger-600 mt-1">{amountError}</p>}
            {remainingForLine <= 1e-6 && form.feeStructureId && form.termId && (
              <p className="text-xs text-success-700 mt-1">This fee line is fully paid for this term.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input type="date"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              value={form.paidAt} onChange={(e) => setForm({ ...form, paidAt: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            >
              <option>Cash</option><option>MoMo</option><option>Bank</option><option>Cheque</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Number</label>
            <input type="text"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="e.g. RCT-001"
              value={form.receiptNumber} onChange={(e) => setForm({ ...form, receiptNumber: e.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            type="submit"
            disabled={saving || !!amountError || remainingForLine <= 1e-6 || !form.feeStructureId || !form.termId}
          >
            {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
            Record
          </Button>
        </div>
      </form>
    </Modal>
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
    <span
      className={`inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 border font-bold rounded-full max-w-full ${large ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'} ${cls}`}
    >
      <span className="tabular-nums whitespace-nowrap">{score}%</span>
      <span className="opacity-60 whitespace-nowrap">{grade.grade}</span>
    </span>
  );
}
