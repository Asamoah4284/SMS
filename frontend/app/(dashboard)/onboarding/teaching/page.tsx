'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Alert } from '@/components/ui';
import { PageHeader } from '@/components/ui/PageHeader';
import { useUser } from '@/lib/UserContext';
import { Plus, Trash2, BookOpen } from 'lucide-react';

type Row = { id: string; subjectId: string; classId: string };

function newRow(): Row {
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()),
    subjectId: '',
    classId: '',
  };
}

export default function TeachingOnboardingPage() {
  const router = useRouter();
  const { refresh, needsTeachingSetup, loading: userLoading } = useUser();
  const [rows, setRows] = useState<Row[]>(() => [newRow()]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadLists = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    const base = process.env.NEXT_PUBLIC_API_URL;
    try {
      const [subRes, clsRes] = await Promise.all([
        fetch(`${base}/subjects`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${base}/classes?limit=200&page=1`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (subRes.ok) {
        const data = await subRes.json();
        setSubjects((data.subjects ?? []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
      }
      if (clsRes.ok) {
        const data = await clsRes.json();
        setClasses((data.classes ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
      }
    } finally {
      setLoadingLists(false);
    }
  }, []);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  const updateRow = (id: string, field: 'subjectId' | 'classId', value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, newRow()]);
  const removeRow = (id: string) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const assignments = rows
      .filter((r) => r.subjectId && r.classId)
      .map((r) => ({ subjectId: r.subjectId, classId: r.classId }));

    if (assignments.length === 0) {
      setError('Select at least one subject and class.');
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      setError('Session expired. Please sign in again.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/teaching-assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ assignments }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Could not save assignments');
      }
      await refresh();
      router.replace('/overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (userLoading) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto">
        <p className="text-gray-900">Loading your profile…</p>
      </div>
    );
  }

  if (!needsTeachingSetup) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto">
        <p className="text-gray-900">Redirecting…</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto bg-white text-gray-900">
      <PageHeader
        className="[&_h1]:text-gray-900 [&_p]:text-gray-900"
        title="What do you teach?"
        subtitle="Choose the subjects and classes from your school’s catalog. You can add more later through your administrator if needed."
      />

      {error && (
        <Alert
          type="error"
          message={error}
          dismissible
          onDismiss={() => setError('')}
          className="mb-6"
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm text-gray-900 dark:bg-white dark:border-gray-200 dark:text-gray-900">
          <div className="flex items-center gap-2 text-gray-900 font-semibold mb-4">
            <BookOpen className="w-5 h-5 text-primary-600" />
            Subject & class pairs
          </div>

          {loadingLists ? (
            <p className="text-sm text-gray-900">Loading subjects and classes…</p>
          ) : (
            <ul className="space-y-4">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col sm:flex-row gap-3 sm:items-end"
                >
                  <label className="flex-1 flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-gray-900">Subject</span>
                    <select
                      required
                      value={row.subjectId}
                      onChange={(e) => updateRow(row.id, 'subjectId', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-white dark:border-gray-300 dark:text-gray-900"
                    >
                      <option value="">Select subject</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex-1 flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-gray-900">Class</span>
                    <select
                      required
                      value={row.classId}
                      onChange={(e) => updateRow(row.id, 'classId', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-white dark:border-gray-300 dark:text-gray-900"
                    >
                      <option value="">Select class</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length <= 1}
                    className="sm:mb-0.5 p-2 rounded-lg border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-white dark:border-gray-300 dark:text-gray-900"
                    aria-label="Remove row"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!loadingLists && subjects.length === 0 && (
            <p className="mt-2 text-sm text-gray-900 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
              No subjects are in the catalog yet. Ask your school administrator to add subjects before you can continue.
            </p>
          )}
          {!loadingLists && classes.length === 0 && (
            <p className="mt-2 text-sm text-gray-900 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
              No classes are set up yet. Ask your school administrator to add classes before you can continue.
            </p>
          )}

          {!loadingLists && (
            <button
              type="button"
              onClick={addRow}
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-gray-900 underline decoration-primary-600 hover:text-black"
            >
              <Plus className="w-4 h-4" />
              Add another subject
            </button>
          )}
        </div>

        <Button
          type="submit"
          loading={submitting}
          disabled={loadingLists || subjects.length === 0 || classes.length === 0}
          className="w-full sm:w-auto"
        >
          Continue to dashboard
        </Button>
      </form>
    </div>
  );
}
