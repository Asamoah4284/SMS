'use client';

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Alert, Badge, Button, Modal } from '@/components/ui';
import {
  Loader2,
  Plus,
  Trash2,
  CheckCircle2,
  ArrowLeft,
  Clock,
  HelpCircle,
  Users,
  ClipboardList,
  BarChart3,
  Pencil,
  Edit2,
  ChevronDown,
  Circle,
  CheckSquare,
  ToggleLeft,
  FileText,
  TextCursorInput,
  Sparkles,
} from 'lucide-react';

interface ExamOption {
  id: string;
  text: string;
  isCorrect: boolean;
}
interface ExamQuestion {
  id: string;
  type: string;
  text: string;
  marks: number;
  order: number;
  modelAnswer: string | null;
  options: ExamOption[];
}

interface ExamDetail {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  durationMinutes: number;
  status: string;
  totalMarks: number;
  resultsReleased: boolean;
  assessmentType: 'TEST' | 'EXAM';
  class: { id: string; name: string };
  subject: { id: string; name: string };
  term: { id: string; name: string; year: number };
  questions: ExamQuestion[];
  attempts: {
    id: string;
    status: string;
    score: number | null;
    student: { studentId: string; firstName: string; lastName: string };
  }[];
}

interface ClassItem {
  id: string;
  name: string;
}
interface SubjectItem {
  id: string;
  name: string;
}
interface TermItem {
  id: string;
  name: string;
  year: number;
}

type TabId = 'questions' | 'results' | 'grading';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
}
const API = process.env.NEXT_PUBLIC_API_URL;

const TAB_LABELS: Record<TabId, string> = {
  questions: 'Questions',
  results: 'Results',
  grading: 'Grading',
};

const selectClass =
  'appearance-none border border-gray-200 rounded-lg pl-2.5 pr-8 py-1.5 text-xs sm:text-sm bg-white shadow-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-400/40 focus:border-primary-300 transition-shadow w-full';

const fieldInput =
  'w-full px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-400 transition-shadow';

function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
        {required && <span className="text-danger-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-1 leading-snug">{hint}</p>}
    </div>
  );
}

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
      <div className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center ${accents[accent]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide truncate">{label}</p>
        <p className="text-lg font-bold text-gray-900 tabular-nums leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function statusBadge(status: string) {
  const map: Record<string, { variant: 'success' | 'warning' | 'default'; label: string }> = {
    PUBLISHED: { variant: 'success', label: 'Live' },
    DRAFT: { variant: 'warning', label: 'Draft' },
    CLOSED: { variant: 'default', label: 'Closed' },
  };
  const cfg = map[status] ?? { variant: 'default' as const, label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function questionTypeLabel(type: string) {
  const map: Record<string, string> = {
    MCQ_SINGLE: 'Single choice',
    MCQ_MULTIPLE: 'Multiple choice',
    TRUE_FALSE: 'True / False',
    FILL_IN_BLANK: 'Fill in the blank',
    THEORY: 'Theory',
  };
  return map[type] ?? type;
}

function questionTypeIcon(type: string) {
  if (type === 'MCQ_MULTIPLE') return CheckSquare;
  if (type === 'TRUE_FALSE') return ToggleLeft;
  if (type === 'FILL_IN_BLANK') return TextCursorInput;
  if (type === 'THEORY') return FileText;
  return Circle;
}

const defaultMcqOptions = () => [
  { text: '', isCorrect: true },
  { text: '', isCorrect: false },
  { text: '', isCorrect: false },
  { text: '', isCorrect: false },
];

const defaultTrueFalseOptions = () => [
  { text: 'True', isCorrect: true },
  { text: 'False', isCorrect: false },
];

function optionsForQuestionType(type: string) {
  if (type === 'TRUE_FALSE') return defaultTrueFalseOptions();
  return defaultMcqOptions();
}

function questionToForm(q: ExamQuestion) {
  if (q.type === 'TRUE_FALSE') {
    const trueOpt = q.options.find((o) => o.text === 'True');
    const falseOpt = q.options.find((o) => o.text === 'False');
    return {
      type: q.type,
      text: q.text,
      marks: String(q.marks),
      modelAnswer: q.modelAnswer ?? '',
      options: [
        { text: 'True', isCorrect: trueOpt?.isCorrect ?? true },
        { text: 'False', isCorrect: falseOpt?.isCorrect ?? false },
      ],
    };
  }
  if (q.type === 'THEORY' || q.type === 'FILL_IN_BLANK') {
    return {
      type: q.type,
      text: q.text,
      marks: String(q.marks),
      modelAnswer: q.modelAnswer ?? '',
      options: defaultMcqOptions(),
    };
  }
  const options = q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect }));
  while (options.length < 4) {
    options.push({ text: '', isCorrect: false });
  }
  return {
    type: q.type,
    text: q.text,
    marks: String(q.marks),
    modelAnswer: q.modelAnswer ?? '',
    options,
  };
}

