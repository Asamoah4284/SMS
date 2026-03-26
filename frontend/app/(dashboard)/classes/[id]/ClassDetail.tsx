'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Alert, Badge } from '@/components/ui';
import { classLevelLabels, getGrade } from '@/lib/theme';
import {
  Users, BookOpen, Award, AlertTriangle, CheckCircle2,
  Clock, BarChart3, ChevronRight, UserCheck, UserX,
  TrendingDown, Phone,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student {
  id: string;
  name: string;
  studentId: string;
  dateOfBirth: string | null;
  gender: 'MALE' | 'FEMALE';
  parentName: string | null;
  parentPhone: string | null;
}

interface Subject {
  id: string;
  name: string;
  code: string | null;
  teacherId: string;
  teacher: string;
}

interface ClassStats {
  totalStudents: number;
  male: number;
  female: number;
  attendance: {
    PRESENT: number;
    ABSENT: number;
    LATE: number;
    EXCUSED: number;
    rate: number;
  } | null;
  performance: {
    classAvgScore: number;
    topStudents: Array<{ id: string; name: string; avgScore: number }>;
    struggling: Array<{ id: string; name: string; avgScore: number }>;
    subjectBreakdown: Array<{ name: string; avgScore: number }>;
  } | null;
}

interface ClassData {
  id: string;
  name: string;
  level: string;
  section: string | null;
  classTeacher: { id: string; name: string; phone: string } | null;
  students: Student[];
  subjects: Subject[];
  stats: ClassStats;
}

type Tab = 'overview' | 'students' | 'subjects' | 'performance';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClassDetail({ classId }: { classId: string }) {
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const fetchClassDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/classes/${classId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch class');
      setClassData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load class');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => { fetchClassDetail(); }, [fetchClassDetail]);

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="h-8 w-48 bg-gray-100 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
        <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error) return <Alert type="error" message={error} />;
  if (!classData) return <Alert type="error" message="Class not found" />;

  const { stats } = classData;

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <Link href="/classes" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium mb-3">
          ← Back to Classes
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{classData.name}</h1>
            <p className="text-gray-500 mt-0.5">
              {classLevelLabels[classData.level as keyof typeof classLevelLabels] || classData.level}
              {classData.section && ` · Section ${classData.section}`}
            </p>
          </div>
          {classData.classTeacher ? (
            <Link href={`/teachers/${classData.classTeacher.id}`} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-2.5 hover:bg-gray-50 transition-colors shadow-sm">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
                {classData.classTeacher.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Class Teacher</p>
                <p className="text-sm font-semibold text-gray-900">{classData.classTeacher.name}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </Link>
          ) : (
            <Badge variant="warning">No teacher assigned</Badge>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5 text-primary-600" />}
          label="Total Students"
          value={String(stats.totalStudents)}
          sub={`${stats.male} Male · ${stats.female} Female`}
          colorClass="bg-primary-50"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5 text-success-600" />}
          label="Attendance Rate"
          value={stats.attendance ? `${stats.attendance.rate}%` : '—'}
          sub={stats.attendance ? `${stats.attendance.PRESENT} present · ${stats.attendance.ABSENT} absent` : 'No data this term'}
          colorClass="bg-success-50"
          highlight={
            stats.attendance
              ? stats.attendance.rate >= 80 ? 'success' : 'danger'
              : undefined
          }
        />
        <StatCard
          icon={<BarChart3 className="w-5 h-5 text-info-600" />}
          label="Class Average"
          value={stats.performance ? `${stats.performance.classAvgScore}%` : '—'}
          sub={stats.performance ? getGrade(stats.performance.classAvgScore).label : 'No results yet'}
          colorClass="bg-blue-50"
        />
        <StatCard
          icon={<BookOpen className="w-5 h-5 text-warning-600" />}
          label="Subjects"
          value={String(classData.subjects.length)}
          sub={`${classData.subjects.length} subject${classData.subjects.length !== 1 ? 's' : ''} taught`}
          colorClass="bg-warning-50"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {(['overview', 'students', 'subjects', 'performance'] as Tab[]).map((tab) => (
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
              {tab === 'students' && stats.totalStudents > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                  {stats.totalStudents}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && <OverviewTab classData={classData} />}
      {activeTab === 'students' && <StudentsTab students={classData.students} />}
      {activeTab === 'subjects' && <SubjectsTab subjects={classData.subjects} />}
      {activeTab === 'performance' && <PerformanceTab stats={classData.stats} />}
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
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-[var(--shadow-card)]">
      <div className={`w-10 h-10 ${colorClass} rounded-xl flex items-center justify-center mb-3`}>{icon}</div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${highlight === 'success' ? 'text-success-700' : highlight === 'danger' ? 'text-danger-700' : 'text-gray-900'}`}>
        {value}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ classData }: { classData: ClassData }) {
  const { stats } = classData;

  return (
    <div className="space-y-5">
      {stats.attendance && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-[var(--shadow-card)]">
          <h3 className="font-bold text-gray-900 mb-4">Attendance This Term</h3>
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1.5">
              <span>Attendance rate</span>
              <span className="font-bold text-gray-900">{stats.attendance.rate}%</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all ${stats.attendance.rate >= 80 ? 'bg-success-500' : stats.attendance.rate >= 60 ? 'bg-warning-500' : 'bg-danger-500'}`}
                style={{ width: `${stats.attendance.rate}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {([
              { label: 'Present', val: stats.attendance.PRESENT, icon: <UserCheck className="w-4 h-4" />, bg: 'bg-success-50', text: 'text-success-700' },
              { label: 'Absent', val: stats.attendance.ABSENT, icon: <UserX className="w-4 h-4" />, bg: 'bg-danger-50', text: 'text-danger-700' },
              { label: 'Late', val: stats.attendance.LATE, icon: <Clock className="w-4 h-4" />, bg: 'bg-warning-50', text: 'text-warning-700' },
              { label: 'Excused', val: stats.attendance.EXCUSED, icon: <CheckCircle2 className="w-4 h-4" />, bg: 'bg-blue-50', text: 'text-blue-700' },
            ] as const).map(({ label, val, icon, bg, text }) => (
              <div key={label} className={`flex flex-col items-center gap-1 p-3 rounded-xl ${bg}`}>
                <div className={text}>{icon}</div>
                <p className={`text-xl font-bold ${text}`}>{val}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.performance && (
        <div className="grid md:grid-cols-2 gap-5">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-warning-500" />
              <h3 className="font-bold text-gray-900">Top Performers</h3>
            </div>
            <div className="space-y-3">
              {stats.performance.topStudents.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? 'bg-warning-100 text-warning-700' : 'bg-gray-100 text-gray-600'}`}>
                    {i + 1}
                  </div>
                  <Link href={`/students/${s.id}`} className="flex-1 text-sm font-semibold text-gray-900 hover:text-primary-700 truncate">
                    {s.name}
                  </Link>
                  <ScoreBadge score={s.avgScore} />
                </div>
              ))}
              {stats.performance.topStudents.length === 0 && (
                <p className="text-sm text-gray-500">No results yet</p>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-danger-500" />
              <h3 className="font-bold text-gray-900">Needs Attention</h3>
            </div>
            {stats.performance.struggling.length > 0 ? (
              <div className="space-y-3">
                {stats.performance.struggling.map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-danger-50 flex items-center justify-center flex-shrink-0">
                      <TrendingDown className="w-3.5 h-3.5 text-danger-600" />
                    </div>
                    <Link href={`/students/${s.id}`} className="flex-1 text-sm font-semibold text-gray-900 hover:text-primary-700 truncate">
                      {s.name}
                    </Link>
                    <ScoreBadge score={s.avgScore} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-success-700 py-1">
                <CheckCircle2 className="w-4 h-4" />
                <p className="text-sm font-medium">All students above 50%</p>
              </div>
            )}
          </div>
        </div>
      )}

      {!stats.attendance && !stats.performance && (
        <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-600">No term data yet</p>
          <p className="text-sm text-gray-400 mt-1">Attendance and results will appear here once a term is active</p>
        </div>
      )}
    </div>
  );
}

// ─── Students Tab ─────────────────────────────────────────────────────────────

function StudentsTab({ students }: { students: Student[] }) {
  const [search, setSearch] = useState('');
  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.studentId.toLowerCase().includes(search.toLowerCase())
  );

  if (students.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl py-16 text-center shadow-[var(--shadow-card)]">
        <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-500">No students enrolled yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search by name or ID..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
      />
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
        <div className="grid grid-cols-[auto_2fr_1fr_1fr_1fr] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
          <span>#</span>
          <span>Student</span>
          <span className="hidden sm:block">ID</span>
          <span className="hidden md:block">Age</span>
          <span>Parent Contact</span>
        </div>
        <div className="divide-y divide-gray-100">
          {filtered.map((student, idx) => (
            <div key={student.id} className="grid grid-cols-[auto_2fr_1fr_1fr_1fr] gap-4 items-center px-6 py-3.5 hover:bg-gray-50 transition-colors">
              <span className="text-sm text-gray-400 font-mono w-6 text-center">{idx + 1}</span>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center text-primary-700 font-bold text-xs flex-shrink-0">
                  {student.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <Link href={`/students/${student.id}`} className="text-sm font-semibold text-gray-900 hover:text-primary-700 truncate block">
                    {student.name}
                  </Link>
                  <p className="text-xs text-gray-400">{student.gender === 'MALE' ? 'Male' : 'Female'}</p>
                </div>
              </div>
              <span className="hidden sm:block text-xs font-mono text-gray-500">{student.studentId}</span>
              <span className="hidden md:block text-sm text-gray-600">
                {student.dateOfBirth
                  ? `${Math.floor((Date.now() - new Date(student.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} yrs`
                  : '—'}
              </span>
              <div className="text-sm text-gray-600">
                {student.parentPhone ? (
                  <a href={`tel:${student.parentPhone}`} className="flex items-center gap-1 hover:text-primary-700">
                    <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{student.parentPhone}</span>
                  </a>
                ) : (
                  <span className="text-gray-300 italic">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">No students match your search</div>
        )}
      </div>
    </div>
  );
}

// ─── Subjects Tab ─────────────────────────────────────────────────────────────

function SubjectsTab({ subjects }: { subjects: Subject[] }) {
  if (subjects.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl py-16 text-center shadow-[var(--shadow-card)]">
        <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-500">No subjects assigned yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
      <div className="grid grid-cols-[2fr_1fr_2fr] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
        <span>Subject</span>
        <span>Code</span>
        <span>Teacher</span>
      </div>
      <div className="divide-y divide-gray-100">
        {subjects.map((subject) => (
          <div key={subject.id} className="grid grid-cols-[2fr_1fr_2fr] gap-4 items-center px-6 py-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-primary-600" />
              </div>
              <span className="font-semibold text-gray-900">{subject.name}</span>
            </div>
            <span className="font-mono text-sm text-gray-500">{subject.code || '—'}</span>
            <Link href={`/teachers/${subject.teacherId}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary-700 group">
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                {subject.teacher.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <span className="font-medium group-hover:underline">{subject.teacher}</span>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Performance Tab ──────────────────────────────────────────────────────────

function PerformanceTab({ stats }: { stats: ClassStats }) {
  if (!stats.performance) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl py-16 text-center shadow-[var(--shadow-card)]">
        <BarChart3 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        <p className="font-semibold text-gray-600">No results recorded yet</p>
        <p className="text-sm text-gray-400 mt-1">Results will appear here once entered for the current term</p>
      </div>
    );
  }

  const { performance } = stats;

  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="font-bold text-gray-900">Class Average Score</h3>
          <ScoreBadge score={performance.classAvgScore} large />
        </div>
        <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-4 rounded-full transition-all ${performance.classAvgScore >= 70 ? 'bg-success-500' : performance.classAvgScore >= 50 ? 'bg-warning-500' : 'bg-danger-500'}`}
            style={{ width: `${performance.classAvgScore}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1.5">
          <span>0%</span><span>50%</span><span>100%</span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-[var(--shadow-card)]">
        <h3 className="font-bold text-gray-900 mb-4">Subject Breakdown</h3>
        <div className="space-y-3">
          {performance.subjectBreakdown.map((subject) => (
            <div key={subject.name}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">{subject.name}</span>
                <span className="font-bold text-gray-900">{subject.avgScore}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-2 rounded-full ${subject.avgScore >= 70 ? 'bg-success-500' : subject.avgScore >= 50 ? 'bg-warning-500' : 'bg-danger-500'}`}
                  style={{ width: `${subject.avgScore}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-warning-500" />
            <h3 className="font-bold text-gray-900">Top Students</h3>
          </div>
          <div className="space-y-3">
            {performance.topStudents.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? 'bg-warning-100 text-warning-700' : i === 1 ? 'bg-gray-200 text-gray-700' : 'bg-orange-100 text-orange-700'}`}>
                  {i + 1}
                </div>
                <Link href={`/students/${s.id}`} className="flex-1 text-sm font-semibold text-gray-900 hover:text-primary-700 truncate">
                  {s.name}
                </Link>
                <ScoreBadge score={s.avgScore} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-danger-500" />
            <h3 className="font-bold text-gray-900">Needs Attention</h3>
          </div>
          {performance.struggling.length > 0 ? (
            <div className="space-y-3">
              {performance.struggling.map((s) => (
                <div key={s.id} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-danger-50 flex items-center justify-center flex-shrink-0">
                    <TrendingDown className="w-3.5 h-3.5 text-danger-600" />
                  </div>
                  <Link href={`/students/${s.id}`} className="flex-1 text-sm font-semibold text-gray-900 hover:text-primary-700 truncate">
                    {s.name}
                  </Link>
                  <ScoreBadge score={s.avgScore} />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 py-2 text-success-700">
              <CheckCircle2 className="w-4 h-4" />
              <p className="text-sm font-medium">All students performing well</p>
            </div>
          )}
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
