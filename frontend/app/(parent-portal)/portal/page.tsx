'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronLeft,
  TrendingUp,
} from 'lucide-react';

interface StudentInfo {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  gender: string;
  photo: string | null;
  class: { id: string; name: string; level: string } | null;
}

interface AttendanceRecord {
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
}

interface PortalData {
  student: StudentInfo;
  attendance: {
    rate: number | null;
    recentAbsences: number;
    recentRecords: AttendanceRecord[];
  };
  fees: {
    totalDue: number;
    totalPaid: number;
    balance: number;
    status: 'FULLY_PAID' | 'PARTIAL' | 'UNPAID' | null;
    termName: string | null;
  };
  results: Array<{
    subject: string;
    termId: string;
    term: string;
    totalScore: number | null;
    grade: string | null;
    remarks: string | null;
    position: number | null;
  }>;
  /** Overall class rank per term (by average subject score). */
  classPositionByTerm?: Record<string, { position: number; outOf: number }>;
  latestRemarks: {
    teacherRemarks: string | null;
    headmasterRemarks: string | null;
    term: string;
  } | null;
}

const STATUS_COLOR = {
  PRESENT: 'bg-success-500',
  LATE: 'bg-warning-400',
  ABSENT: 'bg-danger-500',
  EXCUSED: 'bg-gray-300',
};

