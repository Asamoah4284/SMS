'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useUser } from '@/lib/UserContext';
import {
  GraduationCap, CalendarCheck, FileText, ClipboardList,
  Users, CheckCircle2, Clock, ArrowRight, BookOpen,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL;

interface MyClassStats {
  classTeacherOf: {
    id: string;
    name: string;
    level: string;
    totalStudents: number;
    male: number;
    female: number;
    attendanceToday: {
      rate: number | null;
      present: number;
      absent: number;
      marked: number;
      total: number;
    };
    currentTerm: { id: string; name: string; year: number } | null;
    results: { studentsWithResults: number; isPublished: boolean };
  } | null;
}

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
}

export default function TeacherDashboard() {
  const { user, isSubjectTeacher, myClassId, mySubjects } = useUser();
  const [stats, setStats] = useState<MyClassStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    fetch(`${API}/reports/my-class`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Group subject teacher's assignments by class
  const subjectsByClass = useMemo(() => {
    const map = new Map<string, { className: string; subjects: string[] }>();
    for (const s of mySubjects) {
      if (!map.has(s.classId)) map.set(s.classId, { className: s.class.name, subjects: [] });
      map.get(s.classId)!.subjects.push(s.subject.name);
    }
    return [...map.entries()].map(([classId, v]) => ({ classId, ...v }));
  }, [mySubjects]);

  const firstName = user?.firstName ?? 'Teacher';
  const cls = stats?.classTeacherOf;

  // Subject teacher: render their own standalone view
  if (!loading && !cls && isSubjectTeacher) {
    return <SubjectTeacherDashboard firstName={firstName} subjectsByClass={subjectsByClass} />;
  }

  return (
    <div className="p-6 max-w-[1600px] w-full mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">
          Welcome Back, {firstName}.
        </h2>
        <p className="text-sm text-gray-500 mt-1 font-medium">
          {cls ? `Here's how ${cls.name} is doing today.` : "Here's your dashboard for today."}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : !cls ? (
        <NoClassCard />
      ) : (
        <>
          {/* Term banner */}
          {cls.currentTerm && (
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
              <Clock size={14} className="text-primary-400" />
              <span>
                Current Term: <span className="font-semibold text-gray-800">{cls.currentTerm.name} {cls.currentTerm.year}</span>
              </span>
            </div>
          )}

          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Students */}
            <Link href={`/students`} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 hover:border-primary-300 transition-colors group">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-sm font-semibold text-gray-600">My Students</span>
              </div>
              <p className="text-2xl font-extrabold text-gray-900">{cls.totalStudents}</p>
              <p className="text-xs text-gray-400 mt-1">
                {cls.male} boys · {cls.female} girls
              </p>
            </Link>

            {/* Attendance */}
            <Link href="/attendance" className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 hover:border-primary-300 transition-colors group">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center">
                  <CalendarCheck className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-sm font-semibold text-gray-600">Attendance Today</span>
              </div>
              {cls.attendanceToday.marked === 0 ? (
                <>
                  <p className="text-2xl font-extrabold text-gray-400">—</p>
                  <p className="text-xs text-gray-400 mt-1">Not yet marked</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-extrabold text-emerald-600">
                    {cls.attendanceToday.rate ?? 0}%
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {cls.attendanceToday.present} present ·{' '}
                    <span className="text-red-500 font-semibold">{cls.attendanceToday.absent} absent</span>
                  </p>
                </>
              )}
            </Link>

            {/* Results */}
            <Link
              href={myClassId ? `/results/${myClassId}` : '/results'}
              className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 hover:border-primary-300 transition-colors group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-sm font-semibold text-gray-600">Results</span>
              </div>
              <p className="text-2xl font-extrabold text-gray-900">{cls.results.studentsWithResults}</p>
              <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                {cls.results.isPublished ? (
                  <><CheckCircle2 size={11} className="text-green-500" /> Published</>
                ) : (
                  <><Clock size={11} className="text-amber-500" /> Draft</>
                )}
                <span>· of {cls.totalStudents} students</span>
              </div>
            </Link>

            {/* Leave */}
            <Link href="/leaves" className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 hover:border-primary-300 transition-colors group">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-sm font-semibold text-gray-600">Leave Requests</span>
              </div>
              <p className="text-2xl font-extrabold text-gray-900">—</p>
              <p className="text-xs text-gray-400 mt-1">View & submit requests</p>
            </Link>
          </div>

          {/* Quick links */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <QuickLink href="/attendance" icon={<CalendarCheck className="w-4 h-4" />} label="Mark Attendance" />
              <QuickLink href={myClassId ? `/results/${myClassId}` : '/results'} icon={<FileText className="w-4 h-4" />} label="Enter Results" />
              <QuickLink href="/timetable" icon={<Clock className="w-4 h-4" />} label="View Timetable" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Subject Teacher Dashboard ────────────────────────────────────────────────

function SubjectTeacherDashboard({ firstName, subjectsByClass }: {
  firstName: string;
  subjectsByClass: { classId: string; className: string; subjects: string[] }[];
}) {
  return (
    <div className="p-6 max-w-[1600px] w-full mx-auto animate-in fade-in duration-500">
      <div className="mb-6">
        <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">
          Welcome Back, {firstName}.
        </h2>
        <p className="text-sm text-gray-500 mt-1 font-medium">
          You're teaching {subjectsByClass.length} class{subjectsByClass.length !== 1 ? 'es' : ''} this term.
        </p>
      </div>

      {/* Subject assignments */}
      <div className="space-y-3 mb-6">
        {subjectsByClass.map(({ classId, className, subjects }) => (
          <div key={classId} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{className}</p>
                <p className="text-xs text-gray-500">{subjects.join(' · ')}</p>
              </div>
            </div>
            <Link
              href={`/results/${classId}`}
              className="flex items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-800 shrink-0"
            >
              Enter Results <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLink href="/results" icon={<FileText className="w-4 h-4" />} label="View All My Classes" />
          <QuickLink href="/leaves" icon={<ClipboardList className="w-4 h-4" />} label="Leave Requests" />
        </div>
      </div>
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-gray-100 hover:border-primary-300 hover:bg-primary-50 transition-colors group"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 group-hover:text-primary-700">
        <span className="text-gray-400 group-hover:text-primary-500">{icon}</span>
        {label}
      </div>
      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500" />
    </Link>
  );
}

function NoClassCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center max-w-md mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-4">
        <Users className="w-7 h-7 text-gray-300" />
      </div>
      <h3 className="font-bold text-gray-800 mb-1">No class assigned yet</h3>
      <p className="text-sm text-gray-500">
        You haven't been assigned as a class teacher. Contact an administrator to get started.
      </p>
    </div>
  );
}