function buildQuestionBody(qForm: {
  type: string;
  text: string;
  marks: string;
  modelAnswer: string;
  options: { text: string; isCorrect: boolean }[];
}) {
  const body: Record<string, unknown> = {
    type: qForm.type,
    text: qForm.text,
    marks: parseFloat(qForm.marks),
    modelAnswer:
      qForm.type === 'THEORY' || qForm.type === 'FILL_IN_BLANK' ? qForm.modelAnswer : null,
  };
  if (qForm.type !== 'THEORY' && qForm.type !== 'FILL_IN_BLANK') {
    if (qForm.type === 'TRUE_FALSE') {
      body.options = [
        { text: 'True', isCorrect: qForm.options[0]?.isCorrect ?? true },
        { text: 'False', isCorrect: qForm.options[1]?.isCorrect ?? false },
      ];
    } else {
      body.options = qForm.options.filter((o) => o.text.trim());
    }
  }
  return body;
}

function statusAccent(status: string) {
  if (status === 'PUBLISHED') return 'from-emerald-600 via-primary-800 to-primary-900';
  if (status === 'CLOSED') return 'from-slate-700 via-slate-800 to-slate-900';
  return 'from-amber-600 via-primary-900 to-slate-900';
}

export default function OnlineExamDetailPage() {
  const params = useParams();
  const examId = params.id as string;
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabId>('questions');
  const [qModal, setQModal] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [gradeModal, setGradeModal] = useState<string | null>(null);
  const [savingGrades, setSavingGrades] = useState(false);
  const [gradeAnswers, setGradeAnswers] = useState<Record<string, { marks: string; feedback: string }>>({});
  const [resultsData, setResultsData] = useState<{ exam: ExamDetail; pendingManualCount: number } | null>(null);
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [savingExam, setSavingExam] = useState(false);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [terms, setTerms] = useState<TermItem[]>([]);
  const [examForm, setExamForm] = useState({
    title: '',
    description: '',
    instructions: '',
    durationMinutes: '45',
    classId: '',
    subjectId: '',
    termId: '',
    assessmentType: 'EXAM' as 'TEST' | 'EXAM',
  });

  const [qForm, setQForm] = useState({
    type: 'MCQ_SINGLE',
    text: '',
    marks: '2',
    modelAnswer: '',
    options: [
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
    ],
  });

  const fetchExam = useCallback(async () => {
    const token = getToken();
    const res = await fetch(`${API}/online-exams/${examId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setExam(await res.json());
    else setError('Failed to load exam');
    setLoading(false);
  }, [examId]);

  const fetchResults = useCallback(async () => {
    const token = getToken();
    const res = await fetch(`${API}/online-exams/${examId}/results`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setResultsData(await res.json());
  }, [examId]);

  useEffect(() => {
    fetchExam();
  }, [fetchExam]);

  useEffect(() => {
    const token = getToken();
    Promise.all([
      fetch(`${API}/classes?limit=100`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`${API}/subjects`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`${API}/terms`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ]).then(([classesData, subjectsData, termsData]) => {
      setClasses(classesData.classes ?? classesData ?? []);
      setSubjects(subjectsData.subjects ?? subjectsData ?? []);
      setTerms(termsData.terms ?? []);
    });
  }, []);

  useEffect(() => {
    if (tab !== 'questions') fetchResults();
  }, [tab, fetchResults]);

  const stats = useMemo(() => {
    if (!exam) return null;
    const theoryCount = exam.questions.filter((q) => q.type === 'THEORY').length;
    const mcqCount = exam.questions.length - theoryCount;
    const graded = exam.attempts.filter((a) => a.status === 'GRADED').length;
    const pending = exam.attempts.filter((a) => a.status === 'SUBMITTED').length;
    return {
      questions: exam.questions.length,
      totalMarks: exam.totalMarks,
      attempts: exam.attempts.length,
      theoryCount,
      mcqCount,
      graded,
      pending,
    };
  }, [exam]);

  const canEdit = exam != null && exam.status !== 'CLOSED';

  const openExamModal = () => {
    if (!exam) return;
    setExamForm({
      title: exam.title,
      description: exam.description ?? '',
      instructions: exam.instructions ?? '',
      durationMinutes: String(exam.durationMinutes),
      classId: exam.class.id,
      subjectId: exam.subject.id,
      termId: exam.term.id,
      assessmentType: exam.assessmentType ?? 'EXAM',
    });
    setExamModalOpen(true);
  };

  const saveExamDetails = async () => {
    if (!examForm.title.trim()) {
      alert('Title is required.');
      return;
    }
    setSavingExam(true);
    const token = getToken();
    try {
      const res = await fetch(`${API}/online-exams/${examId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: examForm.title,
          description: examForm.description || null,
          instructions: examForm.instructions || null,
          durationMinutes: parseInt(examForm.durationMinutes, 10),
          classId: examForm.classId,
          subjectId: examForm.subjectId,
          termId: examForm.termId,
          assessmentType: examForm.assessmentType,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Failed to update exam');
      }
      setExamModalOpen(false);
      fetchExam();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update exam');
    } finally {
      setSavingExam(false);
    }
  };

  const resetQForm = () => {
    setQForm({
      type: 'MCQ_SINGLE',
      text: '',
      marks: '2',
      modelAnswer: '',
      options: defaultMcqOptions(),
    });
  };

  const handleQuestionTypeChange = (type: string) => {
    setQForm((prev) => ({
      ...prev,
      type,
      options: optionsForQuestionType(type),
      modelAnswer: type === 'THEORY' || type === 'FILL_IN_BLANK' ? prev.modelAnswer : '',
    }));
  };

  const openAddModal = () => {
    setEditingQuestionId(null);
    resetQForm();
    setQModal(true);
  };

  const openEditModal = (q: ExamQuestion) => {
    setEditingQuestionId(q.id);
    setQForm(questionToForm(q));
    setQModal(true);
  };

  const closeQuestionModal = () => {
    setQModal(false);
    setEditingQuestionId(null);
    resetQForm();
  };

  const saveQuestion = async () => {
    if (!qForm.text.trim()) {
      alert('Please enter the question text.');
      return;
    }
    if (qForm.type === 'FILL_IN_BLANK' && !qForm.modelAnswer.trim()) {
      alert('Please enter the correct answer for this fill-in-the-blank question.');
      return;
    }
    setAddingQuestion(true);
    const token = getToken();
    const isEdit = editingQuestionId != null;
    try {
      const body = buildQuestionBody(qForm);
      const res = await fetch(
        isEdit
          ? `${API}/online-exams/${examId}/questions/${editingQuestionId}`
          : `${API}/online-exams/${examId}/questions`,
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || `Failed to ${isEdit ? 'update' : 'add'} question`);
      }
      closeQuestionModal();
      fetchExam();
    } catch (e) {
      alert(e instanceof Error ? e.message : `Failed to ${isEdit ? 'update' : 'add'} question`);
    } finally {
      setAddingQuestion(false);
    }
  };

  const deleteQuestion = async (qId: string) => {
    if (!confirm('Delete this question?')) return;
    const token = getToken();
    await fetch(`${API}/online-exams/${examId}/questions/${qId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchExam();
  };

  const publishExam = async () => {
    const token = getToken();
    const res = await fetch(`${API}/online-exams/${examId}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const d = await res.json();
      alert(d.message || 'Failed to publish');
      return;
    }
    fetchExam();
  };

  const closeExam = async () => {
    const token = getToken();
    await fetch(`${API}/online-exams/${examId}/close`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchExam();
  };

  const releaseResults = async () => {
    const token = getToken();
    const res = await fetch(`${API}/online-exams/${examId}/release-results`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      alert('Failed to release results');
      return;
    }
    fetchExam();
  };

  const hideResults = async () => {
    const token = getToken();
    const res = await fetch(`${API}/online-exams/${examId}/hide-results`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      alert('Failed to hide results');
      return;
    }
    fetchExam();
  };

  const submitGrades = async (attemptId: string) => {
    setSavingGrades(true);
    const token = getToken();
    try {
      const answers = Object.entries(gradeAnswers).map(([questionId, v]) => ({
        questionId,
        marksAwarded: parseFloat(v.marks),
        feedback: v.feedback || null,
      }));
      const res = await fetch(`${API}/online-exams/${examId}/attempts/${attemptId}/grade`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error('Failed to save grades');
      setGradeModal(null);
      setGradeAnswers({});
      fetchResults();
      fetchExam();
    } catch {
      alert('Failed to save grades');
    } finally {
      setSavingGrades(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-7 h-7 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!exam) return <Alert type="error" message={error || 'Exam not found'} />;

  const attempts = resultsData?.exam.attempts ?? exam.attempts;
  const pendingManual = resultsData?.pendingManualCount ?? 0;

  return (
    <div className="animate-fade-in space-y-4 px-4 py-4 sm:px-6 md:px-8 max-w-[1100px] mx-auto min-h-full">
      {/* Hero header */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <div className={`relative h-24 sm:h-28 bg-gradient-to-br ${statusAccent(exam.status)}`}>
          <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_15%_25%,white_0%,transparent_55%)]" />
          <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              {statusBadge(exam.status)}
              {exam.resultsReleased && (
                <Badge variant="info">Results released</Badge>
              )}
              {pendingManual > 0 && (
                <Badge variant="warning">{pendingManual} need marking</Badge>
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight line-clamp-2">{exam.title}</h1>
          </div>
        </div>

        <div className="px-4 sm:px-5 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-gray-50">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1 font-medium text-gray-700">
              <Users className="w-3.5 h-3.5 text-gray-400" />
              {exam.class.name}
            </span>
            <span className="text-gray-300 hidden sm:inline">·</span>
            <span className="inline-flex items-center gap-1">
              <ClipboardList className="w-3.5 h-3.5 text-gray-400" />
              {exam.subject.name}
            </span>
            <span className="text-gray-300 hidden sm:inline">·</span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              {exam.durationMinutes} min
            </span>
            <span className="text-gray-300 hidden sm:inline">·</span>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium border ${
                exam.assessmentType === 'TEST'
                  ? 'bg-amber-50 text-amber-800 border-amber-100'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-100'
              }`}
            >
              {exam.assessmentType === 'TEST' ? 'Class test' : 'Exam'}
            </span>
            <span className="text-gray-300 hidden sm:inline">·</span>
            <span className="tabular-nums font-medium text-primary-700">{exam.totalMarks} marks</span>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <Link href="/online-exams">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
            </Link>
            {canEdit && (
              <Button variant="secondary" size="sm" onClick={openExamModal}>
                <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit exam
              </Button>
            )}
            {exam.status === 'DRAFT' && (
              <Button variant="primary" size="sm" onClick={publishExam}>
                Publish exam
              </Button>
            )}
            {exam.status === 'PUBLISHED' && (
              <>
                {!exam.resultsReleased ? (
                  <Button variant="primary" size="sm" onClick={releaseResults}>
                    Release results
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" onClick={hideResults}>
                    Hide results
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={closeExam}>
                  Close exam
                </Button>
              </>
            )}
            {exam.status === 'CLOSED' && !exam.resultsReleased && (
              <Button variant="primary" size="sm" onClick={releaseResults}>
                Release results
              </Button>
            )}
            {exam.status === 'CLOSED' && exam.resultsReleased && (
              <Button variant="secondary" size="sm" onClick={hideResults}>
                Hide results
              </Button>
            )}
          </div>
        </div>
      </div>

      {exam.description && (
        <p className="text-xs text-gray-500 leading-relaxed px-1">{exam.description}</p>
      )}

      {exam.status === 'PUBLISHED' && canEdit && (
        <p className="text-xs text-primary-700 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2">
          This exam is live. You can still edit details and questions; students who have not started will see the updates.
        </p>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Questions" value={String(stats.questions)} sub={`${stats.mcqCount} auto · ${stats.theoryCount} theory`} icon={HelpCircle} accent="primary" />
          <StatCard label="Total marks" value={String(stats.totalMarks)} icon={BarChart3} accent="slate" />
          <StatCard label="Attempts" value={String(stats.attempts)} sub={`${stats.graded} graded`} icon={Users} accent="success" />
          <StatCard
            label="Pending"
            value={String(stats.pending)}
            sub={pendingManual ? `${pendingManual} theory to mark` : 'Awaiting submission'}
            icon={Pencil}
            accent="warning"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0.5 bg-gray-100 p-0.5 rounded-lg w-fit border border-gray-100">
        {(['questions', 'results', 'grading'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {TAB_LABELS[t]}
            {t === 'grading' && stats && stats.pending > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-warning-100 text-warning-800 text-[10px] font-bold">
                {stats.pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Questions tab */}
      {tab === 'questions' && (
        <div className="space-y-3">
          {canEdit && (
            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={openAddModal}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add question
              </Button>
            </div>
          )}

          {exam.questions.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-11 h-11 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center mb-3">
                  <Sparkles className="w-5 h-5 text-primary-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">No questions yet</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-sm leading-relaxed">
                  Add multiple-choice or theory questions. MCQ items are auto-marked; theory answers need manual grading.
                </p>
                {canEdit && (
                  <Button variant="primary" size="sm" className="mt-4" onClick={openAddModal}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add your first question
                  </Button>
                )}
              </div>
            </div>
          ) : (
            exam.questions.map((q, i) => {
              const TypeIcon = questionTypeIcon(q.type);
              return (
                <article
                  key={q.id}
                  className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden hover:border-gray-200/80 transition-colors"
                >
                  <div className="flex items-start gap-3 p-3 sm:p-4">
                    <div className="shrink-0 w-8 h-8 rounded-lg bg-primary-50 border border-primary-100 flex items-center justify-center text-xs font-bold text-primary-800 tabular-nums">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-50 text-gray-600 text-[10px] font-medium border border-gray-100">
                          <TypeIcon className="w-3 h-3" />
                          {questionTypeLabel(q.type)}
                        </span>
                        <span className="text-[10px] font-semibold text-primary-700 tabular-nums">
                          {q.marks} mark{q.marks !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 leading-snug">{q.text}</p>

                      {q.options.length > 0 && (
                        <ul className="mt-2.5 space-y-1">
                          {q.options.map((o) => (
                            <li
                              key={o.id}
                              className={`flex items-start gap-2 text-xs rounded-lg px-2 py-1.5 ${
                                o.isCorrect
                                  ? 'bg-success-50 text-success-800 border border-success-100'
                                  : 'bg-gray-50 text-gray-600 border border-transparent'
                              }`}
                            >
                              {o.isCorrect ? (
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-success-600" />
                              ) : (
                                <span className="w-3.5 h-3.5 shrink-0 mt-0.5 rounded-full border border-gray-300" />
                              )}
                              <span className="leading-snug">{o.text}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {q.modelAnswer && (q.type === 'THEORY' || q.type === 'FILL_IN_BLANK') && (
                        <p className="text-xs text-gray-500 mt-2.5 pt-2 border-t border-gray-50">
                          <span className="font-medium text-gray-600">
                            {q.type === 'FILL_IN_BLANK' ? 'Correct answer:' : 'Model answer:'}
                          </span>{' '}
                          {q.modelAnswer}
                        </p>
                      )}
                    </div>

                    {canEdit && (
                      <div className="shrink-0 flex gap-0.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(q)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-primary-700 hover:bg-primary-50 transition-colors"
                          aria-label="Edit question"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteQuestion(q.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
                          aria-label="Delete question"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      {/* Results & Grading */}
      {(tab === 'results' || tab === 'grading') && (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
          {attempts.length === 0 ? (
            <div className="py-12 text-center px-4">
              <Users className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No student attempts yet.</p>
              {exam.status === 'DRAFT' && (
                <p className="text-xs text-gray-400 mt-1">Publish the exam for students to take it.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80 text-left border-b border-gray-100">
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Score</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    {tab === 'grading' && <th className="px-4 py-2.5" />}
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => (
                    <tr key={a.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 text-xs">
                          {a.student.firstName} {a.student.lastName}
                        </p>
                        <p className="text-[11px] text-gray-400 font-mono">{a.student.studentId}</p>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-xs font-semibold text-gray-800">
                        {a.score != null ? (
                          <span>
                            {a.score}
                            <span className="text-gray-400 font-normal"> / {exam.totalMarks}</span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={a.status === 'GRADED' ? 'success' : 'warning'}>
                          {a.status === 'GRADED' ? 'Graded' : a.status === 'SUBMITTED' ? 'Submitted' : a.status}
                        </Badge>
                      </td>
                      {tab === 'grading' && (
                        <td className="px-4 py-3 text-right">
                          {a.status === 'SUBMITTED' && (
                            <Button size="sm" variant="secondary" onClick={() => setGradeModal(a.id)}>
                              <Pencil className="w-3.5 h-3.5 mr-1" /> Grade
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add / edit question modal */}
      {qModal && (
        <Modal
          isOpen
          onClose={closeQuestionModal}
          title={editingQuestionId ? 'Edit question' : 'Add question'}
          size="lg"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={closeQuestionModal}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={saveQuestion} loading={addingQuestion}>
                {editingQuestionId ? (
                  <>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Save changes
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add question
                  </>
                )}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <FormField label="Question type" required>
              <div className="relative">
                <select
                  className={selectClass}
                  value={qForm.type}
                  onChange={(e) => handleQuestionTypeChange(e.target.value)}
                >
                  <option value="MCQ_SINGLE">Multiple choice (single answer)</option>
                  <option value="MCQ_MULTIPLE">Multiple choice (multiple answers)</option>
                  <option value="TRUE_FALSE">True / False</option>
                  <option value="FILL_IN_BLANK">Fill in the blank (auto-marked)</option>
                  <option value="THEORY">Theory (manual marking)</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </FormField>

            <FormField
              label="Question text"
              required
              hint={
                qForm.type === 'FILL_IN_BLANK'
                  ? 'Use underscores for the blank, e.g. A noun is a _______ of a person.'
                  : undefined
              }
            >
              <textarea
                className={`${fieldInput} min-h-[72px] resize-y`}
                value={qForm.text}
                onChange={(e) => setQForm({ ...qForm, text: e.target.value })}
                placeholder="Enter the question…"
                rows={3}
              />
            </FormField>

            <FormField label="Marks" required>
              <input
                type="number"
                min="0"
                step="0.5"
                className={`${fieldInput} tabular-nums max-w-[120px]`}
                value={qForm.marks}
                onChange={(e) => setQForm({ ...qForm, marks: e.target.value })}
              />
            </FormField>

            {qForm.type === 'THEORY' ? (
              <FormField label="Model answer" hint="Reference for graders — not shown to students during the exam.">
                <textarea
                  className={`${fieldInput} min-h-[64px] resize-y`}
                  value={qForm.modelAnswer}
                  onChange={(e) => setQForm({ ...qForm, modelAnswer: e.target.value })}
                  rows={2}
                />
              </FormField>
            ) : qForm.type === 'FILL_IN_BLANK' ? (
              <FormField
                label="Correct answer"
                required
                hint="Auto-marked. Separate multiple acceptable answers with | (e.g. name|names)."
              >
                <input
                  className={fieldInput}
                  value={qForm.modelAnswer}
                  onChange={(e) => setQForm({ ...qForm, modelAnswer: e.target.value })}
                  placeholder="e.g. name"
                />
              </FormField>
            ) : qForm.type === 'TRUE_FALSE' ? (
              <FormField label="Correct answer" hint="Select whether the statement is true or false.">
                <div className="grid grid-cols-2 gap-2">
                  {(['True', 'False'] as const).map((label, i) => {
                    const selected = qForm.options[i]?.isCorrect ?? i === 0;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() =>
                          setQForm({
                            ...qForm,
                            options: [
                              { text: 'True', isCorrect: label === 'True' },
                              { text: 'False', isCorrect: label === 'False' },
                            ],
                          })
                        }
                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                          selected
                            ? 'border-primary-400 bg-primary-50 text-primary-800 ring-2 ring-primary-400/25'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {selected ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 shrink-0 text-gray-300" />
                        )}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </FormField>
            ) : (
              <FormField label="Answer options" hint="Mark the correct option(s).">
                <div className="space-y-2">
                  {qForm.options.map((o, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        type={qForm.type === 'MCQ_MULTIPLE' ? 'checkbox' : 'radio'}
                        name="correct"
                        checked={o.isCorrect}
                        className="shrink-0 accent-primary-600"
                        onChange={() => {
                          const opts = qForm.options.map((opt, j) => ({
                            ...opt,
                            isCorrect:
                              qForm.type === 'MCQ_MULTIPLE'
                                ? j === i
                                  ? !opt.isCorrect
                                  : opt.isCorrect
                                : j === i,
                          }));
                          setQForm({ ...qForm, options: opts });
                        }}
                      />
                      <input
                        className={fieldInput}
                        value={o.text}
                        placeholder={`Option ${i + 1}`}
                        onChange={(e) => {
                          const opts = [...qForm.options];
                          opts[i] = { ...opts[i], text: e.target.value };
                          setQForm({ ...qForm, options: opts });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </FormField>
            )}
          </div>
        </Modal>
      )}

      {/* Grade modal */}
      {gradeModal && resultsData && (
        <Modal
          isOpen
          onClose={() => setGradeModal(null)}
          title="Grade theory answers"
          size="lg"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setGradeModal(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={() => submitGrades(gradeModal)} loading={savingGrades}>
                Save grades
              </Button>
            </>
          }
        >
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            Award marks for each theory question. MCQ items were already auto-marked.
          </p>
          <div className="space-y-3">
            {resultsData.exam.questions
              .filter((q) => q.type === 'THEORY')
              .map((q) => (
                <div key={q.id} className="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                  <p className="text-sm font-medium text-gray-900 leading-snug">{q.text}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 mb-2 tabular-nums">Max {q.marks} marks</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <FormField label="Marks awarded">
                      <input
                        type="number"
                        min="0"
                        max={q.marks}
                        step="0.5"
                        className={`${fieldInput} tabular-nums`}
                        value={gradeAnswers[q.id]?.marks ?? ''}
                        onChange={(e) =>
                          setGradeAnswers({
                            ...gradeAnswers,
                            [q.id]: {
                              marks: e.target.value,
                              feedback: gradeAnswers[q.id]?.feedback ?? '',
                            },
                          })
                        }
                      />
                    </FormField>
                    <FormField label="Feedback (optional)">
                      <input
                        className={fieldInput}
                        value={gradeAnswers[q.id]?.feedback ?? ''}
                        onChange={(e) =>
                          setGradeAnswers({
                            ...gradeAnswers,
                            [q.id]: {
                              marks: gradeAnswers[q.id]?.marks ?? '',
                              feedback: e.target.value,
                            },
                          })
                        }
                      />
                    </FormField>
                  </div>
                </div>
              ))}
          </div>
        </Modal>
      )}

      {examModalOpen && (
        <Modal
          isOpen
          onClose={() => setExamModalOpen(false)}
          title="Edit exam"
          size="lg"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setExamModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={saveExamDetails} loading={savingExam}>
                <Pencil className="w-3.5 h-3.5 mr-1" /> Save changes
              </Button>
            </>
          }
        >
          {exam?.status === 'PUBLISHED' && (
            <p className="text-xs text-warning-800 bg-warning-50 border border-warning-100 rounded-lg px-3 py-2 mb-4">
              This exam is live. Changes apply immediately for students who have not submitted yet.
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <FormField label="Title" required>
                <input
                  className={fieldInput}
                  value={examForm.title}
                  onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
                  required
                />
              </FormField>
            </div>
            <FormField label="Class" required>
              <div className="relative">
                <select
                  className={selectClass}
                  value={examForm.classId}
                  onChange={(e) => setExamForm({ ...examForm, classId: e.target.value })}
                >
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </FormField>
            <FormField label="Subject" required>
              <div className="relative">
                <select
                  className={selectClass}
                  value={examForm.subjectId}
                  onChange={(e) => setExamForm({ ...examForm, subjectId: e.target.value })}
                >
                  <option value="">Select subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </FormField>
            <FormField label="Term" required>
              <div className="relative">
                <select
                  className={selectClass}
                  value={examForm.termId}
                  onChange={(e) => setExamForm({ ...examForm, termId: e.target.value })}
                >
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} {t.year}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </FormField>
            <FormField label="Duration (minutes)" required>
              <input
                type="number"
                min="1"
                className={`${fieldInput} tabular-nums`}
                value={examForm.durationMinutes}
                onChange={(e) => setExamForm({ ...examForm, durationMinutes: e.target.value })}
              />
            </FormField>
            <FormField label="Assessment type" required>
              <div className="relative">
                <select
                  className={selectClass}
                  value={examForm.assessmentType}
                  onChange={(e) =>
                    setExamForm({ ...examForm, assessmentType: e.target.value as 'TEST' | 'EXAM' })
                  }
                >
                  <option value="TEST">Class test</option>
                  <option value="EXAM">Exam</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Description">
                <textarea
                  className={`${fieldInput} min-h-[64px] resize-y`}
                  value={examForm.description}
                  onChange={(e) => setExamForm({ ...examForm, description: e.target.value })}
                  rows={2}
                />
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="Instructions">
                <textarea
                  className={`${fieldInput} min-h-[64px] resize-y`}
                  value={examForm.instructions}
                  onChange={(e) => setExamForm({ ...examForm, instructions: e.target.value })}
                  rows={2}
                />
              </FormField>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
