'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Alert, Button } from '@/components/ui';
import { Loader2 } from 'lucide-react';

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
    attempt: { id: string; status: string } | null;
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
    fetch(`${API}/student-portal/exams/${examId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed to load exam');
        return r.json();
      })
      .then((d) => {
        setExam(d);
        if (d.attempt?.status && d.attempt.status !== 'IN_PROGRESS') {
          router.replace('/student/dashboard');
        }
      })
      .catch(() => setError('Failed to load exam'))
      .finally(() => setLoading(false));
  }, [examId, router]);

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
    setAttemptId(data.attemptId);
    setSecondsLeft(data.durationMinutes * 60);
    setStarted(true);
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

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!exam) return <Alert type="error" message={error || 'Exam not found'} />;

  if (!started) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-xl border p-8 space-y-4">
          <h1 className="text-2xl font-bold">{exam.title}</h1>
          {exam.instructions && <p className="text-gray-600 whitespace-pre-wrap">{exam.instructions}</p>}
          <p className="text-sm text-gray-500">Duration: {exam.durationMinutes} minutes · {exam.questions.length} questions</p>
          {error && <Alert type="error" message={error} />}
          <Button onClick={beginExam} className="w-full">Begin Exam</Button>
        </div>
      </div>
    );
  }

  const q = exam.questions[currentQ];
  const isTheory = q.type === 'THEORY';
  const isMulti = q.type === 'MCQ_MULTIPLE';

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between bg-white border rounded-xl p-4 sticky top-0 z-10">
        <span className="font-medium">Question {currentQ + 1} of {exam.questions.length}</span>
        <span className={`font-mono font-bold ${secondsLeft < 300 ? 'text-red-600' : 'text-blue-600'}`}>
          {formatTime(secondsLeft)}
        </span>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <p className="text-xs text-gray-500">{q.type.replace('_', ' ')} · {q.marks} marks</p>
        <p className="text-lg font-medium">{q.text}</p>

        {isTheory ? (
          <textarea
            className="w-full border rounded-lg p-3 min-h-[120px]"
            value={answers[q.id]?.textAnswer || ''}
            onChange={(e) => setAnswers({ ...answers, [q.id]: { textAnswer: e.target.value } })}
            placeholder="Type your answer..."
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
                  className={`w-full text-left p-3 rounded-lg border ${selected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  {o.text}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-between gap-2">
        <Button variant="secondary" disabled={currentQ === 0} onClick={() => setCurrentQ((c) => c - 1)}>Previous</Button>
        {currentQ < exam.questions.length - 1 ? (
          <Button onClick={() => setCurrentQ((c) => c + 1)}>Next</Button>
        ) : (
          <Button onClick={submitExam} loading={submitting}>Submit Exam</Button>
        )}
      </div>
    </div>
  );
}
