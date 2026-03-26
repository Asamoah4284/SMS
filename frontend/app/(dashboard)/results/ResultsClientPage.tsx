'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, PageHeader } from '@/components/ui';
import { FileText, ChevronRight, CheckCircle2, Clock, Lock, Loader2, AlertTriangle } from 'lucide-react';

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
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedTermId, setSelectedTermId] = useState('');
  const [classes, setClasses] = useState<ClassResultStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      })
      .catch(() => {});
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

      const allClasses: ClassResultStatus[] = (classData.classes ?? classData ?? []).map((c: {
        id: string; name: string; level: string;
        classTeacher: { id: string; name: string } | null;
        _count?: { students: number }; totalStudents?: number;
      }) => {
        const s = statusMap[c.id];
        return {
          id: c.id,
          name: c.name,
          level: c.level,
          classTeacher: c.classTeacher,
          totalStudents: c._count?.students ?? c.totalStudents ?? 0,
          status: s ? (s.isPublished ? 'PUBLISHED' : 'DRAFT') : 'NOT_GENERATED',
          isPublished: s?.isPublished ?? false,
          publishedAt: s?.publishedAt ?? null,
        };
      });

      setClasses(allClasses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [selectedTermId]);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  const selectedTerm = terms.find((t) => t.id === selectedTermId);

  const statusBadge = (status: ClassResultStatus['status']) => {
    if (status === 'PUBLISHED') return <Badge variant="success">Published</Badge>;
    if (status === 'DRAFT') return <Badge variant="warning">Draft</Badge>;
    return <Badge variant="default">Not Generated</Badge>;
  };

  const statusIcon = (status: ClassResultStatus['status']) => {
    if (status === 'PUBLISHED') return <Lock size={16} className="text-success-600" />;
    if (status === 'DRAFT') return <Clock size={16} className="text-warning-600" />;
    return <FileText size={16} className="text-gray-400" />;
  };

  const published = classes.filter((c) => c.status === 'PUBLISHED').length;
  const draft = classes.filter((c) => c.status === 'DRAFT').length;
  const pending = classes.filter((c) => c.status === 'NOT_GENERATED').length;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Results"
        subtitle="Manage end-of-term assessments and report cards"
        icon={<FileText size={22} />}
      />

      {/* Term selector */}
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

      {error && <Alert variant="error">{error}</Alert>}

      {/* Summary cards */}
      {!loading && classes.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
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

      {/* Class list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No classes found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {classes.map((cls) => (
            <Link
              key={cls.id}
              href={`/results/${cls.id}?termId=${selectedTermId}`}
              className="flex items-center justify-between bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:border-primary-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                  {statusIcon(cls.status)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 group-hover:text-primary-700">{cls.name}</p>
                  <p className="text-sm text-gray-500">
                    {cls.classTeacher ? cls.classTeacher.name : 'No class teacher'} · {cls.totalStudents} students
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {statusBadge(cls.status)}
                {cls.status === 'PUBLISHED' && cls.publishedAt && (
                  <span className="text-xs text-gray-400 hidden sm:block">
                    {new Date(cls.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                )}
                <ChevronRight size={18} className="text-gray-400 group-hover:text-primary-600" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
