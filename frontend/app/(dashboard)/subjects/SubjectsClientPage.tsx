'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert, Button, Input, Modal, PageHeader } from '@/components/ui';
import { BookMarked, Loader2, Pencil, RefreshCw, Search, Trash2, User } from 'lucide-react';
import { useUser } from '@/lib/UserContext';

type ClassRow = { id: string; name: string };
type ClassSubject = {
  id: string;
  name: string;
  code?: string | null;
  teacher?: string;
};
type CatalogSubject = { id: string; name: string; code?: string | null };

export default function SubjectsClientPage() {
  const searchParams = useSearchParams();
  const classIdFromQuery = searchParams.get('classId')?.trim() ?? '';

  const { isAdmin, isClassTeacher, myClassId, refresh: refreshUser } = useUser();
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classLabel, setClassLabel] = useState('');

  const [catalogSubjects, setCatalogSubjects] = useState<CatalogSubject[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [customName, setCustomName] = useState('');

  const [subjects, setSubjects] = useState<ClassSubject[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editSubject, setEditSubject] = useState<ClassSubject | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [patchSaving, setPatchSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canUsePage = isAdmin || isClassTeacher;

  const effectiveClassId = useMemo(() => {
    if (isAdmin) return selectedClassId;
    return myClassId ?? '';
  }, [isAdmin, myClassId, selectedClassId]);

  const subjectIdsInClass = useMemo(() => new Set(subjects.map((s) => s.id)), [subjects]);

  const namesInClassLower = useMemo(
    () => new Set(subjects.map((s) => s.name.trim().toLowerCase())),
    [subjects],
  );

  const availableCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return catalogSubjects
      .filter((c) => !subjectIdsInClass.has(c.id))
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [catalogSubjects, subjectIdsInClass, catalogSearch]);

  const fetchClasses = useCallback(async () => {
    if (!token || !isAdmin) return;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/classes?limit=200`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to load classes');
    const data = (await res.json()) as { classes?: ClassRow[] };
    setClasses(data.classes ?? []);
  }, [isAdmin, token]);

  const fetchCatalog = useCallback(async () => {
    if (!token) return;
    setLoadingCatalog(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/subjects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load catalog');
      const data = (await res.json()) as { subjects?: CatalogSubject[] };
      setCatalogSubjects(data.subjects ?? []);
    } catch {
      setCatalogSubjects([]);
    } finally {
      setLoadingCatalog(false);
    }
  }, [token]);

  const fetchClassSubjects = useCallback(
    async (classId: string) => {
      if (!token || !classId) {
        setSubjects([]);
        setClassLabel('');
        return;
      }
      setLoadingList(true);
      setError('');
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/classes/${classId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to load class subjects');
        const data = (await res.json()) as { name?: string; subjects?: ClassSubject[] };
        setClassLabel(data.name ?? '');
        setSubjects(data.subjects ?? []);
      } catch {
        setSubjects([]);
        setError('Could not load subjects for this class.');
      } finally {
        setLoadingList(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (isAdmin && token) {
      fetchClasses().catch(() => setClasses([]));
    }
  }, [isAdmin, token, fetchClasses]);

  useEffect(() => {
    if (token && canUsePage) {
      fetchCatalog().catch(() => null);
    }
  }, [token, canUsePage, fetchCatalog]);

  useEffect(() => {
    if (!isAdmin && myClassId) {
      setSelectedClassId(myClassId);
    }
  }, [isAdmin, myClassId]);

  useEffect(() => {
    if (isAdmin && classIdFromQuery) {
      setSelectedClassId(classIdFromQuery);
    }
  }, [isAdmin, classIdFromQuery]);

  useEffect(() => {
    if (effectiveClassId) {
      fetchClassSubjects(effectiveClassId).catch(() => null);
    } else {
      setSubjects([]);
      setClassLabel('');
      setLoadingList(false);
    }
  }, [effectiveClassId, fetchClassSubjects]);

  useEffect(() => {
    setSelectedCatalogId('');
    setCustomName('');
    setCatalogSearch('');
  }, [effectiveClassId]);

  const addOneSubject = async (nameRaw: string) => {
    const name = nameRaw.trim().replace(/\s+/g, ' ');
    if (!name) {
      setError('Enter a subject name or pick one from the catalog.');
      return;
    }
    if (namesInClassLower.has(name.toLowerCase())) {
      setError('That subject is already assigned to this class.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/subjects`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, classId: effectiveClassId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; errors?: { msg?: string }[] };
      if (!res.ok) {
        const msg =
          Array.isArray(data.errors) && data.errors[0]?.msg
            ? data.errors[0].msg
            : data.error ?? 'Could not add subject.';
        throw new Error(msg);
      }
      setSuccess(`“${name}” has been added to ${classLabel || 'the class'}.`);
      setCustomName('');
      setSelectedCatalogId('');
      await fetchClassSubjects(effectiveClassId);
      await refreshUser();
      await fetchCatalog();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add subject.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (s: ClassSubject) => {
    setEditSubject(s);
    setEditName(s.name);
    setEditCode(s.code ?? '');
    setEditOpen(true);
    setError('');
  };

  const saveEdit = async () => {
    if (!token || !effectiveClassId || !editSubject) return;
    const name = editName.trim().replace(/\s+/g, ' ');
    if (!name) {
      setError('Subject name cannot be empty.');
      return;
    }
    setPatchSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/subjects/class-link`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          classId: effectiveClassId,
          subjectId: editSubject.id,
          name,
          code: editCode.trim() === '' ? null : editCode.trim().toUpperCase(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(data.error ?? 'Could not update subject.');
      }
      setSuccess(data.message ?? 'Subject updated.');
      setEditOpen(false);
      setEditSubject(null);
      await fetchClassSubjects(effectiveClassId);
      await fetchCatalog();
      await refreshUser();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update subject.');
    } finally {
      setPatchSaving(false);
    }
  };

  const removeSubject = async (s: ClassSubject) => {
    if (!token || !effectiveClassId) return;
    const ok = window.confirm(
      `Remove “${s.name}” from this class?\n\nTimetable periods for this subject in this class will be removed. This does not delete school-wide results if they already exist.`,
    );
    if (!ok) return;

    setDeletingId(s.id);
    setError('');
    setSuccess('');
    try {
      const q = new URLSearchParams({ classId: effectiveClassId, subjectId: s.id });
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/subjects/class-link?${q.toString()}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? 'Could not remove subject.');
      }
      setSuccess(data.message ?? 'Subject removed from class.');
      await fetchClassSubjects(effectiveClassId);
      await fetchCatalog();
      await refreshUser();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove subject.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddFromForm = () => {
    if (!effectiveClassId) {
      setError('Select a class first.');
      return;
    }
    if (customName.trim()) {
      void addOneSubject(customName);
      return;
    }
    const picked = catalogSubjects.find((c) => c.id === selectedCatalogId);
    if (picked) {
      void addOneSubject(picked.name);
      return;
    }
    setError('Choose a subject from the list or type a new name below.');
  };

  if (!canUsePage) {
    return (
      <div className="p-4 sm:p-6 md:p-8 max-w-3xl mx-auto">
        <PageHeader title="Class subjects" subtitle="Curriculum and teaching assignments" />
        <Alert
          type="info"
          message="This page is available to class teachers and school administrators only."
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto animate-fade-in space-y-8">
      <PageHeader
        title="Class subjects"
        subtitle={
          isAdmin
            ? 'Link subjects from the school catalog or register new ones. Assignments stay until an administrator changes them.'
            : `Link subjects for ${classLabel || 'your class'} from the catalog or register new ones.`
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && (
              <div className="min-w-[12rem]">
                <label htmlFor="class-pick" className="sr-only">
                  Select class
                </label>
                <select
                  id="class-pick"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full rounded-xl border-0 bg-white px-4 py-2.5 text-sm font-medium text-gray-950 shadow-sm ring-1 ring-primary-200/25 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                >
                  <option value="">Select a class…</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Button
              type="button"
              variant="secondary"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={() => {
                void fetchClassSubjects(effectiveClassId);
                void fetchCatalog();
              }}
              disabled={!effectiveClassId || loadingList}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}
      {success && <Alert type="success" message={success} onDismiss={() => setSuccess('')} />}

      <Modal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditSubject(null);
        }}
        title="Edit subject"
        size="sm"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditOpen(false);
                setEditSubject(null);
              }}
              disabled={patchSaving}
            >
              Cancel
            </Button>
            <Button type="button" variant="primary" loading={patchSaving} onClick={() => void saveEdit()}>
              Save changes
            </Button>
          </>
        }
      >
        <p className="mt-0 text-sm text-gray-800">
          Changes apply to the school subject record (name and code are shared wherever this subject is used).
        </p>
        <div className="mt-4 space-y-4">
          <Input
            label="Subject name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            disabled={patchSaving}
            className="text-gray-950"
          />
          <Input
            label="Subject code (optional)"
            value={editCode}
            onChange={(e) => setEditCode(e.target.value)}
            placeholder="e.g. MATH"
            disabled={patchSaving}
            className="text-gray-950"
          />
        </div>
      </Modal>

      {/* Add subject + curriculum side by side */}
      <section className="rounded-2xl bg-white p-5 sm:p-6 text-gray-950 shadow-[var(--shadow-card)]">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-12 lg:items-start">
          {/* Left: add subject */}
          <div className="min-w-0">
            <h2 className="text-base font-bold text-black">Add a subject</h2>
            <p className="mt-1 text-sm text-gray-800">
              Prefer the catalog for consistency. Use the second field only when the subject is not listed yet.
            </p>

            <div className="mt-6 space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-950">School catalog</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
                  <Input
                    type="search"
                    placeholder="Filter subjects…"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    disabled={!effectiveClassId || loadingCatalog}
                    className="border-0 bg-white pl-10 text-gray-950 shadow-sm ring-1 ring-primary-200/25 placeholder:text-gray-600 focus:ring-2 focus:ring-primary-500/40"
                    aria-label="Filter school subjects"
                  />
                </div>
                <div className="relative">
                  <label htmlFor="catalog-subject" className="sr-only">
                    Choose subject
                  </label>
                  <select
                    id="catalog-subject"
                    value={selectedCatalogId}
                    onChange={(e) => {
                      setSelectedCatalogId(e.target.value);
                      if (e.target.value) setCustomName('');
                    }}
                    disabled={!effectiveClassId || loadingCatalog || availableCatalog.length === 0}
                    className="w-full appearance-none rounded-xl border-0 bg-white px-4 py-3 pr-10 text-sm font-medium text-gray-950 shadow-sm ring-1 ring-primary-200/25 focus:outline-none focus:ring-2 focus:ring-primary-500/40 disabled:opacity-60"
                  >
                    <option value="">
                      {loadingCatalog
                        ? 'Loading catalog…'
                        : availableCatalog.length === 0
                          ? 'All catalog subjects are already assigned'
                          : 'Select a subject…'}
                    </option>
                    {availableCatalog.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.code ? ` (${c.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-950">New subject name</label>
                <Input
                  placeholder="e.g. Ghanaian Language"
                  value={customName}
                  onChange={(e) => {
                    setCustomName(e.target.value);
                    if (e.target.value.trim()) setSelectedCatalogId('');
                  }}
                  disabled={!effectiveClassId || saving}
                  className="border-0 bg-white text-gray-950 shadow-sm ring-1 ring-primary-200/25 placeholder:text-gray-600 focus:ring-2 focus:ring-primary-500/40"
                  aria-label="New subject name if not in catalog"
                />
                <p className="text-xs text-gray-800">
                  If the subject already exists under another spelling, pick it from the catalog instead to avoid duplicates.
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="primary"
                loading={saving}
                disabled={!effectiveClassId || (!selectedCatalogId && !customName.trim())}
                onClick={() => void handleAddFromForm()}
              >
                Add to class
              </Button>
              {!effectiveClassId && isAdmin && (
                <span className="text-sm text-gray-800">Select a class above to enable adding subjects.</span>
              )}
            </div>
          </div>

          {/* Right: curriculum */}
          <div className="min-w-0 mt-10 pt-10 lg:mt-0 lg:pt-0">
            <h2 className="text-base font-bold text-black">Curriculum for this class</h2>
            <p className="mt-1 text-sm text-gray-800">
              Subjects offered and who is assigned to teach them.
            </p>

            <div className="mt-6">
              {!effectiveClassId ? (
                <p className="text-sm text-gray-800">
                  {isAdmin ? 'Select a class to view its subject list.' : ''}
                </p>
              ) : loadingList ? (
                <div className="flex items-center gap-2 py-12 text-sm text-gray-900">
                  <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
                  Loading subjects…
                </div>
              ) : subjects.length === 0 ? (
                <div className="py-10 text-center lg:text-left">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary-600 shadow-sm ring-1 ring-primary-200/40 lg:mx-0">
                    <BookMarked className="h-6 w-6" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-black">No subjects yet</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-gray-800 lg:mx-0">
                    Add subjects from the form on the left; they will show here with teacher assignments.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full min-w-[280px] text-left text-sm text-gray-950">
                    <thead>
                      <tr className="text-xs font-semibold uppercase tracking-wider text-gray-900">
                        <th scope="col" className="pb-2 pr-3">
                          Subject
                        </th>
                        <th scope="col" className="pb-2 pr-3">
                          Code
                        </th>
                        <th scope="col" className="pb-2">
                          <span className="inline-flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-gray-800" aria-hidden />
                            Teacher
                          </span>
                        </th>
                        <th scope="col" className="pb-2 w-[1%] whitespace-nowrap text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.map((s) => (
                        <tr key={s.id} className="transition-colors">
                          <td className="py-2.5 pr-3 align-top">
                            <span className="font-semibold text-black">{s.name}</span>
                          </td>
                          <td className="py-2.5 pr-3 align-top text-gray-900">
                            {s.code ?? '—'}
                          </td>
                          <td className="py-2.5 align-top text-gray-950">{s.teacher ?? '—'}</td>
                          <td className="py-2.5 pl-2 text-right align-top">
                            <div className="inline-flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(s)}
                                disabled={deletingId !== null || !effectiveClassId}
                                className="rounded-lg p-2 text-primary-600 hover:bg-primary-50 disabled:opacity-40"
                                aria-label={`Edit ${s.name}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void removeSubject(s)}
                                disabled={deletingId !== null || !effectiveClassId}
                                className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-40"
                                aria-label={`Remove ${s.name} from class`}
                              >
                                {deletingId === s.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
