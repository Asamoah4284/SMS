'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Modal } from '@/components/ui';
import { useUser } from '@/lib/UserContext';
import { getGrade, schoolConfig } from '@/lib/theme';
import {
  ChevronLeft, Plus, Trash2, BookOpen, FileText,
  Lock, Unlock, Printer, TrendingUp, Loader2, Save,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Term { id: string; name: string; year: number; isCurrent: boolean; }
interface Subject { id: string; name: string; code: string | null; }

interface Assessment {
  id: string;
  name: string;
  type: 'TEST' | 'EXAM';
  date: string | null;
  totalMark: number;
  subject: Subject;
  _count: { scores: number };
}

interface ScoreEntry {
  id: string;
  studentId: string;
  name: string;
  score: number | null;
  scoreId: string | null;
}

interface SubjectResult {
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  totalScore: number | null;
  grade: string | null;
  position: number | null;
  remarks: string | null;
}

interface StudentResult {
  student: { id: string; studentId: string; firstName: string; lastName: string };
  subjects: SubjectResult[];
  average: number | null;
  aggregate: number | null;
  isPromoted: boolean | null;
  teacherRemarks?: string | null;
  headmasterRemarks?: string | null;
  nextTermBegins?: string | null;
}

interface TermResultData {
  classId: string;
  className: string;
  classTeacher: { name: string } | null;
  term: { id: string; name: string; year: number } | null;
  isPublished: boolean;
  publishedAt: string | null;
  config?: { components: Array<{ assessmentId: string; weight: number; assessment: { subject: { id: string } } }> };
  students: StudentResult[];
}

type Tab = 'assessments' | 'generate' | 'results';

// Grade → tailwind colours
const GRADE_BG: Record<string, string> = {
  A1: 'bg-success-100 text-success-800',
  B2: 'bg-success-50 text-success-700',
  B3: 'bg-blue-50 text-blue-700',
  C4: 'bg-blue-50 text-blue-600',
  C5: 'bg-warning-50 text-warning-700',
  C6: 'bg-warning-50 text-warning-600',
  D7: 'bg-orange-50 text-orange-700',
  E8: 'bg-danger-50 text-danger-600',
  F9: 'bg-danger-100 text-danger-800',
};

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
}
const API = process.env.NEXT_PUBLIC_API_URL;

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClassResultsDetail({ classId, initialTermId }: { classId: string; initialTermId: string }) {
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedTermId, setSelectedTermId] = useState(initialTermId);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>('assessments');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [className, setClassName] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const { user, isAdmin, isClassTeacher, myClassId, mySubjects } = useUser();
  const userRole = user?.role ?? '';

  // null = can edit all subjects; string[] = only these subject IDs (subject teacher scope)
  const editableSubjectIds: string[] | null = useMemo(() => {
    if (isAdmin) return null;
    if (isClassTeacher && myClassId === classId) return null;
    return mySubjects.filter((s) => s.classId === classId).map((s) => s.subjectId);
  }, [isAdmin, isClassTeacher, myClassId, mySubjects, classId]);

  // Only admin and the class teacher of this class can generate/publish results
  const canGenerate = isAdmin || (isClassTeacher && myClassId === classId);

  const [addAssessmentOpen, setAddAssessmentOpen] = useState(false);
  const [scoreModalAssessment, setScoreModalAssessment] = useState<Assessment | null>(null);

  const [resultData, setResultData] = useState<TermResultData | null>(null);
  // components[subjectId][assessmentId] = weight
  const [components, setComponents] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    const token = getToken();
    fetch(`${API}/terms`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const list: Term[] = data.terms ?? [];
        setTerms(list);
        if (!selectedTermId) {
          const cur = list.find((t) => t.isCurrent);
          setSelectedTermId(cur?.id ?? list[0]?.id ?? '');
        }
      }).catch(() => {});
    fetch(`${API}/subjects`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setSubjects(d.subjects ?? d ?? []))
      .catch(() => {});
  }, []);

  const fetchAssessments = useCallback(async () => {
    if (!selectedTermId) return;
    setLoading(true); setError('');
    try {
      const token = getToken();
      const res = await fetch(`${API}/results/assessments?classId=${classId}&termId=${selectedTermId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch assessments');
      const data = await res.json();
      setAssessments(data.assessments ?? []);
      setStudentCount(data.studentCount ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally { setLoading(false); }
  }, [classId, selectedTermId]);

  const fetchResults = useCallback(async () => {
    if (!selectedTermId) return;
    try {
      const token = getToken();
      const res = await fetch(`${API}/results/${classId}/${selectedTermId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data: TermResultData = await res.json();
      setResultData(data);
      setIsPublished(data.isPublished);
      setClassName(data.className ?? '');
      // Restore saved component weights from config
      if (data.config?.components) {
        const built: Record<string, Record<string, number>> = {};
        for (const comp of data.config.components) {
          const sid = comp.assessment.subject.id;
          if (!built[sid]) built[sid] = {};
          built[sid][comp.assessmentId] = comp.weight;
        }
        setComponents(built);
      }
    } catch {}
  }, [classId, selectedTermId]);

  useEffect(() => { fetchAssessments(); fetchResults(); }, [fetchAssessments, fetchResults]);

  // Group assessments by subject
  const bySubject: Record<string, { subject: Subject; items: Assessment[] }> = {};
  assessments.forEach((a) => {
    if (!bySubject[a.subject.id]) bySubject[a.subject.id] = { subject: a.subject, items: [] };
    bySubject[a.subject.id].items.push(a);
  });

  const handleDeleteAssessment = async (id: string) => {
    if (!confirm('Delete this assessment? Cannot be undone.')) return;
    const token = getToken();
    const res = await fetch(`${API}/results/assessments/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) { alert(data.message); return; }
    fetchAssessments();
  };

  const handleGenerate = async () => {
    const flat = Object.entries(components).flatMap(([, aids]) =>
      Object.entries(aids).map(([assessmentId, weight]) => ({ assessmentId, weight }))
    );
    if (flat.length === 0) { alert('Select assessments and set weights first.'); return; }
    const token = getToken();
    const res = await fetch(`${API}/results/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, termId: selectedTermId, components: flat }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.message); return; }
    alert(data.message);
    await fetchResults();
    setActiveTab('results');
  };

  const handlePublish = async () => {
    if (!confirm('Publish results? This makes them visible to parents.')) return;
    const token = getToken();
    const res = await fetch(`${API}/results/publish/${classId}/${selectedTermId}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) { alert(data.message); return; }
    setIsPublished(true); fetchResults();
  };

  const handleUnpublish = async () => {
    if (!confirm('Unpublish results? Regeneration will be allowed again.')) return;
    const token = getToken();
    const res = await fetch(`${API}/results/unpublish/${classId}/${selectedTermId}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) { alert(data.message); return; }
    setIsPublished(false); fetchResults();
  };

  const handlePromotionToggle = async (studentId: string, current: boolean | null) => {
    const token = getToken();
    await fetch(`${API}/results/promotion/${studentId}/${selectedTermId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPromoted: !current }),
    });
    fetchResults();
  };

  const handlePrintAll = () => {
    if (!resultData) return;
    window.open(`/results/${classId}/print?termId=${selectedTermId}`, '_blank');
  };

  const selectedTerm = terms.find((t) => t.id === selectedTermId);
  const tabs: { key: Tab; label: string }[] = [
    { key: 'assessments', label: 'Assessments' },
    ...(canGenerate ? [{ key: 'generate' as Tab, label: 'Generate' }] : []),
    { key: 'results', label: 'Results' },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1400px] mx-auto w-full animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/results" className="text-gray-400 hover:text-gray-700 transition-colors">
          <ChevronLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{className || 'Class Results'}</h1>
          <p className="text-sm text-gray-500">
            {selectedTerm ? `${selectedTerm.name} ${selectedTerm.year}` : 'Select a term'}
            {isPublished && (
              <span className="ml-2 inline-flex items-center gap-1 text-success-600 font-medium">
                <Lock size={12} /> Published
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white shadow-sm"
            value={selectedTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
          >
            {terms.map((t) => (
              <option key={t.id} value={t.id}>{t.name} {t.year}{t.isCurrent ? ' ★' : ''}</option>
            ))}
          </select>
          {userRole === 'ADMIN' && activeTab === 'results' && resultData && resultData.students.length > 0 && (
            isPublished
              ? <Button variant="ghost" size="sm" onClick={handleUnpublish}><Unlock size={14} className="mr-1" />Unpublish</Button>
              : <Button variant="primary" size="sm" onClick={handlePublish}><Lock size={14} className="mr-1" />Publish</Button>
          )}
          {activeTab === 'results' && resultData && resultData.students.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handlePrintAll}>
              <Printer size={14} className="mr-1" />Print All
            </Button>
          )}
        </div>
      </div>

      {error && <Alert type="error" message={error} />}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'assessments' && (
        <AssessmentsTab
          bySubject={bySubject} loading={loading} isPublished={isPublished}
          studentCount={studentCount} userRole={userRole}
          editableSubjectIds={editableSubjectIds}
          onAdd={() => setAddAssessmentOpen(true)}
          onDelete={handleDeleteAssessment}
          onEnterScores={setScoreModalAssessment}
        />
      )}

      {activeTab === 'generate' && (
        <GenerateTab
          bySubject={bySubject} components={components} setComponents={setComponents}
          isPublished={isPublished} onGenerate={handleGenerate} hasResults={!!resultData?.students?.length}
        />
      )}

      {activeTab === 'results' && (
        <ResultsTab
          resultData={resultData} isPublished={isPublished} userRole={userRole}
          canEditRemarks={canGenerate}
          onPromotionToggle={handlePromotionToggle}
          onRemarksUpdate={fetchResults}
          selectedTermId={selectedTermId}
        />
      )}

      {addAssessmentOpen && (
        <AddAssessmentModal
          classId={classId} termId={selectedTermId} subjects={subjects}
          editableSubjectIds={editableSubjectIds}
          onClose={() => setAddAssessmentOpen(false)}
          onSaved={() => { setAddAssessmentOpen(false); fetchAssessments(); }}
        />
      )}

      {scoreModalAssessment && (
        <ScoreEntryModal
          assessment={scoreModalAssessment}
          onClose={() => setScoreModalAssessment(null)}
          onSaved={() => { setScoreModalAssessment(null); fetchAssessments(); }}
        />
      )}
    </div>
  );
}

// ─── Assessments Tab ──────────────────────────────────────────────────────────

function AssessmentsTab({ bySubject, loading, isPublished, studentCount, userRole, editableSubjectIds, onAdd, onDelete, onEnterScores }: {
  bySubject: Record<string, { subject: Subject; items: Assessment[] }>;
  loading: boolean; isPublished: boolean; studentCount: number; userRole: string;
  editableSubjectIds: string[] | null;
  onAdd: () => void; onDelete: (id: string) => void; onEnterScores: (a: Assessment) => void;
}) {
  // Can add/edit anything: admin or class teacher (editableSubjectIds === null)
  // Subject teacher: can add/enter scores only for their subjects
  const isTeacher = userRole === 'ADMIN' || userRole === 'TEACHER';
  const canAdd = !isPublished && isTeacher && (editableSubjectIds === null || editableSubjectIds.length > 0);

  if (loading) return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="space-y-5">
      {canAdd && (
        <div className="flex justify-end">
          <Button variant="primary" size="sm" onClick={onAdd}>
            <Plus size={15} className="mr-1" />Add Assessment
          </Button>
        </div>
      )}

      {Object.keys(bySubject).length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <BookOpen size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No assessments yet</p>
          {canAdd && <p className="text-sm mt-1">Click "Add Assessment" to create your first test or exam.</p>}
        </div>
      ) : (
        Object.values(bySubject).map(({ subject, items }) => {
          const canEditSubject = !isPublished && isTeacher &&
            (editableSubjectIds === null || editableSubjectIds.includes(subject.id));
          const isLocked = !isPublished && isTeacher && editableSubjectIds !== null &&
            !editableSubjectIds.includes(subject.id);

          return (
            <div key={subject.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">
                  {subject.name}{subject.code ? ` (${subject.code})` : ''}
                </h3>
                {isLocked && (
                  <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                    <Lock size={12} /> Another teacher's subject
                  </span>
                )}
              </div>
              <div className="divide-y divide-gray-50">
                {items.map((a) => (
                  <div key={a.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${a.type === 'EXAM' ? 'bg-primary-500' : 'bg-warning-400'}`} />
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{a.name}</p>
                        <p className="text-xs text-gray-500">
                          {a.type} · Over {a.totalMark}
                          {a.date && ` · ${new Date(a.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                          {' · '}{a._count.scores}/{studentCount} scores entered
                        </p>
                      </div>
                    </div>
                    {canEditSubject && (
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => onEnterScores(a)}>
                          {a._count.scores > 0 ? 'Edit Scores' : 'Enter Scores'}
                        </Button>
                        <button
                          onClick={() => onDelete(a.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Generate Tab ─────────────────────────────────────────────────────────────

function GenerateTab({ bySubject, components, setComponents, isPublished, onGenerate, hasResults }: {
  bySubject: Record<string, { subject: Subject; items: Assessment[] }>;
  components: Record<string, Record<string, number>>;
  setComponents: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>;
  isPublished: boolean; onGenerate: () => void; hasResults: boolean;
}) {
  const subjects = Object.values(bySubject);

  if (subjects.length === 0) return (
    <div className="text-center py-16 text-gray-400">
      <FileText size={40} className="mx-auto mb-3 opacity-40" />
      <p className="font-medium">No assessments to generate from</p>
      <p className="text-sm mt-1">Add assessments in the Assessments tab first.</p>
    </div>
  );

  const toggle = (subjectId: string, assessmentId: string, checked: boolean) => {
    setComponents((prev) => {
      const sub = { ...(prev[subjectId] ?? {}) };
      if (checked) sub[assessmentId] = 0;
      else delete sub[assessmentId];
      return { ...prev, [subjectId]: sub };
    });
  };

  const setWeight = (subjectId: string, assessmentId: string, val: string) => {
    setComponents((prev) => ({
      ...prev,
      [subjectId]: { ...(prev[subjectId] ?? {}), [assessmentId]: parseFloat(val) || 0 },
    }));
  };

  return (
    <div className="space-y-5">
      {isPublished && <Alert type="warning" message="Results are published. Unpublish first to regenerate." />}

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-800">
        <strong>How it works:</strong> Select which assessments contribute to each subject's final score.
        Assign weights (%) — they must sum to <strong>100</strong> per subject.
        Each score is scaled proportionally then totalled out of 100.
      </div>

      {subjects.map(({ subject, items }) => {
        const subComp = components[subject.id] ?? {};
        const weightTotal = Object.values(subComp).reduce((s, v) => s + v, 0);
        const isValid = Math.abs(weightTotal - 100) < 0.01;
        const hasSelected = Object.keys(subComp).length > 0;

        return (
          <div key={subject.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">{subject.name}</h3>
              {hasSelected && (
                <span className={`text-sm font-bold ${isValid ? 'text-success-600' : 'text-danger-600'}`}>
                  {weightTotal.toFixed(0)}% / 100%
                </span>
              )}
            </div>
            <div className="divide-y divide-gray-50">
              {items.map((a) => {
                const checked = a.id in subComp;
                return (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                    <input type="checkbox" checked={checked} disabled={isPublished}
                      onChange={(e) => toggle(subject.id, a.id, e.target.checked)}
                      className="w-4 h-4 rounded accent-primary-600"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{a.name}</p>
                      <p className="text-xs text-gray-500">
                        {a.type} · Over {a.totalMark} · {a._count.scores} scores entered
                      </p>
                    </div>
                    {checked && (
                      <div className="flex items-center gap-1">
                        <input type="number" min="0" max="100" step="1"
                          value={subComp[a.id] || ''}
                          disabled={isPublished}
                          onChange={(e) => setWeight(subject.id, a.id, e.target.value)}
                          className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary-400"
                          placeholder="0"
                        />
                        <span className="text-sm text-gray-500">%</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {!isPublished && (
        <div className="flex justify-end pt-2">
          <Button variant="primary" onClick={onGenerate}>
            <TrendingUp size={15} className="mr-1" />
            {hasResults ? 'Regenerate Results' : 'Generate Results'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Results Tab ──────────────────────────────────────────────────────────────

function ResultsTab({ resultData, isPublished, userRole, canEditRemarks, onPromotionToggle, onRemarksUpdate, selectedTermId }: {
  resultData: TermResultData | null; isPublished: boolean; userRole: string;
  canEditRemarks: boolean;
  onPromotionToggle: (studentId: string, current: boolean | null) => void;
  onRemarksUpdate: () => void; selectedTermId: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [remarksModal, setRemarksModal] = useState<StudentResult | null>(null);

  if (!resultData || resultData.students.length === 0) return (
    <div className="text-center py-16 text-gray-400">
      <FileText size={40} className="mx-auto mb-3 opacity-40" />
      <p className="font-medium">No results generated yet</p>
      <p className="text-sm mt-1">Go to the Generate tab to configure weights and generate results.</p>
    </div>
  );

  const canEdit = !isPublished && canEditRemarks;

  return (
    <div className="space-y-3">
      {isPublished && (
        <div className="flex items-center gap-2 text-sm text-success-700 bg-success-50 border border-success-100 rounded-xl px-4 py-2">
          <Lock size={14} />
          Results published{resultData.publishedAt
            ? ` on ${new Date(resultData.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
            : ''}
        </div>
      )}

      {resultData.students.map((st) => {
        const isExpanded = expanded === st.student.id;
        const avgGrade = st.average !== null ? getGrade(st.average) : null;

        return (
          <div key={st.student.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              onClick={() => setExpanded(isExpanded ? null : st.student.id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
                  {st.student.firstName[0]}{st.student.lastName[0]}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">
                    {st.student.firstName} {st.student.lastName}
                  </p>
                  <p className="text-xs text-gray-500">{st.student.studentId}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {avgGrade && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${GRADE_BG[avgGrade.grade] ?? 'bg-gray-100 text-gray-700'}`}>
                    Avg {st.average!.toFixed(1)} · {avgGrade.grade}
                  </span>
                )}
                {st.aggregate !== null && (
                  <span className="text-xs text-gray-500 hidden sm:block">Agg: {st.aggregate}</span>
                )}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  st.isPromoted ? 'bg-success-100 text-success-700' : 'bg-danger-100 text-danger-700'
                }`}>
                  {st.isPromoted ? 'Promoted' : 'Repeat'}
                </span>
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-gray-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-2 text-left">Subject</th>
                        <th className="px-4 py-2 text-right">Score</th>
                        <th className="px-4 py-2 text-center">Grade</th>
                        <th className="px-4 py-2 text-center">Position</th>
                        <th className="px-4 py-2 text-left">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {st.subjects.map((sub) => (
                        <tr key={sub.subjectId}>
                          <td className="px-4 py-2 font-medium text-gray-800">{sub.subjectName}</td>
                          <td className="px-4 py-2 text-right">
                            {sub.totalScore !== null ? sub.totalScore.toFixed(1) : <span className="text-orange-500 font-semibold">ABS</span>}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {sub.grade && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${GRADE_BG[sub.grade] ?? 'bg-gray-100 text-gray-600'}`}>
                                {sub.grade}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-center text-gray-600">{sub.position ?? '—'}</td>
                          <td className="px-4 py-2 text-gray-500 text-xs">{sub.remarks ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-t border-gray-100 flex-wrap">
                  {canEditRemarks && (
                    <Button variant="ghost" size="sm" onClick={() => setRemarksModal(st)}>
                      Edit Remarks
                    </Button>
                  )}
                  {canEdit && (
                    <Button variant="ghost" size="sm" onClick={() => onPromotionToggle(st.student.id, st.isPromoted)}>
                      {st.isPromoted ? 'Mark Repeat' : 'Mark Promoted'}
                    </Button>
                  )}
                  <Link
                    href={`/results/${st.student.id}/reportcard?termId=${selectedTermId}`}
                    target="_blank"
                    className="text-sm text-primary-600 hover:underline ml-auto"
                  >
                    Print Report Card →
                  </Link>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {remarksModal && (
        <RemarksModal
          student={remarksModal} termId={selectedTermId} userRole={userRole}
          onClose={() => setRemarksModal(null)}
          onSaved={() => { setRemarksModal(null); onRemarksUpdate(); }}
        />
      )}
    </div>
  );
}

// ─── Add Assessment Modal ─────────────────────────────────────────────────────

function AddAssessmentModal({ classId, termId, subjects, editableSubjectIds, onClose, onSaved }: {
  classId: string; termId: string; subjects: Subject[];
  editableSubjectIds: string[] | null;
  onClose: () => void; onSaved: () => void;
}) {
  const visibleSubjects = editableSubjectIds === null
    ? subjects
    : subjects.filter((s) => editableSubjectIds.includes(s.id));
  const [form, setForm] = useState({ name: '', type: 'TEST', date: '', totalMark: '', subjectId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subjectId) { setError('Please select a subject'); return; }
    setSaving(true); setError('');
    const token = getToken();
    const res = await fetch(`${API}/results/assessments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, classId, termId }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.message); return; }
    onSaved();
  };

  return (
    <Modal isOpen={true} title="Add Assessment" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert type="error" message={error} />}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
          <select
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })} required
          >
            <option value="">Select subject...</option>
            {visibleSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Assessment Name *</label>
          <input type="text"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            placeholder="e.g. Class Test 1, End of Term Exam"
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
            <select
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="TEST">Test</option>
              <option value="EXAM">Exam</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Mark *</label>
            <input type="number" min="1" step="0.5"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="e.g. 100"
              value={form.totalMark} onChange={(e) => setForm({ ...form, totalMark: e.target.value })} required
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date (optional)</label>
          <input type="date"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}Add
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Score Entry Modal ────────────────────────────────────────────────────────

function ScoreEntryModal({ assessment, onClose, onSaved }: {
  assessment: Assessment; onClose: () => void; onSaved: () => void;
}) {
  const [students, setStudents] = useState<ScoreEntry[]>([]);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getToken();
    fetch(`${API}/results/assessments/${assessment.id}/scores`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        setStudents(data.students ?? []);
        const init: Record<string, string> = {};
        (data.students ?? []).forEach((s: ScoreEntry) => { init[s.id] = s.score !== null ? String(s.score) : ''; });
        setScores(init);
      })
      .catch(() => setError('Failed to load student list'))
      .finally(() => setLoading(false));
  }, [assessment.id]);

  const handleSave = async () => {
    setSaving(true); setError('');
    const payload = students.map((s) => ({
      studentId: s.id,
      score: scores[s.id] === '' || scores[s.id] === undefined ? null : parseFloat(scores[s.id]),
    }));
    const token = getToken();
    const res = await fetch(`${API}/results/assessments/${assessment.id}/scores`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scores: payload }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.message); return; }
    onSaved();
  };

  return (
    <Modal isOpen={true} title={`Scores — ${assessment.name}`} onClose={onClose}>
      <div className="space-y-3">
        {error && <Alert type="error" message={error} />}
        <p className="text-sm text-gray-500">
          {assessment.subject.name} · Out of {assessment.totalMark} ·{' '}
          Leave blank = <span className="font-semibold text-orange-600">ABS</span> (treated as 0)
        </p>
        {loading ? (
          <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}</div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto space-y-1 pr-1">
            {students.map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-1.5">
                <span className="text-sm text-gray-800 flex-1 truncate">{s.name}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <input type="number" min="0" max={assessment.totalMark} step="0.5"
                    className={`w-24 border rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary-400 ${
                      (scores[s.id] === '' || scores[s.id] === undefined) ? 'border-orange-300 bg-orange-50' : 'border-gray-200'
                    }`}
                    placeholder="ABS"
                    value={scores[s.id] ?? ''}
                    onChange={(e) => setScores({ ...scores, [s.id]: e.target.value })}
                  />
                  <span className="text-xs text-gray-400">/{assessment.totalMark}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
            Save Scores
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Remarks Modal ────────────────────────────────────────────────────────────

function RemarksModal({ student, termId, userRole, onClose, onSaved }: {
  student: StudentResult; termId: string; userRole: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [teacherRemarks, setTeacherRemarks] = useState(student.teacherRemarks ?? '');
  const [headmasterRemarks, setHeadmasterRemarks] = useState(student.headmasterRemarks ?? '');
  const [nextTermBegins, setNextTermBegins] = useState(
    student.nextTermBegins ? student.nextTermBegins.split('T')[0] : ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true); setError('');
    const token = getToken();
    const res = await fetch(`${API}/results/remarks/${student.student.id}/${termId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherRemarks, headmasterRemarks, nextTermBegins: nextTermBegins || null }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.message); return; }
    onSaved();
  };

  return (
    <Modal isOpen={true} title={`Remarks — ${student.student.firstName} ${student.student.lastName}`} onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert type="error" message={error} />}
        {(userRole === 'TEACHER' || userRole === 'ADMIN') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class Teacher's Remarks</label>
            <textarea rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="e.g. A brilliant student who shows great potential..."
              value={teacherRemarks} onChange={(e) => setTeacherRemarks(e.target.value)}
            />
          </div>
        )}
        {userRole === 'ADMIN' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Headmaster's Remarks</label>
              <textarea rows={3}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-400"
                placeholder="e.g. Keep it up! We expect more from you..."
                value={headmasterRemarks} onChange={(e) => setHeadmasterRemarks(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Next Term Begins</label>
              <input type="date"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                value={nextTermBegins} onChange={(e) => setNextTermBegins(e.target.value)}
              />
            </div>
          </>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
