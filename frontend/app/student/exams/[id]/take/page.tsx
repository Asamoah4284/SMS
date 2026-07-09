'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Alert, Button } from '@/components/ui';
import { StudentPortalShell } from '@/components/student/StudentPortalShell';
import {
  Loader2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Send,
  AlertTriangle,
  Play,
  CheckCircle2,
  BookOpen,
  FileText,
  HelpCircle,
  Timer,
  LayoutGrid,
  LogOut,
  ArrowLeft,
  PenLine,
  ListChecks,
} from 'lucide-react';
import Link from 'next/link';

function getStudentToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('studentToken') : '';
}
const API = process.env.NEXT_PUBLIC_API_URL;

function formatDuration(minutes: number) {
  if (minutes === 1) return '1 minute';
  return `${minutes} minutes`;
}

function formatQuestionCount(count: number) {
  if (count === 1) return '1 question';
  return `${count} questions`;
}

function questionTypeLabel(type: string) {
  const map: Record<string, string> = {
    MCQ_SINGLE: 'Multiple choice',
    MCQ_MULTIPLE: 'Select all that apply',
    THEORY: 'Written answer',
    FILL_IN_BLANK: 'Fill in the blank',
  };
  return map[type] ?? type.replace(/_/g, ' ');
}

function optionLetter(index: number) {
  return String.fromCharCode(65 + index);
}

interface Question {
  id: string;
  type: string;
  text: string;
  marks: number;
  options: { id: string; text: string }[];
}

