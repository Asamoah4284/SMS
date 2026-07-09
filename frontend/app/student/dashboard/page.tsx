'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Alert, Button, Badge } from '@/components/ui';
import { StudentPortalShell } from '@/components/student/StudentPortalShell';
import {
  Loader2,
  FileText,
  Clock,
  Play,
  CheckCircle2,
  BarChart3,
  BookOpen,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

function getStudentToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('studentToken') : '';
}

const API = process.env.NEXT_PUBLIC_API_URL;

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
  icon: typeof FileText;
  accent: 'primary' | 'success' | 'warning' | 'slate';
}) {
  const accents = {
    primary: 'bg-primary-50 text-primary-700 border-primary-100',
    success: 'bg-success-50 text-success-700 border-success-100',
    warning: 'bg-warning-50 text-warning-800 border-warning-100',
    slate: 'bg-gray-50 text-gray-700 border-gray-100',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-3">
      <div className={`shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center ${accents[accent]}`}>
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

function attemptStatusBadge(status: string | null, resultsReleased?: boolean) {
  if (status === 'GRADED' && resultsReleased) return <Badge variant="success">Completed</Badge>;
  if (status === 'GRADED' || status === 'SUBMITTED') return <Badge variant="warning">Awaiting results</Badge>;
  if (status === 'IN_PROGRESS') return <Badge variant="info">In progress</Badge>;
  return <Badge variant="default">{status ?? '—'}</Badge>;
}

function resultStatusLabel(a: { status: string; score: number | null }) {
  if (a.score != null) return null;
  if (a.status === 'SUBMITTED') return <Badge variant="warning">Awaiting grading</Badge>;
  if (a.status === 'GRADED') return <Badge variant="info">Awaiting release</Badge>;
  return attemptStatusBadge(a.status);
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<{
    student: { studentId: string; firstName: string; lastName: string; class: { name: string } | null };
    availableExams: {
      id: string;
      title: string;
      subject: string;
      durationMinutes: number;
      hasAttempt: boolean;
      attemptStatus: string | null;
      resultsReleased?: boolean;
    }[];
    recentAttempts: {
      title: string;
      subject: string;
      score: number | null;
      totalMarks: number;
      status: string;
    }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getStudentToken();
    if (!token) {
      router.replace('/student/login');
      return;
    }
    fetch(`${API}/student-portal/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (r.status === 401) {
          localStorage.removeItem('studentToken');
          router.replace('/student/login');
          return null;
        }
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then((d) => {
        if (d) setData(d);
      })
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [router]);

  const stats = useMemo(() => {
    if (!data) return null;
    const toTake = data.availableExams.filter((e) => !e.hasAttempt).length;
    const done = data.availableExams.filter((e) => e.hasAttempt).length;
    const gradedWithScores = data.recentAttempts.filter((a) => a.score != null);
    const avgScore =
      gradedWithScores.length > 0
        ? Math.round(
            gradedWithScores.reduce((s, a) => s + ((a.score ?? 0) / a.totalMarks) * 100, 0) /
              gradedWithScores.length,
          )
        : null;
    const awaiting = data.recentAttempts.filter((a) => a.score == null).length;
    return { toTake, done, avgScore, results: data.recentAttempts.length, awaiting };
  }, [data]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-primary-600" />
      </div>
    );
  }

  const firstName = data?.student.firstName ?? 'Student';
  const initials = `${data?.student.firstName?.[0] ?? ''}${data?.student.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <StudentPortalShell>
      {error && <Alert type="error" message={error} className="mb-4" />}

      {/* Welcome hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-700 via-primary-800 to-indigo-900 text-white shadow-lg mb-5">
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,white_0%,transparent_50%)]" />
        <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-lg font-bold shrink-0 backdrop-blur-sm">
            {initials || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-primary-200 text-xs font-medium uppercase tracking-wide">Welcome back</p>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight mt-0.5">Hello, {firstName}!</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-primary-100/90">
              <span className="font-mono text-xs bg-white/10 px-2 py-0.5 rounded-md">{data?.student.studentId}</span>
              {data?.student.class?.name && (
                <span className="inline-flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 opacity-70" />
                  {data.student.class.name}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard label="To take" value={String(stats.toTake)} icon={Play} accent="primary" />
          <StatCard label="Completed" value={String(stats.done)} icon={CheckCircle2} accent="success" />
          <StatCard
            label="Results"
            value={String(stats.results)}
            sub={
              stats.avgScore != null
                ? `~${stats.avgScore}% avg`
                : stats.awaiting > 0
                  ? `${stats.awaiting} awaiting release`
                  : undefined
            }
            icon={BarChart3}
            accent="slate"
          />
          <StatCard
            label="Class"
            value={data?.student.class?.name?.split(' ')[0] ?? '—'}
            sub={data?.student.class?.name}
            icon={BookOpen}
            accent="warning"
          />
        </div>
      )}

      {/* Available exams */}
      <section className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary-600" />
            Available exams
          </h2>
        </div>

        {!data?.availableExams.length ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <div className="w-11 h-11 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-700">No exams right now</p>
            <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
              When your teacher publishes an exam, it will show up here.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.availableExams.map((exam) => (
              <article
                key={exam.id}
                className="group bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-gray-200/80 transition-all"
              >
                <div className="h-1.5 bg-gradient-to-r from-primary-500 to-indigo-500" />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 group-hover:text-primary-800 transition-colors">
                      {exam.title}
                    </h3>
                    {exam.hasAttempt && attemptStatusBadge(exam.attemptStatus, exam.resultsReleased)}
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{exam.subject}</p>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 tabular-nums">
                      <Clock className="w-3.5 h-3.5" />
                      {exam.durationMinutes} min
                    </span>
                    {!exam.hasAttempt ? (
                      <Link href={`/student/exams/${exam.id}/take`}>
                        <Button variant="primary" size="sm">
                          Start
                          <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </Link>
                    ) : exam.attemptStatus === 'IN_PROGRESS' ? (
                      <Link href={`/student/exams/${exam.id}/take`}>
                        <Button variant="secondary" size="sm">
                          Continue
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Recent results */}
      {data && data.recentAttempts.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-primary-600" />
            Recent results
          </h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {data.recentAttempts.map((a, i) => {
              const pct = a.score != null && a.totalMarks > 0 ? Math.round((a.score / a.totalMarks) * 100) : null;
              return (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{a.title}</p>
                    <p className="text-xs text-gray-500">{a.subject}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {a.score != null ? (
                      <>
                        <p className="text-sm font-bold text-gray-900 tabular-nums">
                          {a.score}
                          <span className="text-gray-400 font-normal">/{a.totalMarks}</span>
                        </p>
                        {pct != null && (
                          <p className={`text-[10px] font-semibold ${pct >= 50 ? 'text-success-600' : 'text-warning-600'}`}>
                            {pct}%
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-end gap-0.5">
                        {resultStatusLabel(a)}
                        <p className="text-[10px] text-gray-400">Results not released yet</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </StudentPortalShell>
  );
}
