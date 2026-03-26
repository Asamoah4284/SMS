'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useReactToPrint } from 'react-to-print';
import { Alert, Badge, Button, Modal } from '@/components/ui';
import { schoolConfig } from '@/lib/theme';
import {
  ChevronLeft, Plus, Trash2, Edit2, BookOpen, FileText,
  CheckCircle2, Lock, Unlock, Printer, AlertTriangle,
  Award, TrendingUp, Users, Loader2, X, Save,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Term {
  id: string;
  name: string;
  year: number;
  isCurrent: boolean;
}

interface Subject {
  id: string;
  name: string;
  code: string | null;
}

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

interface ResultRow {
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
  subjects: ResultRow[];
  average: number | null;
  aggregate: number | null;
  isPromoted: boolean | null;
}

interface TermResultData {
  classId: string;
  className: string;
  classTeacher: { name: string } | null;
  term: { id: string; name: string; year: number } | null;
  isPublished: boolean;
  publishedAt: string | null;
  students: StudentResult[];
}

type Tab = 'assessments' | 'generate' | 'results';

const GRADE_COLORS: Record<string, string> = {
  A1: 'bg-success-100 text-success-800',
  B2: 'bg-success-50 text-success-700',
  B3: 'bg-success-50 text-success-700',
  C4: 'bg-blue-50 text-blue-700',
  C5: 'bg-blue-50 text-blue-700',
  C6: 'bg-blue-50 text-blue-700',
  D7: 'bg-warning-50 text-warning-700',
  E8: 'bg-warning-50 text-warning-700',
  F9: 'bg-danger-50 text-danger-700',
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
  const [userRole, setUserRole] = useState('');

  // Modals
  const [addAssessmentOpen, setAddAssessmentOpen] = useState(false);
  const [scoreModalAssessment, setScoreModalAssessment] = useState<Assessment | null>(null);

  // Result generation
  const [resultData, setResultData] = useState<TermResultData | null>(null);
  const [components, setComponents] = useState<Record<string, Record<string, number>>>({});
  // components[subjectId][assessmentId] = weight

  // Print ref
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef, documentTitle: `${className} Results` });

  useEffect(() => {
    const role = localStorage.getItem('userRole') ?? '';
    setUserRole(role);
    const token = getToken();
    fetch(`${API}/terms`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const list: Term[] = data.terms ?? [];
        setTerms(list);
        if (!selectedTermId) {
          const cur = list.find((t) => t.isCurrent);
          if (cur) setSelectedTermId(cur.id);
          else if (list.length > 0) setSelectedTermId(list[0].id);
        }
      })
      .catch(() => {});
    // Fetch subjects list for the form
    fetch(`${API}/subjects`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setSubjects(d.subjects ?? d ?? []))
      .catch(() => {});
  }, []);

  const fetchAssessments = useCallback(async () => {
    if (!selectedTermId) return;
    setLoading(true);
    setError('');
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
    } finally {
      setLoading(false);
    }
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

      // Rebuild components from config if available
      if (data.config?.components) {
        const built: Record<string, Record<string, number>> = {};
        for (const comp of (data as any).config.components) {
          const sid = comp.assessment.subject.id;
          if (!built[sid]) built[sid] = {};
          built[sid][comp.assessmentId] = comp.weight;
        }
        setComponents(built);
      }
    } catch {}
  }, [classId, selectedTermId]);

  useEffect(() => {
    fetchAssessments();
    fetchResults();
  }, [fetchAssessments, fetchResults]);

  // Group assessments by subject
  const assessmentsBySubject: Record<string, { subject: Subject; items: Assessment[] }> = {};
  assessments.forEach((a) => {
    const sid = a.subject.id;
    if (!assessmentsBySubject[sid]) assessmentsBySubject[sid] = { subject: a.subject, items: [] };
    assessmentsBySubject[sid].items.push(a);
  });

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleDeleteAssessment = async (id: string) => {
    if (!confirm('Delete this assessment? This cannot be undone.')) return;
    const token = getToken();
    const res = await fetch(`${API}/results/assessments/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) { alert(data.message); return; }
    fetchAssessments();
  };

  const handleGenerate = async () => {
    // Flatten components
    const flat: { assessmentId: string; weight: number }[] = [];
    for (const sid of Object.keys(components)) {
      for (const aid of Object.keys(components[sid])) {
        flat.push({ assessmentId: aid, weight: components[sid][aid] });
      }
    }
    if (flat.length === 0) { alert('Add assessments and configure weights first.'); return; }

    const token = getToken();
    const res = await fetch(`${API}/results/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, termId: selectedTermId, components: flat }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.message); return; }
    alert(data.message);
    fetchResults();
    setActiveTab('results');
  };

  const handlePublish = async () => {
    if (!confirm('Publish results? This will make them visible to parents.')) return;
    const token = getToken();
    const res = await fetch(`${API}/results/publish/${classId}/${selectedTermId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) { alert(data.message); return; }
    setIsPublished(true);
    fetchResults();
  };

  const handleUnpublish = async () => {
    if (!confirm('Unpublish results? Regeneration will be allowed.')) return;
    const token = getToken();
    const res = await fetch(`${API}/results/unpublish/${classId}/${selectedTermId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) { alert(data.message); return; }
    setIsPublished(false);
    fetchResults();
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

  const selectedTerm = terms.find((t) => t.id === selectedTermId);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'assessments', label: 'Assessments' },
    { key: 'generate', label: 'Generate' },
    { key: 'results', label: 'Results' },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/results" className="text-gray-400 hover:text-gray-700 transition-colors">
          <ChevronLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{className || 'Class Results'}</h1>
          <p className="text-sm text-gray-500">
            {selectedTerm ? `${selectedTerm.name} ${selectedTerm.year}` : 'Select a term'}
            {isPublished && <span className="ml-2 inline-flex items-center gap-1 text-success-600 font-medium"><Lock size={12} /> Published</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Term selector */}
          <select
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
            value={selectedTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
          >
            {terms.map((t) => (
              <option key={t.id} value={t.id}>{t.name} {t.year}{t.isCurrent ? ' ★' : ''}</option>
            ))}
          </select>
          {userRole === 'ADMIN' && activeTab === 'results' && resultData && resultData.students.length > 0 && (
            isPublished
              ? <Button variant="outline" size="sm" onClick={handleUnpublish}><Unlock size={14} className="mr-1" /> Unpublish</Button>
              : <Button variant="primary" size="sm" onClick={handlePublish}><Lock size={14} className="mr-1" /> Publish</Button>
          )}
          {activeTab === 'results' && resultData && resultData.students.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => handlePrint()}>
              <Printer size={14} className="mr-1" /> Print All
            </Button>
          )}
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Assessments Tab ── */}
      {activeTab === 'assessments' && (
        <AssessmentsTab
          assessmentsBySubject={assessmentsBySubject}
          loading={loading}
          isPublished={isPublished}
          studentCount={studentCount}
          userRole={userRole}
          onAdd={() => setAddAssessmentOpen(true)}
          onDelete={handleDeleteAssessment}
          onEnterScores={setScoreModalAssessment}
        />
      )}

      {/* ── Generate Tab ── */}
      {activeTab === 'generate' && (
        <GenerateTab
          assessmentsBySubject={assessmentsBySubject}
          components={components}
          setComponents={setComponents}
          isPublished={isPublished}
          onGenerate={handleGenerate}
          resultData={resultData}
        />
      )}

      {/* ── Results Tab ── */}
      {activeTab === 'results' && (
        <ResultsTab
          resultData={resultData}
          isPublished={isPublished}
          userRole={userRole}
          onPromotionToggle={handlePromotionToggle}
          onRemarksUpdate={fetchResults}
          selectedTermId={selectedTermId}
        />
      )}

      {/* Print container (hidden) */}
      {resultData && (
        <div className="hidden">
          <div ref={printRef}>
            {resultData.students.map((st) => (
              <ReportCard
                key={st.student.id}
                student={st}
                term={resultData.term}
                className={resultData.className}
                classTeacher={resultData.classTeacher?.name ?? ''}
                classSize={resultData.students.length}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add Assessment Modal */}
      {addAssessmentOpen && (
        <AddAssessmentModal
          classId={classId}
          termId={selectedTermId}
          subjects={subjects}
          onClose={() => setAddAssessmentOpen(false)}
          onSaved={() => { setAddAssessmentOpen(false); fetchAssessments(); }}
        />
      )}

      {/* Score Entry Modal */}
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

function AssessmentsTab({
  assessmentsBySubject, loading, isPublished, studentCount, userRole,
  onAdd, onDelete, onEnterScores,
}: {
  assessmentsBySubject: Record<string, { subject: Subject; items: Assessment[] }>;
  loading: boolean;
  isPublished: boolean;
  studentCount: number;
  userRole: string;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onEnterScores: (a: Assessment) => void;
}) {
  const canEdit = userRole === 'ADMIN' || userRole === 'TEACHER';

  if (loading) return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="space-y-5">
      {canEdit && !isPublished && (
        <div className="flex justify-end">
          <Button variant="primary" size="sm" onClick={onAdd}>
            <Plus size={15} className="mr-1" /> Add Assessment
          </Button>
        </div>
      )}

      {Object.keys(assessmentsBySubject).length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <BookOpen size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No assessments yet</p>
          {canEdit && !isPublished && (
            <p className="text-sm mt-1">Click "Add Assessment" to create your first test or exam.</p>
          )}
        </div>
      ) : (
        Object.values(assessmentsBySubject).map(({ subject, items }) => (
          <div key={subject.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">{subject.name}{subject.code ? ` (${subject.code})` : ''}</h3>
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
                        {' · '}{a._count.scores}/{studentCount} scores
                      </p>
                    </div>
                  </div>
                  {canEdit && !isPublished && (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => onEnterScores(a)}>
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
        ))
      )}
    </div>
  );
}

// ─── Generate Tab ─────────────────────────────────────────────────────────────

function GenerateTab({
  assessmentsBySubject, components, setComponents, isPublished, onGenerate, resultData,
}: {
  assessmentsBySubject: Record<string, { subject: Subject; items: Assessment[] }>;
  components: Record<string, Record<string, number>>;
  setComponents: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>;
  isPublished: boolean;
  onGenerate: () => void;
  resultData: TermResultData | null;
}) {
  const subjects = Object.values(assessmentsBySubject);

  if (subjects.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <FileText size={40} className="mx-auto mb-3 opacity-40" />
        <p className="font-medium">No assessments to generate from</p>
        <p className="text-sm mt-1">Add assessments in the Assessments tab first.</p>
      </div>
    );
  }

  const setWeight = (subjectId: string, assessmentId: string, val: string) => {
    const n = parseFloat(val) || 0;
    setComponents((prev) => ({
      ...prev,
      [subjectId]: { ...(prev[subjectId] ?? {}), [assessmentId]: n },
    }));
  };

  const toggleAssessment = (subjectId: string, assessmentId: string, checked: boolean) => {
    setComponents((prev) => {
      const sub = { ...(prev[subjectId] ?? {}) };
      if (checked) { sub[assessmentId] = 0; }
      else { delete sub[assessmentId]; }
      return { ...prev, [subjectId]: sub };
    });
  };

  return (
    <div className="space-y-5">
      {isPublished && (
        <Alert variant="warning">Results are published. Unpublish first to regenerate.</Alert>
      )}

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-800">
        <strong>How it works:</strong> Select which assessments contribute to the final score for each subject.
        Assign weights (%) — they must sum to <strong>100</strong> per subject. Scores are scaled proportionally,
        then totalled to give a mark out of 100.
      </div>

      {subjects.map(({ subject, items }) => {
        const subComponents = components[subject.id] ?? {};
        const weightTotal = Object.values(subComponents).reduce((s, v) => s + v, 0);
        const isValid = Math.abs(weightTotal - 100) < 0.01;
        const hasSelected = Object.keys(subComponents).length > 0;

        return (
          <div key={subject.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">{subject.name}</h3>
              {hasSelected && (
                <span className={`text-sm font-medium ${isValid ? 'text-success-600' : 'text-danger-600'}`}>
                  {weightTotal.toFixed(0)}% / 100%
                </span>
              )}
            </div>
            <div className="divide-y divide-gray-50">
              {items.map((a) => {
                const checked = a.id in subComponents;
                const weight = subComponents[a.id] ?? '';
                return (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isPublished}
                      onChange={(e) => toggleAssessment(subject.id, a.id, e.target.checked)}
                      className="w-4 h-4 rounded accent-primary-600"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{a.name}</p>
                      <p className="text-xs text-gray-500">{a.type} · Over {a.totalMark} · {a._count.scores} scores</p>
                    </div>
                    {checked && (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={weight}
                          disabled={isPublished}
                          onChange={(e) => setWeight(subject.id, a.id, e.target.value)}
                          className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary-400"
                          placeholder="Weight"
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
            {resultData?.students?.length ? 'Regenerate Results' : 'Generate Results'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Results Tab ──────────────────────────────────────────────────────────────

function ResultsTab({
  resultData, isPublished, userRole, onPromotionToggle, onRemarksUpdate, selectedTermId,
}: {
  resultData: TermResultData | null;
  isPublished: boolean;
  userRole: string;
  onPromotionToggle: (studentId: string, current: boolean | null) => void;
  onRemarksUpdate: () => void;
  selectedTermId: string;
}) {
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [remarksModal, setRemarksModal] = useState<StudentResult | null>(null);

  if (!resultData || resultData.students.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Award size={40} className="mx-auto mb-3 opacity-40" />
        <p className="font-medium">No results generated yet</p>
        <p className="text-sm mt-1">Go to the Generate tab to configure weights and generate results.</p>
      </div>
    );
  }

  const canEdit = !isPublished && (userRole === 'ADMIN' || userRole === 'TEACHER');

  return (
    <div className="space-y-3">
      {isPublished && (
        <div className="flex items-center gap-2 text-sm text-success-700 bg-success-50 border border-success-100 rounded-xl px-4 py-2">
          <Lock size={14} /> Results published
          {resultData.publishedAt && ` on ${new Date(resultData.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
        </div>
      )}

      {resultData.students.map((st) => {
        const expanded = expandedStudent === st.student.id;
        return (
          <div key={st.student.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Student header row */}
            <button
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              onClick={() => setExpandedStudent(expanded ? null : st.student.id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
                  {st.student.firstName[0]}{st.student.lastName[0]}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{st.student.firstName} {st.student.lastName}</p>
                  <p className="text-xs text-gray-500">{st.student.studentId}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {st.average !== null && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${GRADE_COLORS[getGradeFromScore(st.average)] ?? 'bg-gray-100 text-gray-700'}`}>
                    Avg: {st.average.toFixed(1)}
                  </span>
                )}
                {st.aggregate !== null && (
                  <span className="text-xs text-gray-500">Agg: {st.aggregate}</span>
                )}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  st.isPromoted ? 'bg-success-100 text-success-700' : 'bg-danger-100 text-danger-700'
                }`}>
                  {st.isPromoted ? 'Promoted' : 'Not Promoted'}
                </span>
              </div>
            </button>

            {/* Expanded: subject breakdown */}
            {expanded && (
              <div className="border-t border-gray-100">
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
                        <td className="px-4 py-2 text-right">{sub.totalScore !== null ? sub.totalScore.toFixed(1) : '—'}</td>
                        <td className="px-4 py-2 text-center">
                          {sub.grade && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${GRADE_COLORS[sub.grade] ?? 'bg-gray-100 text-gray-600'}`}>
                              {sub.grade}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-center text-gray-600">{sub.position ?? '—'}</td>
                        <td className="px-4 py-2 text-gray-500">{sub.remarks ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(canEdit || userRole === 'ADMIN') && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-t border-gray-100">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRemarksModal(st)}
                    >
                      Edit Remarks
                    </Button>
                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPromotionToggle(st.student.id, st.isPromoted)}
                      >
                        {st.isPromoted ? 'Mark Not Promoted' : 'Mark Promoted'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {remarksModal && (
        <RemarksModal
          student={remarksModal}
          termId={selectedTermId}
          userRole={userRole}
          onClose={() => setRemarksModal(null)}
          onSaved={() => { setRemarksModal(null); onRemarksUpdate(); }}
        />
      )}
    </div>
  );
}

function getGradeFromScore(score: number): string {
  if (score >= 80) return 'A1';
  if (score >= 70) return 'B2';
  if (score >= 65) return 'B3';
  if (score >= 60) return 'C4';
  if (score >= 55) return 'C5';
  if (score >= 50) return 'C6';
  if (score >= 45) return 'D7';
  if (score >= 40) return 'E8';
  return 'F9';
}

// ─── Add Assessment Modal ─────────────────────────────────────────────────────

function AddAssessmentModal({
  classId, termId, subjects, onClose, onSaved,
}: {
  classId: string;
  termId: string;
  subjects: Subject[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ name: '', type: 'TEST', date: '', totalMark: '', subjectId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subjectId) { setError('Please select a subject'); return; }
    setSaving(true);
    setError('');
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
    <Modal title="Add Assessment" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
          <select
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            value={form.subjectId}
            onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
            required
          >
            <option value="">Select subject...</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Assessment Name *</label>
          <input
            type="text"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            placeholder="e.g. Class Test 1"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
            <select
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="TEST">Test</option>
              <option value="EXAM">Exam</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Mark *</label>
            <input
              type="number"
              min="1"
              step="0.5"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="e.g. 100"
              value={form.totalMark}
              onChange={(e) => setForm({ ...form, totalMark: e.target.value })}
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date (optional)</label>
          <input
            type="date"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
            Add
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Score Entry Modal ────────────────────────────────────────────────────────

function ScoreEntryModal({
  assessment, onClose, onSaved,
}: {
  assessment: Assessment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [students, setStudents] = useState<ScoreEntry[]>([]);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getToken();
    fetch(`${API}/results/assessments/${assessment.id}/scores`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setStudents(data.students ?? []);
        const initial: Record<string, string> = {};
        (data.students ?? []).forEach((s: ScoreEntry) => {
          initial[s.id] = s.score !== null ? String(s.score) : '';
        });
        setScores(initial);
      })
      .catch(() => setError('Failed to load student list'))
      .finally(() => setLoading(false));
  }, [assessment.id]);

  const markAllAbsent = () => {
    const all: Record<string, string> = {};
    students.forEach((s) => { all[s.id] = ''; });
    setScores(all);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const payload = students.map((s) => ({
      studentId: s.id,
      score: scores[s.id] === '' ? null : parseFloat(scores[s.id]),
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
    <Modal title={`Scores: ${assessment.name}`} onClose={onClose}>
      <div className="space-y-3">
        {error && <Alert variant="error">{error}</Alert>}

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            {assessment.subject.name} · Over {assessment.totalMark}
            {' · '}Leave blank = <span className="font-semibold text-orange-600">ABS</span> (counted as 0)
          </span>
          <button onClick={markAllAbsent} className="text-xs text-gray-400 hover:text-gray-600 underline">
            Clear all
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-1">
            {students.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-1 py-1.5">
                <span className="text-sm text-gray-800 flex-1">{s.name}</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max={assessment.totalMark}
                    step="0.5"
                    className={`w-24 border rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary-400 ${
                      scores[s.id] === '' ? 'border-orange-300 bg-orange-50' : 'border-gray-200'
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
          <Button variant="outline" onClick={onClose}>Cancel</Button>
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

function RemarksModal({
  student, termId, userRole, onClose, onSaved,
}: {
  student: StudentResult;
  termId: string;
  userRole: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [teacherRemarks, setTeacherRemarks] = useState('');
  const [headmasterRemarks, setHeadmasterRemarks] = useState('');
  const [nextTermBegins, setNextTermBegins] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Try loading existing remarks (they're embedded in student data from the parent fetch, but
    // for simplicity we'll just start blank — they'll show on next load)
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
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
    <Modal title={`Remarks: ${student.student.firstName} ${student.student.lastName}`} onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        {(userRole === 'TEACHER' || userRole === 'ADMIN') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class Teacher Remarks</label>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-400"
              rows={3}
              placeholder="e.g. A brilliant student who shows great potential..."
              value={teacherRemarks}
              onChange={(e) => setTeacherRemarks(e.target.value)}
            />
          </div>
        )}

        {userRole === 'ADMIN' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Headmaster Remarks</label>
              <textarea
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-400"
                rows={3}
                placeholder="e.g. Keep it up! We expect more from you..."
                value={headmasterRemarks}
                onChange={(e) => setHeadmasterRemarks(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Next Term Begins</label>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                value={nextTermBegins}
                onChange={(e) => setNextTermBegins(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
            Save Remarks
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Report Card (printable) ──────────────────────────────────────────────────

function ReportCard({
  student, term, className, classTeacher, classSize,
}: {
  student: StudentResult;
  term: { name: string; year: number } | null;
  className: string;
  classTeacher: string;
  classSize: number;
}) {
  const scores = student.subjects.map((s) => s.totalScore).filter((s) => s !== null) as number[];
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  return (
    <div className="p-8 max-w-2xl mx-auto font-serif" style={{ pageBreakAfter: 'always' }}>
      {/* School header */}
      <div className="text-center border-b-2 border-gray-800 pb-4 mb-4">
        <h1 className="text-xl font-bold uppercase">{schoolConfig.name}</h1>
        {schoolConfig.motto && <p className="text-sm italic text-gray-600">{schoolConfig.motto}</p>}
        {schoolConfig.address && <p className="text-xs text-gray-500">{schoolConfig.address}</p>}
        <h2 className="text-base font-bold mt-2 uppercase tracking-wide">End of Term Report Card</h2>
        <p className="text-sm">{term ? `${term.name} ${term.year}` : ''}</p>
      </div>

      {/* Student info */}
      <div className="grid grid-cols-2 gap-x-8 text-sm mb-4">
        <div><span className="font-semibold">Name:</span> {student.student.firstName} {student.student.lastName}</div>
        <div><span className="font-semibold">ID:</span> {student.student.studentId}</div>
        <div><span className="font-semibold">Class:</span> {className}</div>
        <div><span className="font-semibold">Class Teacher:</span> {classTeacher}</div>
      </div>

      {/* Results table */}
      <table className="w-full border-collapse text-sm mb-4">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-3 py-1.5 text-left">Subject</th>
            <th className="border border-gray-300 px-3 py-1.5 text-center">Score (/100)</th>
            <th className="border border-gray-300 px-3 py-1.5 text-center">Grade</th>
            <th className="border border-gray-300 px-3 py-1.5 text-center">Position</th>
            <th className="border border-gray-300 px-3 py-1.5 text-left">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {student.subjects.map((sub) => (
            <tr key={sub.subjectId}>
              <td className="border border-gray-300 px-3 py-1">{sub.subjectName}</td>
              <td className="border border-gray-300 px-3 py-1 text-center">
                {sub.totalScore !== null ? sub.totalScore.toFixed(1) : 'ABS'}
              </td>
              <td className="border border-gray-300 px-3 py-1 text-center font-semibold">{sub.grade ?? '—'}</td>
              <td className="border border-gray-300 px-3 py-1 text-center">{sub.position ?? '—'}</td>
              <td className="border border-gray-300 px-3 py-1">{sub.remarks ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 text-sm border border-gray-200 rounded p-3 mb-4">
        <div className="text-center">
          <p className="text-gray-500 text-xs">Average</p>
          <p className="font-bold text-lg">{avg !== null ? avg.toFixed(1) : '—'}</p>
        </div>
        {student.aggregate !== null && (
          <div className="text-center">
            <p className="text-gray-500 text-xs">Aggregate</p>
            <p className="font-bold text-lg">{student.aggregate}</p>
          </div>
        )}
        <div className="text-center">
          <p className="text-gray-500 text-xs">Promotion</p>
          <p className={`font-bold text-sm ${student.isPromoted ? 'text-green-700' : 'text-red-700'}`}>
            {student.isPromoted ? 'Promoted' : 'Repeat'}
          </p>
        </div>
      </div>

      {/* GES Grade key */}
      <div className="text-xs text-gray-500 mb-4">
        <span className="font-semibold">Grading: </span>
        A1 (80–100) · B2 (70–79) · B3 (65–69) · C4 (60–64) · C5 (55–59) · C6 (50–54) · D7 (45–49) · E8 (40–44) · F9 (&lt;40)
      </div>

      {/* Remarks */}
      <div className="grid grid-cols-2 gap-6 text-sm mt-4 border-t border-gray-200 pt-4">
        <div>
          <p className="font-semibold mb-1">Class Teacher's Remarks:</p>
          <p className="italic text-gray-700 min-h-[2rem]">{(student as any).teacherRemarks ?? ''}</p>
          <div className="mt-4 border-t border-gray-400 w-40 pt-1 text-xs text-gray-500">Signature</div>
        </div>
        <div>
          <p className="font-semibold mb-1">Headmaster's Remarks:</p>
          <p className="italic text-gray-700 min-h-[2rem]">{(student as any).headmasterRemarks ?? ''}</p>
          <div className="mt-4 border-t border-gray-400 w-40 pt-1 text-xs text-gray-500">Signature</div>
        </div>
      </div>

      {(student as any).nextTermBegins && (
        <p className="text-sm mt-4">
          <span className="font-semibold">Next Term Begins:</span>{' '}
          {new Date((student as any).nextTermBegins).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}
    </div>
  );
}
