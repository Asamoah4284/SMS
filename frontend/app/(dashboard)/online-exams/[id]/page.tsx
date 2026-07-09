'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Alert, Badge, Button, Modal, PageHeader, Input } from '@/components/ui';
import { Loader2, Plus, Trash2, CheckCircle } from 'lucide-react';

interface ExamOption { id: string; text: string; isCorrect: boolean; }
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
  class: { name: string };
  subject: { name: string };
  questions: ExamQuestion[];
  attempts: {
    id: string;
    status: string;
    score: number | null;
    student: { studentId: string; firstName: string; lastName: string };
  }[];
}

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : ''; }
const API = process.env.NEXT_PUBLIC_API_URL;

export default function OnlineExamDetailPage() {
  const params = useParams();
  const examId = params.id as string;
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'questions' | 'results' | 'grading'>('questions');
  const [qModal, setQModal] = useState(false);
  const [gradeModal, setGradeModal] = useState<string | null>(null);
  const [gradeAnswers, setGradeAnswers] = useState<Record<string, { marks: string; feedback: string }>>({});
  const [resultsData, setResultsData] = useState<{ exam: ExamDetail; pendingManualCount: number } | null>(null);

  const [qForm, setQForm] = useState({
    type: 'MCQ_SINGLE',
    text: '',
    marks: '2',
    modelAnswer: '',
    options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }],
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

  useEffect(() => { fetchExam(); }, [fetchExam]);
  useEffect(() => { if (tab !== 'questions') fetchResults(); }, [tab, fetchResults]);

  const addQuestion = async () => {
    const token = getToken();
    const body: Record<string, unknown> = {
      type: qForm.type,
      text: qForm.text,
      marks: parseFloat(qForm.marks),
      modelAnswer: qForm.type === 'THEORY' ? qForm.modelAnswer : null,
    };
    if (qForm.type !== 'THEORY') {
      body.options = qForm.options.filter((o) => o.text.trim());
    }
    const res = await fetch(`${API}/online-exams/${examId}/questions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json();
      alert(d.message || 'Failed to add question');
      return;
    }
    setQModal(false);
    fetchExam();
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

  const submitGrades = async (attemptId: string) => {
    const token = getToken();
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
    if (!res.ok) {
      alert('Failed to save grades');
      return;
    }
    setGradeModal(null);
    setGradeAnswers({});
    fetchResults();
    fetchExam();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!exam) return <Alert type="error" message={error || 'Exam not found'} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={exam.title}
        subtitle={`${exam.class.name} · ${exam.subject.name} · ${exam.durationMinutes} min · ${exam.totalMarks} marks`}
        actions={
          <div className="flex gap-2">
            <Link href="/online-exams"><Button variant="secondary">Back</Button></Link>
            {exam.status === 'DRAFT' && <Button onClick={publishExam}>Publish</Button>}
            {exam.status === 'PUBLISHED' && <Button variant="secondary" onClick={closeExam}>Close Exam</Button>}
          </div>
        }
      />

      <div className="flex items-center gap-2">
        <Badge variant={exam.status === 'PUBLISHED' ? 'success' : 'warning'}>{exam.status}</Badge>
        {resultsData && resultsData.pendingManualCount > 0 && (
          <Badge variant="warning">{resultsData.pendingManualCount} need manual marking</Badge>
        )}
      </div>

      <div className="flex gap-2 border-b">
        {(['questions', 'results', 'grading'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'questions' && (
        <div className="space-y-4">
          {exam.status === 'DRAFT' && (
            <Button onClick={() => setQModal(true)}><Plus className="w-4 h-4 mr-1" /> Add Question</Button>
          )}
          {exam.questions.map((q, i) => (
            <div key={q.id} className="p-4 bg-white border rounded-xl">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs text-gray-500">Q{i + 1} · {q.type} · {q.marks} marks</span>
                  <p className="font-medium mt-1">{q.text}</p>
                  {q.options.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm">
                      {q.options.map((o) => (
                        <li key={o.id} className={o.isCorrect ? 'text-green-700 font-medium' : 'text-gray-600'}>
                          {o.isCorrect && <CheckCircle className="w-3 h-3 inline mr-1" />}
                          {o.text}
                        </li>
                      ))}
                    </ul>
                  )}
                  {q.modelAnswer && <p className="text-sm text-gray-500 mt-2">Model answer: {q.modelAnswer}</p>}
                </div>
                {exam.status === 'DRAFT' && (
                  <button type="button" onClick={() => deleteQuestion(q.id)} className="text-red-600"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(tab === 'results' || tab === 'grading') && resultsData && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Status</th>
                {tab === 'grading' && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {resultsData.exam.attempts.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-4 py-3">{a.student.firstName} {a.student.lastName} <span className="text-gray-400">({a.student.studentId})</span></td>
                  <td className="px-4 py-3">{a.score != null ? `${a.score} / ${exam.totalMarks}` : '—'}</td>
                  <td className="px-4 py-3"><Badge variant={a.status === 'GRADED' ? 'success' : 'warning'}>{a.status}</Badge></td>
                  {tab === 'grading' && a.status === 'SUBMITTED' && (
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" onClick={() => setGradeModal(a.id)}>Grade Theory</Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {qModal && (
        <Modal isOpen onClose={() => setQModal(false)} title="Add Question">
          <div className="space-y-3 p-2 max-h-[70vh] overflow-y-auto">
            <label className="block text-sm font-medium">Type</label>
            <select className="w-full border rounded-lg px-3 py-2" value={qForm.type} onChange={(e) => setQForm({ ...qForm, type: e.target.value })}>
              <option value="MCQ_SINGLE">Multiple Choice (single)</option>
              <option value="MCQ_MULTIPLE">Multiple Choice (multiple)</option>
              <option value="TRUE_FALSE">True / False</option>
              <option value="THEORY">Theory (manual marking)</option>
            </select>
            <Input label="Question" value={qForm.text} onChange={(e) => setQForm({ ...qForm, text: e.target.value })} />
            <Input label="Marks" type="number" value={qForm.marks} onChange={(e) => setQForm({ ...qForm, marks: e.target.value })} />
            {qForm.type === 'THEORY' ? (
              <Input label="Model answer (reference)" value={qForm.modelAnswer} onChange={(e) => setQForm({ ...qForm, modelAnswer: e.target.value })} />
            ) : (
              qForm.options.map((o, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input type={qForm.type === 'MCQ_MULTIPLE' ? 'checkbox' : 'radio'} name="correct" checked={o.isCorrect}
                    onChange={() => {
                      const opts = qForm.options.map((opt, j) => ({
                        ...opt,
                        isCorrect: qForm.type === 'MCQ_MULTIPLE' ? (j === i ? !opt.isCorrect : opt.isCorrect) : j === i,
                      }));
                      setQForm({ ...qForm, options: opts });
                    }} />
                  <Input value={o.text} onChange={(e) => {
                    const opts = [...qForm.options];
                    opts[i] = { ...opts[i], text: e.target.value };
                    setQForm({ ...qForm, options: opts });
                  }} />
                </div>
              ))
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setQModal(false)}>Cancel</Button>
              <Button onClick={addQuestion}>Add</Button>
            </div>
          </div>
        </Modal>
      )}

      {gradeModal && resultsData && (
        <Modal isOpen onClose={() => setGradeModal(null)} title="Grade Theory Answers">
          <div className="space-y-4 p-2">
            {resultsData.exam.questions.filter((q) => q.type === 'THEORY').map((q) => (
              <div key={q.id} className="border rounded-lg p-3">
                <p className="font-medium text-sm">{q.text} ({q.marks} marks)</p>
                <Input label="Marks awarded" type="number" max={q.marks}
                  value={gradeAnswers[q.id]?.marks ?? ''}
                  onChange={(e) => setGradeAnswers({ ...gradeAnswers, [q.id]: { ...gradeAnswers[q.id], marks: e.target.value, feedback: gradeAnswers[q.id]?.feedback ?? '' } })} />
                <Input label="Feedback" value={gradeAnswers[q.id]?.feedback ?? ''}
                  onChange={(e) => setGradeAnswers({ ...gradeAnswers, [q.id]: { marks: gradeAnswers[q.id]?.marks ?? '', feedback: e.target.value } })} />
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setGradeModal(null)}>Cancel</Button>
              <Button onClick={() => submitGrades(gradeModal)}>Save Grades</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