export default function TakeExamPage() {
  const params = useParams();
  const examId = params.id as string;
  const router = useRouter();
  const [exam, setExam] = useState<{
    title: string;
    description: string | null;
    instructions: string | null;
    durationMinutes: number;
    assessmentType?: 'TEST' | 'EXAM';
    subject?: string;
    questions: Question[];
    attempt: { id: string; status: string; startedAt?: string } | null;
  } | null>(null);
  const [answers, setAnswers] = useState<Record<string, { selectedOptionIds?: string[]; textAnswer?: string }>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [started, setStarted] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submittedRef = useRef(false);

  const questions =
    exam?.questions && Array.isArray(exam.questions) ? exam.questions : [];

  useEffect(() => {
    if (!started) return;
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [started]);

  const submitExam = useCallback(async () => {
    if (submittedRef.current || !attemptId) return;
    submittedRef.current = true;
    setSubmitting(true);
    const token = getStudentToken();
    const payload = Object.entries(answers).map(([questionId, v]) => ({
      questionId,
      selectedOptionIds: v.selectedOptionIds || [],
      textAnswer: v.textAnswer || null,
    }));
    const res = await fetch(`${API}/student-portal/exams/${examId}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: payload }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error || 'Submit failed');
      submittedRef.current = false;
      return;
    }
    router.push('/student/dashboard');
  }, [answers, attemptId, examId, router]);

  useEffect(() => {
    const token = getStudentToken();
    if (!token) {
      router.replace('/student/login');
      return;
    }

    // Reset session when opening a different exam
    setStarted(false);
    setCurrentQ(0);
    setAttemptId(null);
    setAnswers({});
    setError('');
    setSecondsLeft(0);
    setSubmitting(false);
    submittedRef.current = false;
    setLoading(true);

    fetch(`${API}/student-portal/exams/${examId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed to load exam');
        return r.json();
      })
      .then((d) => {
        const loadedQuestions = Array.isArray(d.questions) ? d.questions : [];
        setExam({ ...d, questions: loadedQuestions });

        if (d.attempt?.status && d.attempt.status !== 'IN_PROGRESS') {
          router.replace('/student/dashboard');
          return;
        }

        // Resume an in-progress attempt
        if (d.attempt?.status === 'IN_PROGRESS' && loadedQuestions.length > 0) {
          setAttemptId(d.attempt.id);
          const startedAt = d.attempt.startedAt ? new Date(d.attempt.startedAt).getTime() : Date.now();
          const durationMs = (d.durationMinutes ?? 45) * 60 * 1000;
          const left = Math.max(0, Math.floor((startedAt + durationMs - Date.now()) / 1000));
          if (left > 0) {
            setSecondsLeft(left);
            setStarted(true);
          } else {
            setError('Your time for this exam has expired. Contact your teacher if you need help.');
          }
        }
      })
      .catch(() => setError('Failed to load exam'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  useEffect(() => {
    if (started && questions.length > 0 && currentQ >= questions.length) {
      setCurrentQ(0);
    }
  }, [started, questions.length, currentQ]);

  useEffect(() => {
    if (!started || secondsLeft <= 0) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          submitExam();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [started, secondsLeft, submitExam]);

  const beginExam = async () => {
    if (!questions.length) {
      setError('This exam has no questions yet. Please contact your teacher.');
      return;
    }

    const token = getStudentToken();
    const res = await fetch(`${API}/student-portal/exams/${examId}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Could not start');
      return;
    }

    // Refresh exam data so questions are guaranteed present
    const examRes = await fetch(`${API}/student-portal/exams/${examId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (examRes.ok) {
      const examData = await examRes.json();
      const loadedQuestions = Array.isArray(examData.questions) ? examData.questions : [];
      if (!loadedQuestions.length) {
        setError('This exam has no questions yet. Please contact your teacher.');
        return;
      }
      setExam({ ...examData, questions: loadedQuestions });
    }

    setCurrentQ(0);
    setAttemptId(data.attemptId);
    setSecondsLeft((data.durationMinutes ?? exam?.durationMinutes ?? 45) * 60);
    setStarted(true);
    setError('');
  };

  const toggleOption = (questionId: string, optionId: string, multi: boolean) => {
    setAnswers((prev) => {
      const cur = prev[questionId]?.selectedOptionIds || [];
      let next: string[];
      if (multi) {
        next = cur.includes(optionId) ? cur.filter((id) => id !== optionId) : [...cur, optionId];
      } else {
        next = [optionId];
      }
      return { ...prev, [questionId]: { ...prev[questionId], selectedOptionIds: next } };
    });
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const isAnswered = (q: Question) => {
    const a = answers[q.id];
    if (q.type === 'THEORY' || q.type === 'FILL_IN_BLANK') return Boolean(a?.textAnswer?.trim());
    return Boolean(a?.selectedOptionIds?.length);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!exam) {
    return (
      <StudentPortalShell backHref="/student/dashboard" backLabel="Dashboard">
        <Alert type="error" message={error || 'Exam not found'} />
      </StudentPortalShell>
    );
  }

  // Pre-start screen
  if (!started) {
    const isTest = exam.assessmentType === 'TEST';
    const typeLabel = isTest ? 'Class test' : 'Exam';
    const beginLabel = isTest ? 'Begin class test' : 'Begin exam';
    const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

    return (
      <StudentPortalShell backHref="/student/dashboard" backLabel="Dashboard">
        <div className="max-w-md mx-auto">
          <article className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div
              className={`h-1 ${
                isTest
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                  : 'bg-gradient-to-r from-primary-500 to-indigo-500'
              }`}
            />

            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {exam.subject && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-50 text-gray-600 text-[11px] font-medium border border-gray-100">
                    <BookOpen className="w-3 h-3 shrink-0" />
                    {exam.subject}
                  </span>
                )}
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                    isTest
                      ? 'bg-amber-50 text-amber-800 border-amber-100'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                  }`}
                >
                  {typeLabel}
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight leading-snug">
                {exam.title}
              </h1>

              {exam.description && (
                <p className="text-sm text-gray-500 mt-2 leading-relaxed line-clamp-3">{exam.description}</p>
              )}

              <div className="grid grid-cols-3 gap-2.5 mt-5">
                <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 text-center">
                  <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center mx-auto mb-1.5">
                    <Timer className="w-4 h-4 text-primary-600" />
                  </div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Time</p>
                  <p className="text-xs font-bold text-gray-800 mt-0.5 tabular-nums">{formatDuration(exam.durationMinutes)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 text-center">
                  <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center mx-auto mb-1.5">
                    <HelpCircle className="w-4 h-4 text-primary-600" />
                  </div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Questions</p>
                  <p className="text-xs font-bold text-gray-800 mt-0.5 tabular-nums">{questions.length}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 text-center">
                  <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center mx-auto mb-1.5">
                    <FileText className="w-4 h-4 text-primary-600" />
                  </div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Marks</p>
                  <p className="text-xs font-bold text-gray-800 mt-0.5 tabular-nums">{totalMarks || '—'}</p>
                </div>
              </div>

              {exam.instructions && (
                <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Instructions
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{exam.instructions}</p>
                </div>
              )}

              <div className="mt-5 flex items-start gap-3 p-3.5 rounded-xl bg-amber-50/80 border border-amber-100">
                <div className="w-8 h-8 rounded-lg bg-amber-100/80 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-amber-900">Before you start</p>
                  <p className="text-xs text-amber-800/90 mt-1 leading-relaxed">
                    The timer starts as soon as you begin. Your answers are submitted automatically when time runs out.
                  </p>
                </div>
              </div>

              {error && <Alert type="error" message={error} className="mt-4" />}

              {questions.length === 0 && (
                <div className="mt-4 flex items-start gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                  <AlertTriangle className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-600 leading-relaxed">
                    This {isTest ? 'test' : 'exam'} has no questions yet. Your teacher must add questions and publish it
                    before you can start.
                  </p>
                </div>
              )}

              <Button
                onClick={beginExam}
                className="w-full mt-5"
                size="lg"
                disabled={questions.length === 0}
              >
                <Play className="w-4 h-4 mr-2" />
                {beginLabel}
              </Button>

              <p className="text-[11px] text-center text-gray-400 mt-3">
                {formatQuestionCount(questions.length)} · {formatDuration(exam.durationMinutes)}
              </p>
            </div>
          </article>
        </div>
      </StudentPortalShell>
    );
  }

  if (started) {
    const safeIndex = Math.min(currentQ, Math.max(0, questions.length - 1));
    const q = questions[safeIndex];

    if (!q) {
      return (
        <StudentPortalShell backHref="/student/dashboard" backLabel="Dashboard">
          <div className="max-w-md mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center space-y-4">
            <Alert type="error" message="This exam has no questions available." />
            <Button variant="secondary" onClick={() => setStarted(false)}>
              Go back
            </Button>
          </div>
        </StudentPortalShell>
      );
    }

    const isTheory = q.type === 'THEORY';
    const isFillIn = q.type === 'FILL_IN_BLANK';
    const isMulti = q.type === 'MCQ_MULTIPLE';
    const answeredCount = questions.filter(isAnswered).length;
    const timerUrgent = secondsLeft < 300;
    const timerCritical = secondsLeft < 60;
    const progressPct = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;
    const isLastQuestion = safeIndex === questions.length - 1;
    const isTest = exam.assessmentType === 'TEST';

    const signOut = () => {
      localStorage.removeItem('studentToken');
      localStorage.removeItem('studentUser');
      localStorage.removeItem('studentMustChangePin');
      router.push('/student/login');
    };

    const questionNavButton = (question: Question, i: number) => {
      const active = i === safeIndex;
      const done = isAnswered(question);
      return (
        <button
          key={question.id}
          type="button"
          onClick={() => setCurrentQ(i)}
          title={`Question ${i + 1}${done ? ' (answered)' : ''}`}
          className={`relative w-8 h-8 rounded-lg text-xs font-bold transition-all ${
            active
              ? 'bg-primary-600 text-white shadow-md shadow-primary-600/25 ring-2 ring-primary-600/20'
              : done
                ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-200 hover:border-emerald-300'
                : 'bg-white text-gray-500 border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          {i + 1}
          {done && !active && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
          )}
        </button>
      );
    };

    return (
      <div className="h-dvh h-screen flex flex-col overflow-hidden bg-[#f4f6fb]">
        {/* Quiz header */}
        <header className="shrink-0 z-40 bg-white border-b border-gray-200/80 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-12 sm:h-14 flex items-center gap-3">
            <Link
              href="/student/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-primary-700 transition-colors shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exit</span>
            </Link>

            <div className="flex-1 min-w-0 text-center px-2">
              <p className="text-sm font-bold text-gray-900 truncate leading-tight">{exam.title}</p>
              <p className="text-[11px] text-gray-500 truncate mt-0.5">
                {exam.subject && <span>{exam.subject} · </span>}
                Question {safeIndex + 1} of {questions.length}
              </p>
            </div>

            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold tabular-nums border shrink-0 ${
                timerCritical
                  ? 'bg-red-50 text-red-700 border-red-200 animate-pulse'
                  : timerUrgent
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-primary-50 text-primary-800 border-primary-100'
              }`}
            >
              <Clock className="w-4 h-4" />
              {formatTime(secondsLeft)}
            </div>

            <button
              type="button"
              onClick={signOut}
              className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>

          <div className="h-1 bg-gray-100">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-indigo-500 transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </header>

        <div className="flex-1 min-h-0 max-w-6xl mx-auto w-full px-4 sm:px-6 py-2 sm:py-3 flex gap-4 lg:gap-5 overflow-hidden">
          {/* Sidebar navigator — desktop */}
          <aside className="hidden lg:flex w-56 shrink-0 flex-col min-h-0 overflow-y-auto">
            <div className="space-y-3">
              <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-3.5">
                <div className="flex items-center gap-2 mb-2.5">
                  <LayoutGrid className="w-4 h-4 text-primary-600" />
                  <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Questions</h2>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {questions.map((question, i) => questionNavButton(question, i))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-500">Answered</span>
                    <span className="font-bold text-gray-800 tabular-nums">
                      {answeredCount}/{questions.length}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Type</span>
                  <span className="font-semibold text-gray-800">{isTest ? 'Class test' : 'Exam'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Time left</span>
                  <span className={`font-bold tabular-nums ${timerUrgent ? 'text-amber-700' : 'text-gray-800'}`}>
                    {formatTime(secondsLeft)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Progress</span>
                  <span className="font-bold text-primary-700 tabular-nums">{progressPct}%</span>
                </div>
              </div>
            </div>
          </aside>

          {/* Main question area */}
          <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Mobile question strip */}
            <div className="lg:hidden shrink-0 mb-2 -mx-1 px-1 overflow-x-auto scrollbar-hide">
              <div className="flex gap-1.5 pb-0.5 min-w-min">
                {questions.map((question, i) => questionNavButton(question, i))}
              </div>
            </div>

            <article
              key={q.id}
              className="bg-white rounded-2xl border border-gray-200/80 shadow-md overflow-hidden flex-1 min-h-0 flex flex-col"
            >
              {/* Question header */}
              <div className="shrink-0 px-4 sm:px-5 py-2.5 sm:py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50/80 to-white flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary-600 text-white flex items-center justify-center text-sm font-bold shadow-sm shadow-primary-600/20">
                    {safeIndex + 1}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-primary-700 uppercase tracking-wide">
                      {questionTypeLabel(q.type)}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {q.marks} mark{q.marks !== 1 ? 's' : ''}
                      {isMulti && ' · Choose all correct answers'}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-gray-100 text-[10px] font-medium text-gray-600">
                  <ListChecks className="w-3 h-3" />
                  {answeredCount}/{questions.length} done
                </span>
              </div>

              {/* Question body — scrolls internally only when needed */}
              <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-3 sm:py-4">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 leading-snug mb-4">
                  {q.text}
                </h2>

                {isTheory ? (
                  <div className="space-y-2 h-full flex flex-col">
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-500">
                      <PenLine className="w-3.5 h-3.5" />
                      Your answer
                    </label>
                    <textarea
                      className="w-full flex-1 min-h-[120px] border-2 border-gray-200 rounded-xl p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 resize-none bg-gray-50/50 transition-colors"
                      value={answers[q.id]?.textAnswer || ''}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: { textAnswer: e.target.value } })}
                      placeholder="Write your answer here. Be clear and complete."
                    />
                    <p className="text-[10px] text-gray-400 shrink-0">
                      This question will be marked manually by your teacher.
                    </p>
                  </div>
                ) : isFillIn ? (
                  <div className="space-y-2 max-w-md">
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-500">
                      <PenLine className="w-3.5 h-3.5" />
                      Fill in the blank
                    </label>
                    <input
                      type="text"
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 bg-gray-50/50"
                      value={answers[q.id]?.textAnswer || ''}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: { textAnswer: e.target.value } })}
                      placeholder="Type your answer…"
                      autoComplete="off"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium text-gray-500">
                      {isMulti ? 'Select all correct options' : 'Select one option'}
                    </p>
                    {q.options.map((o, optIndex) => {
                      const selected = answers[q.id]?.selectedOptionIds?.includes(o.id);
                      const letter = optionLetter(optIndex);
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => toggleOption(q.id, o.id, isMulti)}
                          className={`group w-full flex items-center gap-3 text-left p-3 rounded-xl border-2 transition-all duration-150 ${
                            selected
                              ? 'border-primary-500 bg-primary-50/80 shadow-sm shadow-primary-500/10'
                              : 'border-gray-200 bg-white hover:border-primary-200 hover:bg-primary-50/30'
                          }`}
                        >
                          <span
                            className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
                              selected
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 text-gray-600 group-hover:bg-primary-100 group-hover:text-primary-700'
                            }`}
                          >
                            {selected ? <CheckCircle2 className="w-4 h-4" /> : letter}
                          </span>
                          <span className={`text-sm leading-snug flex-1 ${selected ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
                            {o.text}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </article>

            {error && <Alert type="error" message={error} className="mt-2 shrink-0" />}
          </main>
        </div>

        {/* Footer navigation */}
        <footer className="shrink-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              size="sm"
              disabled={safeIndex === 0}
              onClick={() => setCurrentQ((c) => Math.max(0, c - 1))}
              className="min-w-[100px]"
            >
              <ChevronLeft className="w-4 h-4 mr-0.5" />
              Previous
            </Button>

            <div className="text-center hidden sm:block">
              <p className="text-xs font-semibold text-gray-700">
                Question {safeIndex + 1} of {questions.length}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {answeredCount} answered · {questions.length - answeredCount} remaining
              </p>
            </div>

            {isLastQuestion ? (
              <Button
                size="sm"
                onClick={submitExam}
                loading={submitting}
                className="min-w-[120px] bg-emerald-600 hover:bg-emerald-700"
              >
                <Send className="w-4 h-4 mr-1.5" />
                Submit {isTest ? 'test' : 'exam'}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setCurrentQ((c) => Math.min(questions.length - 1, c + 1))}
                className="min-w-[100px]"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-0.5" />
              </Button>
            )}
          </div>
        </footer>
      </div>
    );
  }

  return null;
}