const GRADE_COLOR: Record<string, string> = {
  A1: 'text-success-600', A2: 'text-success-600', A3: 'text-success-600',
  B2: 'text-success-600', B3: 'text-success-600',
  C4: 'text-warning-600', C5: 'text-warning-600', C6: 'text-warning-600',
  D7: 'text-danger-500', E8: 'text-danger-500', F9: 'text-danger-600',
};

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export default function PortalPage() {
  const router = useRouter();
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchChild = useCallback(async () => {
    const token = getCookie('parentToken');
    const raw = sessionStorage.getItem('portalStudent');

    if (!token || !raw) {
      router.replace('/parent-portal');
      return;
    }

    let studentId: string;
    try {
      studentId = JSON.parse(raw).studentId;
    } catch {
      router.replace('/parent-portal');
      return;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/portal/child/${studentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.status === 401 || res.status === 403) {
        document.cookie = 'parentToken=; path=/; max-age=0';
        router.replace('/parent-portal');
        return;
      }

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load data');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchChild(); }, [fetchChild]);

  const handleSignOut = () => {
    document.cookie = 'parentToken=; path=/; max-age=0';
    sessionStorage.removeItem('portalStudent');
    router.push('/parent-portal');
  };

  const handleSwitchChild = () => {
    sessionStorage.removeItem('portalStudent');
    router.push('/parent-portal');
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        <div className="h-24 bg-gray-200 rounded-2xl" />
        <div className="h-32 bg-gray-200 rounded-2xl" />
        <div className="h-32 bg-gray-200 rounded-2xl" />
        <div className="h-48 bg-gray-200 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
        <AlertCircle className="w-10 h-10 text-danger-500 mx-auto mb-3" />
        <p className="font-semibold text-gray-900 mb-1">Could not load data</p>
        <p className="text-sm text-gray-500 mb-4">{error}</p>
        <button
          onClick={() => { setError(''); setLoading(true); fetchChild(); }}
          className="text-sm text-primary-600 hover:underline font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { student, attendance, fees, results, classPositionByTerm, latestRemarks } = data;

  // Group results by term
  const resultsByTerm = results.reduce<Record<string, typeof results>>((acc, r) => {
    acc[r.term] = acc[r.term] ?? [];
    acc[r.term].push(r);
    return acc;
  }, {});
  const termKeys = Object.keys(resultsByTerm);

  return (
    <div className="flex flex-col gap-4">
      {/* Student card + nav */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-base flex-shrink-0">
          {student.firstName[0]}{student.lastName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 truncate">
            {student.firstName} {student.lastName}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {student.class?.name ?? 'No class'} &middot; {student.studentId}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button
            onClick={handleSwitchChild}
            className="flex items-center gap-1 text-xs text-primary-600 hover:underline font-medium"
          >
            <ChevronLeft className="w-3 h-3" />
            Switch
          </button>
          <button
            onClick={handleSignOut}
            className="text-xs text-gray-400 hover:text-gray-600 font-medium"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Attendance */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className="font-semibold text-sm text-gray-800">Attendance (last 30 days)</span>
        </div>
        <div className="px-4 py-4">
          {attendance.rate !== null ? (
            <div className="flex items-end gap-4">
              <div>
                <p
                  className={`text-4xl font-bold ${
                    attendance.rate >= 80
                      ? 'text-success-600'
                      : attendance.rate >= 60
                      ? 'text-warning-600'
                      : 'text-danger-600'
                  }`}
                >
                  {attendance.rate}%
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {attendance.recentAbsences} absence{attendance.recentAbsences !== 1 ? 's' : ''}
                </p>
              </div>
              {/* Last 7 days dots */}
              {attendance.recentRecords.length > 0 && (
                <div className="flex gap-1.5 pb-1">
                  {attendance.recentRecords.slice(0, 7).map((r, i) => (
                    <div
                      key={i}
                      title={`${new Date(r.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} — ${r.status}`}
                      className={`w-5 h-5 rounded-full ${STATUS_COLOR[r.status] ?? 'bg-gray-200'}`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No attendance records yet</p>
          )}
        </div>
      </div>

      {/* Fees */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-gray-500" />
          <span className="font-semibold text-sm text-gray-800">
            Fees{fees.termName ? ` — ${fees.termName}` : ''}
          </span>
        </div>
        <div className="px-4 py-4">
          {fees.status === null ? (
            <p className="text-sm text-gray-500">No fee records for current term</p>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  {fees.status === 'FULLY_PAID' ? (
                    <CheckCircle2 className="w-5 h-5 text-success-500" />
                  ) : fees.status === 'PARTIAL' ? (
                    <Clock className="w-5 h-5 text-warning-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-danger-500" />
                  )}
                  <span
                    className={`text-sm font-semibold ${
                      fees.status === 'FULLY_PAID'
                        ? 'text-success-600'
                        : fees.status === 'PARTIAL'
                        ? 'text-warning-600'
                        : 'text-danger-600'
                    }`}
                  >
                    {fees.status === 'FULLY_PAID'
                      ? 'Fully Paid'
                      : fees.status === 'PARTIAL'
                      ? 'Partially Paid'
                      : 'Unpaid'}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Paid: GHS {fees.totalPaid.toFixed(2)} / GHS {fees.totalDue.toFixed(2)}
                </p>
              </div>
              {fees.balance > 0 && (
                <div className="text-right">
                  <p className="text-xs text-gray-500">Balance</p>
                  <p className="text-lg font-bold text-danger-600">
                    GHS {fees.balance.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-gray-500" />
          <span className="font-semibold text-sm text-gray-800">Academic Results</span>
        </div>

        {termKeys.length === 0 ? (
          <p className="px-4 py-4 text-sm text-gray-500">No results available yet</p>
        ) : (
          termKeys.map((term) => {
            const firstRow = resultsByTerm[term][0];
            const classPos =
              firstRow?.termId && classPositionByTerm
                ? classPositionByTerm[firstRow.termId]
                : undefined;
            return (
            <div key={term}>
              <div className="px-4 pt-3 pb-1 flex flex-col gap-0.5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {term}
                </p>
                {classPos && (
                  <p className="text-xs text-gray-600">
                    Class position:{' '}
                    <span className="font-semibold text-gray-900">
                      #{classPos.position}
                    </span>{' '}
                    <span className="text-gray-500">of {classPos.outOf}</span>
                  </p>
                )}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-1.5 text-left text-xs font-semibold text-gray-500">Subject</th>
                    <th className="px-4 py-1.5 text-right text-xs font-semibold text-gray-500">Score</th>
                    <th className="px-4 py-1.5 text-right text-xs font-semibold text-gray-500">Grade</th>
                    <th className="px-4 py-1.5 text-right text-xs font-semibold text-gray-500">Pos.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {resultsByTerm[term].map((r, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 text-gray-800 font-medium">{r.subject}</td>
                      <td className="px-4 py-2 text-right text-gray-600">
                        {r.totalScore !== null ? r.totalScore.toFixed(1) : '—'}
                      </td>
                      <td className={`px-4 py-2 text-right font-bold ${r.grade ? (GRADE_COLOR[r.grade] ?? 'text-gray-700') : 'text-gray-400'}`}>
                        {r.grade ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-500 text-xs">
                        {r.position !== null ? `#${r.position}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            );
          })
        )}
      </div>

      {/* Remarks */}
      {latestRemarks && (latestRemarks.teacherRemarks || latestRemarks.headmasterRemarks) && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <span className="font-semibold text-sm text-gray-800">
              Remarks — {latestRemarks.term}
            </span>
          </div>
          <div className="px-4 py-4 flex flex-col gap-3">
            {latestRemarks.teacherRemarks && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                  Class Teacher
                </p>
                <p className="text-sm text-gray-700">{latestRemarks.teacherRemarks}</p>
              </div>
            )}
            {latestRemarks.headmasterRemarks && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                  Headmaster
                </p>
                <p className="text-sm text-gray-700">{latestRemarks.headmasterRemarks}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
