'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Modal, PageHeader, Input } from '@/components/ui';
import { Plus, Loader2, FileText } from 'lucide-react';

interface OnlineExam {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  status: string;
  totalMarks: number;
  class: { id: string; name: string };
  subject: { id: string; name: string };
  term: { id: string; name: string; year: number };
  _count: { questions: number; attempts: number };
}

interface Term { id: string; name: string; year: number; isCurrent: boolean; }
interface ClassItem { id: string; name: string; }
interface Subject { id: string; name: string; }

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : ''; }
const API = process.env.NEXT_PUBLIC_API_URL;

export default function OnlineExamsClientPage() {
  const [exams, setExams] = useState<OnlineExam[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    instructions: '',
    durationMinutes: '45',
    startAt: '',
    endAt: '',
    classId: '',
    subjectId: '',
    termId: '',
  });

  const fetchExams = useCallback(async () => {
    const token = getToken();
    const res = await fetch(`${API}/online-exams`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setExams(await res.json());
  }, []);

  useEffect(() => {
    const token = getToken();
    Promise.all([
      fetch(`${API}/terms`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`${API}/classes?limit=100`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`${API}/subjects`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([termsData, classesData, subjectsData]) => {
        const list: Term[] = termsData.terms ?? [];
        setTerms(list);
        setClasses(classesData.classes ?? classesData ?? []);
        setSubjects(subjectsData.subjects ?? subjectsData ?? []);
        const cur = list.find((t) => t.isCurrent);
        setForm((f) => ({ ...f, termId: cur?.id ?? list[0]?.id ?? '' }));
      })
      .finally(() => setLoading(false));
    fetchExams();
  }, [fetchExams]);

  const createExam = async () => {
    const token = getToken();
    const res = await fetch(`${API}/online-exams`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        durationMinutes: parseInt(form.durationMinutes, 10),
        startAt: form.startAt || null,
        endAt: form.endAt || null,
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      alert(d.message || 'Failed to create exam');
      return;
    }
    setModalOpen(false);
    fetchExams();
  };

  const statusBadge = (status: string) => {
    const v = status === 'PUBLISHED' ? 'success' : status === 'DRAFT' ? 'warning' : 'default';
    return <Badge variant={v}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Online Exams"
        subtitle="Create CBT exams with auto-marking and manual theory grading"
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> New Exam
          </Button>
        }
      />
      {error && <Alert type="error" message={error} />}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Questions</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {exams.map((exam) => (
                <tr key={exam.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{exam.title}</td>
                  <td className="px-4 py-3">{exam.class.name}</td>
                  <td className="px-4 py-3">{exam.subject.name}</td>
                  <td className="px-4 py-3">{exam.durationMinutes} min</td>
                  <td className="px-4 py-3">{exam._count.questions}</td>
                  <td className="px-4 py-3">{statusBadge(exam.status)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/online-exams/${exam.id}`} className="text-blue-600 hover:underline text-sm">
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {exams.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
              No online exams yet.
            </div>
          )}
        </div>
      )}

      {modalOpen && (
        <Modal isOpen onClose={() => setModalOpen(false)} title="Create Online Exam">
          <div className="space-y-3 p-2 max-h-[70vh] overflow-y-auto">
            <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Input label="Instructions" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
            <Input label="Duration (minutes)" type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
            <Input label="Start (optional)" type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
            <Input label="End (optional)" type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
            <label className="block text-sm font-medium">Class</label>
            <select className="w-full border rounded-lg px-3 py-2" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
              <option value="">Select class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label className="block text-sm font-medium">Subject</label>
            <select className="w-full border rounded-lg px-3 py-2" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
              <option value="">Select subject</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <label className="block text-sm font-medium">Term</label>
            <select className="w-full border rounded-lg px-3 py-2" value={form.termId} onChange={(e) => setForm({ ...form, termId: e.target.value })}>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name} {t.year}</option>)}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={createExam}>Create</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
