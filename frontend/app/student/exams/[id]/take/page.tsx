'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Alert, Button, Badge } from '@/components/ui';
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
  Circle,
} from 'lucide-react';

function getStudentToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('studentToken') : '';
}
const API = process.env.NEXT_PUBLIC_API_URL;

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
    instructions: string | null;
    durationMinutes: number;
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
    if (q.type === 'THEORY') return Boolean(a?.textAnswer?.trim());
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
    return (
      <StudentPortalShell backHref="/student/dashboard" backLabel="Dashboard">
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden">
            <div className="h-24 bg-gradient-to-br from-primary-600 via-primary-800 to-indigo-900 relative">
              <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_30%_30%,white_0%,transparent_55%)]" />
              <div className="absolute inset-0 flex items-end p-5">
                <h1 className="text-lg font-bold text-white leading-snug">{exam.title}</h1>
              </div>
            </div>
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="info">
                  <Clock className="w-3 h-3 mr-1 inline" />
                  {exam.durationMinutes} minutes
                </Badge>
                <Badge variant="default">{questions.length} question{questions.length !== 1 ? 's' : ''}</Badge>
              </div>

              {exam.instructions && (
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Instructions</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{exam.instructions}</p>
                </div>
              )}

              <div className="flex items-start gap-2 p-3 rounded-xl bg-warning-50 border border-warning-100">
                <AlertTriangle className="w-4 h-4 text-warning-600 shrink-0 mt-0.5" />
                <p className="text-xs text-warning-800 leading-relaxed">
                  The timer starts when you begin. Your answers are submitted automatically when time runs out.
                </p>
              </div>

              {error && <Alert type="error" message={error} />}

              {questions.length === 0 && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <AlertTriangle className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-600 leading-relaxed">
                    This exam has no questions yet. Your teacher must add questions and publish the exam before you can start.
                  </p>
                </div>
              )}

              <Button
                onClick={beginExam}
                className="w-full"
                size="lg"
                disabled={questions.length === 0}
              >
                <Play className="w-4 h-4 mr-2" />
                Begin exam
              </Button>
            </div>
          </div>
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
    const isMulti = q.type === 'MCQ_MULTIPLE';
    const answeredCount = questions.filter(isAnswered).length;
    const timerUrgent = secondsLeft < 300;

  const timerBadge = (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums border ${
        timerUrgent
          ? 'bg-danger-50 text-danger-700 border-danger-200 animate-pulse'
          : 'bg-primary-50 text-primary-800 border-primary-100'
      }`}
    >
      <Clock className="w-3.5 h-3.5" />
      {formatTime(secondsLeft)}
    </div>
  );

  return (
    <StudentPortalShell
      backHref="/student/dashboard"
      backLabel="Exit"
      title={exam.title}
      subtitle={`Question ${safeIndex + 1} of ${questions.length}`}
      headerExtra={timerBadge}
    >
      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1.5">
          <span>{answeredCount} of {questions.length} answered</span>
          <span>{questions.length ? Math.round(((safeIndex + 1) / questions.length) * 100) : 0}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${questions.length ? ((safeIndex + 1) / questions.length) * 100 : 0}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {questions.map((question, i) => (
            <button
              key={question.id}
              type="button"
              onClick={() => setCurrentQ(i)}
              className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-all ${
                i === safeIndex
                  ? 'bg-primary-600 text-white shadow-sm'
                  : isAnswered(question)
                    ? 'bg-success-50 text-success-700 border border-success-200'
                    : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Question card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {q.type.replace(/_/g, ' ')}
          </span>
          <span className="text-[10px] font-bold text-primary-700 tabular-nums">
            {q.marks} mark{q.marks !== 1 ? 's' : ''}
          </span>
        </div>
        <p className="text-base sm:text-lg font-medium text-gray-900 leading-relaxed mb-5">{q.text}</p>

        {isTheory ? (
          <textarea
            className="w-full border border-gray-200 rounded-xl p-4 min-h-[140px] text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-400 resize-y"
            value={answers[q.id]?.textAnswer || ''}
            onChange={(e) => setAnswers({ ...answers, [q.id]: { textAnswer: e.target.value } })}
            placeholder="Type your answer here…"
          />
        ) : (
          <div className="space-y-2">
            {q.options.map((o) => {
              const selected = answers[q.id]?.selectedOptionIds?.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggleOption(q.id, o.id, isMulti)}
                  className={`w-full flex items-center gap-3 text-left p-3.5 rounded-xl border transition-all ${
                    selected
                      ? 'border-primary-400 bg-primary-50 ring-2 ring-primary-400/20'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/80'
                  }`}
                >
                  {selected ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-primary-600" />
                  ) : (
                    <Circle className="w-5 h-5 shrink-0 text-gray-300" />
                  )}
                  <span className="text-sm text-gray-800 leading-snug">{o.text}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error && <Alert type="error" message={error} className="mb-4" />}

      {/* Navigation */}
      <div className="flex justify-between gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={safeIndex === 0}
          onClick={() => setCurrentQ((c) => Math.max(0, c - 1))}
        >
          <ChevronLeft className="w-4 h-4 mr-0.5" />
          Previous
        </Button>
        {safeIndex < questions.length - 1 ? (
          <Button size="sm" onClick={() => setCurrentQ((c) => Math.min(questions.length - 1, c + 1))}>
            Next
            <ChevronRight className="w-4 h-4 ml-0.5" />
          </Button>
        ) : (
          <Button size="sm" onClick={submitExam} loading={submitting}>
            <Send className="w-4 h-4 mr-1" />
            Submit exam
          </Button>
        )}
      </div>
    </StudentPortalShell>
    );
  }

  return null;
}
