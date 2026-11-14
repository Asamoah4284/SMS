'use client';

import { useEffect, useState } from 'react';
import { Alert, Badge, Button } from '@/components/ui';
import { ArrowUpCircle, CheckCircle2, Loader2 } from 'lucide-react';

type ClassItem = { id: string; name: string; level: string; classNumber: number; _count?: { students: number } };
type Student = { id: string; studentId: string; firstName: string; lastName: string };
type Action = 'PROMOTE' | 'REPEAT' | 'WITHDRAW';
type Decision = { studentId: string; action: Action; targetClassId?: string; note?: string };

const API = process.env.NEXT_PUBLIC_API_URL;

export default function PromotionsClientPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sourceClassId, setSourceClassId] = useState('');
  const [targetClassId, setTargetClassId] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Action>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [draftId, setDraftId] = useState('');

  const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('accessToken')}` });

  useEffect(() => {
    fetch(`${API}/promotions/classes`, { headers: auth() })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load classes');
        setClasses(data.classes || []);
      })
      .catch((err) => setError(err.message));
  }, []);

  const loadRoster = async (classId: string) => {
    setSourceClassId(classId);
    setTargetClassId('');
    setStudents([]);
    setMessage('');
    setError('');
    if (!classId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/promotions/roster?classId=${encodeURIComponent(classId)}`, { headers: auth() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load roster');
      setStudents(data.students || []);
      setTargetClassId(data.suggestedTarget?.id || '');
      setDraftId(data.draft?.id || '');
      const saved: Record<string, Action> = {};
      for (const decision of data.draft?.decisions || []) saved[decision.studentId] = decision.action;
      setDecisions(Object.fromEntries((data.students || []).map((student: Student) => [student.id, saved[student.id] || 'PROMOTE'])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roster');
    } finally {
      setLoading(false);
    }
  };

  const setAction = (studentId: string, action: Action) =>
    setDecisions((current) => ({ ...current, [studentId]: action }));

  const saveDraft = async () => {
    setError('');
    setMessage('');
    if (!sourceClassId || !students.length) return setError('Select a class with active students.');
    if (students.some((student) => decisions[student.id] === 'PROMOTE' && !targetClassId)) {
      return setError('Choose a destination class for promoted students.');
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/promotions/drafts`, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceClassId,
          decisions: students.map((student) => ({
            studentId: student.id,
            action: decisions[student.id] || 'PROMOTE',
            targetClassId: decisions[student.id] === 'PROMOTE' ? targetClassId : undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not save recommendations');
      setDraftId(data.batch.id);
      setMessage('Recommendations saved. An administrator must finalize this promotion.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save recommendations');
    } finally {
      setSaving(false);
    }
  };

  const finalize = async () => {
    if (!draftId || !confirm('Finalize this promotion? Student classes and portal IDs will be updated.')) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API}/promotions/${draftId}/finalize`, { method: 'POST', headers: auth() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not finalize promotion');
      setMessage('Promotion finalized successfully. Student IDs and portal phones were synchronized.');
      await loadRoster(sourceClassId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finalize promotion');
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = typeof window !== 'undefined' && JSON.parse(localStorage.getItem('user') || '{}').role === 'ADMIN';
  const selectedTarget = classes.find((item) => item.id === targetClassId);

  return (
    <main className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <ArrowUpCircle className="w-7 h-7 text-teal-600" />
          <h1 className="text-2xl font-bold text-gray-900">Student Promotions</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">Prepare recommendations by class, then let an administrator finalize them.</p>
      </div>

      {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}
      {message && <Alert type="success" message={message} onDismiss={() => setMessage('')} />}

      <section className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <label className="block text-sm font-medium text-gray-700">
          Select class to review
          <select className="mt-1 w-full rounded-lg border-gray-300 p-3" value={sourceClassId} onChange={(event) => loadRoster(event.target.value)}>
            <option value="">Choose a class</option>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.name} ({item._count?.students ?? 0} students)</option>)}
          </select>
        </label>

        {loading && <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading roster...</div>}

        {students.length > 0 && (
          <>
            <label className="block text-sm font-medium text-gray-700 max-w-md">
              Suggested destination class
              <select className="mt-1 w-full rounded-lg border-gray-300 p-3" value={targetClassId} onChange={(event) => setTargetClassId(event.target.value)}>
                <option value="">No destination</option>
                {classes.filter((item) => item.id !== sourceClassId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {selectedTarget && <span className="text-xs text-gray-500">Suggested automatically from class order; you can change it.</span>}
            </label>

            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left"><tr><th className="p-3">Student</th><th className="p-3">Current ID</th><th className="p-3">Decision</th></tr></thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id} className="border-t">
                      <td className="p-3 font-medium">{student.firstName} {student.lastName}</td>
                      <td className="p-3 text-gray-500">{student.studentId}</td>
                      <td className="p-3">
                        <select className="rounded-lg border-gray-300 p-2" value={decisions[student.id] || 'PROMOTE'} onChange={(event) => setAction(student.id, event.target.value as Action)}>
                          <option value="PROMOTE">Promote</option>
                          <option value="REPEAT">Repeat current class</option>
                          <option value="WITHDRAW">Withdraw / left school</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={saveDraft} disabled={saving}>{saving ? 'Saving...' : 'Save recommendations'}</Button>
              {isAdmin && draftId && <Button variant="secondary" onClick={finalize} disabled={saving}><CheckCircle2 className="w-4 h-4 mr-2" /> Finalize promotion</Button>}
            </div>
            {isAdmin && <Badge variant="warning">Finalizing updates classes, student IDs, and portal login numbers.</Badge>}
          </>
        )}
      </section>
    </main>
  );
}
