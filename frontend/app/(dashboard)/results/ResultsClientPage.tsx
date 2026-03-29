'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Alert, Badge, Button, PageHeader } from '@/components/ui';
import {
  FileText,
  ChevronRight,
  Clock,
  Lock,
  AlertTriangle,
  Search,
  Users,
  BookOpen,
} from 'lucide-react';
import { useUser } from '@/lib/UserContext';
import { classLevelLabels } from '@/lib/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Term {
  id: string;
  name: string;
  year: number;
  isCurrent: boolean;
}

interface ClassResultStatus {
  id: string;
  name: string;
  level: string;
  section: string | null;
  classTeacher: { id: string; name: string } | null;
  totalStudents: number;
  status: 'NOT_GENERATED' | 'DRAFT' | 'PUBLISHED';
  isPublished: boolean;
  publishedAt: string | null;
}

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
}

const API = process.env.NEXT_PUBLIC_API_URL;

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ResultsClientPage() {
  const { isAdmin, isClassTeacher, isSubjectTeacher, myClassId, mySubjects, loading: userLoading } = useUser();
  const mySubjectClassIds = useMemo(() => new Set(mySubjects.map((s) => s.classId)), [mySubjects]);
  const router = useRouter();
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedTermId, setSelectedTermId] = useState('');
  const [classes, setClasses] = useState<ClassResultStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [termsLoading, setTermsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Redirect class teachers to their class results
  useEffect(() => {
    if (!userLoading && isClassTeacher && myClassId) {
      router.replace(`/results/${myClassId}`);
    }
  }, [userLoading, isClassTeacher, myClassId, router]);

  // Fetch terms
  useEffect(() => {
    const token = getToken();
    fetch(`${API}/terms`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const list: Term[] = data.terms ?? [];
        setTerms(list);
        const current = list.find((t) => t.isCurrent);
        if (current) setSelectedTermId(current.id);
        else if (list.length > 0) setSelectedTermId(list[0].id);
        else setLoading(false); // no terms — stop loading
      })
      .catch(() => setLoading(false))
      .finally(() => setTermsLoading(false));
  }, []);

  const fetchClasses = useCallback(async () => {
    if (!selectedTermId) return;
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      const [classRes, resultRes] = await Promise.all([
        fetch(`${API}/classes`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/results/status?termId=${selectedTermId}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const classData = await classRes.json();
      const resultData = resultRes.ok ? await resultRes.json() : { statuses: [] };

      const statusMap: Record<string, { isPublished: boolean; publishedAt: string | null }> = {};
      (resultData.statuses ?? []).forEach((s: { classId: string; isPublished: boolean; publishedAt: string | null }) => {
        statusMap[s.classId] = s;
      });

      let allClasses: ClassResultStatus[] = (classData.classes ?? classData ?? []).map((c: {
        id: string; name: string; level: string; section?: string | null;
        classTeacher: { id: string; name: string } | null;
        studentCount?: number;
      }) => {
        const s = statusMap[c.id];
        return {
          id: c.id,
          name: c.name,
          level: c.level,
          section: c.section ?? null,
          classTeacher: c.classTeacher,
          totalStudents: c.studentCount ?? 0,
          status: s ? (s.isPublished ? 'PUBLISHED' : 'DRAFT') : 'NOT_GENERATED',
          isPublished: s?.isPublished ?? false,
          publishedAt: s?.publishedAt ?? null,
        };
      });

      // Subject teachers: only show classes where they have assigned subjects
      if (!isAdmin && isSubjectTeacher) {
        allClasses = allClasses.filter((c) => mySubjectClassIds.has(c.id));
      }

      setClasses(allClasses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [selectedTermId, isAdmin, isSubjectTeacher, mySubjectClassIds]);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  const filteredClasses = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return classes;
    return classes.filter((cls) => {
      const levelLabel = classLevelLabels[cls.level as keyof typeof classLevelLabels] ?? cls.level;
      const statusLabel =
        cls.status === 'PUBLISHED' ? 'published' : cls.status === 'DRAFT' ? 'draft' : 'not generated';
      const haystack = [
        cls.name,
        cls.level,
        levelLabel,
        cls.section ?? '',
        cls.classTeacher?.name ?? '',
        statusLabel,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [classes, searchQuery]);

  const resultStatusBadge = (status: ClassResultStatus['status']) => {
    if (status === 'PUBLISHED') {
      return (
        <Badge variant="success" className="gap-1">
          <Lock className="w-3 h-3" />
          Published
        </Badge>
      );
    }
    if (status === 'DRAFT') {
      return (
        <Badge variant="warning" className="gap-1">
          <Clock className="w-3 h-3" />
          Draft
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="gap-1 border-gray-200 bg-gray-50 text-gray-600">
        <FileText className="w-3 h-3" />
        Not generated
      </Badge>
    );
  };

  const published = classes.filter((c) => c.status === 'PUBLISHED').length;
  const draft = classes.filter((c) => c.status === 'DRAFT').length;
  const pending = classes.filter((c) => c.status === 'NOT_GENERATED').length;

  return (
    <div className="animate-fade-in space-y-6 px-5 py-6 sm:px-8 md:px-10 lg:px-12 max-w-[1600px] mx-auto">
      <PageHeader
        title="Results"
        subtitle="Manage end-of-term assessments and report cards"
      />

      {/* No terms state */}
      {!termsLoading && terms.length === 0 && (
        <div className="bg-warning-50 border border-warning-200 rounded-2xl p-6 text-center">
          <FileText size={36} className="mx-auto mb-3 text-warning-400" />
          <p className="font-semibold text-warning-800">No academic terms set up yet</p>
          <p className="text-sm text-warning-700 mt-1">
            Go to <a href="/settings" className="underline font-medium">Settings → Academic Terms</a> and create a term first.
          </p>
        </div>
      )}

      {/* Term selector */}
      {terms.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Term:</label>
          <select
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            value={selectedTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
          >
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.year}{t.isCurrent ? ' (Current)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <Alert type="error" message={error} />}

      {/* Summary cards */}
      {!loading && classes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Lock size={16} className="text-success-600" />
              <span className="text-sm font-medium text-gray-600">Published</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{published}</p>
            <p className="text-xs text-gray-500">{classes.length} total classes</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={16} className="text-warning-600" />
              <span className="text-sm font-medium text-gray-600">Draft</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{draft}</p>
            <p className="text-xs text-gray-500">Generated, not published</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={16} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-600">Pending</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{pending}</p>
            <p className="text-xs text-gray-500">Not yet generated</p>
          </div>
        </div>
      )}

      {/* Search + class cards (same grid pattern as Classes) */}
      {!loading && classes.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search class name, level, section, teacher, status…"
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <Button onClick={() => setSearchQuery(searchInput)} icon={<Search className="w-4 h-4" />}>
              Search
            </Button>
          </div>

          {filteredClasses.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
              <p className="text-sm text-gray-500">No classes match your search.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredClasses.map((cls) => {
                const levelLabel =
                  classLevelLabels[cls.level as keyof typeof classLevelLabels] ?? cls.level;
                const subLabel = cls.section ? `${levelLabel} · Section ${cls.section}` : levelLabel;
                const hasTeacher = Boolean(cls.classTeacher);

                return (
                  <div
                    key={cls.id}
                    className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm"
                  >
                    <Link
                      href={`/results/${cls.id}?termId=${selectedTermId}`}
                      className="group block hover:bg-gray-50/40 transition-colors rounded-xl"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-bold text-gray-900 truncate">{cls.name}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border border-gray-200 bg-gray-50 text-gray-700">
                              {subLabel}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {resultStatusBadge(cls.status)}
                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="w-4 h-4 text-gray-500" />
                          <span className="font-semibold text-gray-900">{cls.totalStudents}</span>
                          <span className="text-sm text-gray-500">students</span>
                        </div>
                        <div className="text-right min-w-0">
                          <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                            Class teacher
                          </p>
                          <p
                            className={`text-sm font-semibold truncate ${hasTeacher ? 'text-gray-900' : 'text-gray-400'}`}
                          >
                            {hasTeacher ? cls.classTeacher!.name : 'Not assigned'}
                          </p>
                        </div>
                      </div>

                      {cls.status === 'PUBLISHED' && cls.publishedAt && (
                        <p className="mt-2 text-xs text-gray-400 text-right">
                          Published{' '}
                          {new Date(cls.publishedAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      )}
                    </Link>

                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <Link
                        href={`/timetable?classId=${cls.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        Timetable
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm animate-pulse">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="h-5 w-28 bg-gray-200 rounded-md" />
                  <div className="mt-2 h-4 w-36 bg-gray-100 rounded-full" />
                </div>
                <div className="h-5 w-24 bg-gray-100 rounded-full" />
              </div>
              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="h-4 w-24 bg-gray-100 rounded-md" />
                <div className="h-4 w-28 bg-gray-100 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : classes.length === 0 && !termsLoading && terms.length > 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No classes found</p>
        </div>
      ) : null}
    </div>
  );
}
