'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Alert, Badge, Button, Input, Modal, PageHeader } from '@/components/ui';
import { Calendar, Clock3, Plus, RefreshCw } from 'lucide-react';

type Role = 'ADMIN' | 'TEACHER';

type TimetableContext = {
  role: Role;
  classes: Array<{ id: string; name: string; canEdit: boolean }>;
  classTeacherClasses: string[];
  subjectAssignments: Array<{ classId: string; className: string; subjectId: string; subjectName: string }>;
};

type TimetableEntry = {
  id: string;
  dayOfWeek: number;
  dayName: string;
  startTime: string;
  endTime: string;
  subject: { id: string; name: string; code?: string | null };
  teacherName?: string | null;
  teacher?: { id?: string; name: string } | null;
};

type ClassTimetableResponse = {
  class: { id: string; name: string; level: string; section: string | null };
  canEdit: boolean;
  entries: TimetableEntry[];
};

type MyUpcomingResponse = {
  entries: Array<
    TimetableEntry & {
      class: { id: string; name: string };
    }
  >;
};

type ClassSubjectOption = {
  id: string;
  name: string;
  code?: string | null;
  teacherId?: string;
  teacher?: string;
};

type DaySlotDraft = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

const DAY_SHORT: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
};

const DAY_LONG: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
};

export default function TimetableClientPage() {
  const searchParams = useSearchParams();
  const requestedClassId = searchParams.get('classId') ?? '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [context, setContext] = useState<TimetableContext | null>(null);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classTimetable, setClassTimetable] = useState<ClassTimetableResponse | null>(null);
  const [upcoming, setUpcoming] = useState<MyUpcomingResponse['entries']>([]);
  const [timetableView, setTimetableView] = useState<'weekly' | 'daily'>('weekly');
  const [selectedDay, setSelectedDay] = useState<number>(1);

  const [classSubjects, setClassSubjects] = useState<ClassSubjectOption[]>([]);
  const [loadingClassSubjects, setLoadingClassSubjects] = useState(false);
  const [slotSubjectId, setSlotSubjectId] = useState('');
  /** Selected weekdays per subject — independent for each subject */
  const [slotDaysBySubject, setSlotDaysBySubject] = useState<Record<string, number[]>>({});
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  /** Subject the open modal belongs to (draft save targets this id) */
  const [modalSubjectId, setModalSubjectId] = useState('');
  /** Days this modal is editing (snapshot so it matches the toggle that opened it) */
  const [modalDaysSnapshot, setModalDaysSnapshot] = useState<number[]>([]);
  const [modalDayTimes, setModalDayTimes] = useState<Record<number, { start: string; end: string }>>({});
  const [modalError, setModalError] = useState('');
  /** Draft slots per subject — applied only when user clicks Generate timetable */
  const [pendingSlotsBySubject, setPendingSlotsBySubject] = useState<Record<string, DaySlotDraft[]>>({});
  const [generatingTimetable, setGeneratingTimetable] = useState(false);
  const [slotMessage, setSlotMessage] = useState('');
  const [slotError, setSlotError] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const fetchContext = useCallback(async () => {
    if (!token) return;

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/timetable/context`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error('Failed to load timetable context');
    const data = (await res.json()) as TimetableContext;
    setContext(data);

    if (!selectedClassId && data.classes.length > 0) {
      const requested = requestedClassId.trim();
      const hasRequested = requested
        ? data.classes.some((c) => c.id === requested)
        : false;
      setSelectedClassId(hasRequested ? requested : data.classes[0].id);
    }
  }, [requestedClassId, selectedClassId, token]);

  const fetchMyUpcoming = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/timetable/my-upcoming`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = (await res.json()) as MyUpcomingResponse;
        setUpcoming(data.entries);
      } else {
        setUpcoming([]);
      }
    } catch {
      setUpcoming([]);
    }
  }, [token]);

  const fetchClassTimetable = useCallback(
    async (classId: string) => {
      if (!token || !classId) return;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/timetable/class/${classId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to load class timetable');
      const data = (await res.json()) as ClassTimetableResponse;
      setClassTimetable(data);
    },
    [token]
  );

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await fetchContext();
      await fetchMyUpcoming();
      if (selectedClassId) await fetchClassTimetable(selectedClassId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timetable data');
    } finally {
      setLoading(false);
    }
  }, [fetchClassTimetable, fetchContext, fetchMyUpcoming, selectedClassId]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!selectedClassId || !context) return;
    fetchClassTimetable(selectedClassId).catch(() => null);
  }, [selectedClassId, context, fetchClassTimetable]);

  useEffect(() => {
    if (!token || !selectedClassId || !classTimetable?.canEdit) {
      setClassSubjects([]);
      setSlotSubjectId('');
      return;
    }

    let cancelled = false;
    setLoadingClassSubjects(true);
    setSlotError('');
    setSlotMessage('');

    (async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/classes/${selectedClassId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to load class subjects');
        const data = (await res.json()) as { subjects?: ClassSubjectOption[] };
        const list = data.subjects ?? [];
        if (!cancelled) {
          setClassSubjects(list);
          setSlotSubjectId((prev) => {
            if (prev && list.some((s) => s.id === prev)) return prev;
            return list[0]?.id ?? '';
          });
        }
      } catch {
        if (!cancelled) {
          setClassSubjects([]);
          setSlotError('Could not load subjects for this class.');
        }
      } finally {
        if (!cancelled) setLoadingClassSubjects(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, selectedClassId, classTimetable?.canEdit]);

  useEffect(() => {
    setPendingSlotsBySubject({});
    setSlotDaysBySubject({});
    setSlotMessage('');
    setSlotError('');
    setTimeModalOpen(false);
    setModalSubjectId('');
    setModalDaysSnapshot([]);
  }, [selectedClassId]);

  const slotDaysForSubject = useMemo(
    () => (slotSubjectId ? slotDaysBySubject[slotSubjectId] ?? [] : []),
    [slotDaysBySubject, slotSubjectId],
  );

  const openTimeModalForDays = useCallback(
    (days: number[], subjectId?: string) => {
      if (days.length === 0) return;
      const sid = subjectId ?? slotSubjectId;
      if (!sid) return;
      const pending = pendingSlotsBySubject[sid] ?? [];
      const next: Record<number, { start: string; end: string }> = {};
      for (const d of days) {
        const found = pending.find((x) => x.dayOfWeek === d);
        next[d] = found
          ? { start: found.startTime, end: found.endTime }
          : { start: '08:00', end: '09:00' };
      }
      setModalSubjectId(sid);
      setModalDaysSnapshot(days);
      setModalDayTimes(next);
      setModalError('');
      setTimeModalOpen(true);
    },
    [pendingSlotsBySubject, slotSubjectId],
  );

  const toggleSlotDay = (day: number) => {
    const sid = slotSubjectId;
    if (!sid) return;
    setSlotDaysBySubject((prev) => {
      const current = prev[sid] ?? [];
      let next: number[];
      if (current.includes(day)) {
        next = current.filter((d) => d !== day).sort((a, b) => a - b);
      } else {
        next = [...current, day].sort((a, b) => a - b);
      }
      if (next.length > current.length) {
        queueMicrotask(() => {
          openTimeModalForDays(next, sid);
        });
      }
      return { ...prev, [sid]: next };
    });
  };

  const saveModalTimes = () => {
    const sid = modalSubjectId;
    if (!sid) return;
    setModalError('');
    const sortedDays = [...modalDaysSnapshot].sort((a, b) => a - b);
    const entries: DaySlotDraft[] = [];
    for (const d of sortedDays) {
      const t = modalDayTimes[d];
      if (!t) {
        setModalError(`Set start and end for ${DAY_LONG[d] ?? 'each day'}.`);
        return;
      }
      if (t.start >= t.end) {
        setModalError(`${DAY_SHORT[d] ?? 'Day'}: end time must be after start.`);
        return;
      }
      entries.push({ dayOfWeek: d, startTime: t.start, endTime: t.end });
    }
    setPendingSlotsBySubject((prev) => ({ ...prev, [sid]: entries }));
    setSlotDaysBySubject((prev) => ({ ...prev, [sid]: sortedDays }));
    setTimeModalOpen(false);
    setModalSubjectId('');
    setModalDaysSnapshot([]);
    setSlotMessage('Times saved for this subject. Click Generate timetable to publish them to the class.');
    setSlotError('');
  };

  const generateTimetableFromPending = async () => {
    if (!token || !selectedClassId || !classTimetable?.canEdit) return;
    const pairs = Object.entries(pendingSlotsBySubject).filter(([, e]) => e.length > 0);
    if (pairs.length === 0) {
      setSlotError(
        'Choose a subject, select weekdays, set times in the modal, save, then generate. Nothing is queued yet.',
      );
      return;
    }

    setGeneratingTimetable(true);
    setSlotError('');
    setSlotMessage('');

    try {
      for (const [subjectId, entries] of pairs) {
        const subject = classSubjects.find((s) => s.id === subjectId);
        if (!subject) continue;
        for (const e of entries) {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/timetable/slots`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              classId: selectedClassId,
              subjectName: subject.name,
              startTime: e.startTime,
              endTime: e.endTime,
              daysOfWeek: [e.dayOfWeek],
            }),
          });

          const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

          if (!res.ok) {
            const errs = data.errors;
            if (Array.isArray(errs) && errs.length > 0) {
              const first = errs[0] as { msg?: string };
              throw new Error(`${subject.name}: ${first.msg ?? 'Validation failed'}`);
            }
            const msg =
              typeof data.message === 'string'
                ? data.message
                : typeof data.error === 'string'
                  ? data.error
                  : 'Could not save timetable slot.';
            throw new Error(`${subject.name}: ${msg}`);
          }
        }
      }

      setPendingSlotsBySubject({});
      setSlotDaysBySubject({});
      setSlotMessage('Timetable saved successfully.');
      await fetchClassTimetable(selectedClassId);
    } catch (e) {
      setSlotError(e instanceof Error ? e.message : 'Could not generate timetable.');
    } finally {
      setGeneratingTimetable(false);
    }
  };

  const pendingSummary = useMemo(() => {
    return Object.entries(pendingSlotsBySubject)
      .filter(([, entries]) => entries.length > 0)
      .map(([subjectId, entries]) => {
        const name = classSubjects.find((s) => s.id === subjectId)?.name ?? 'Subject';
        const bits = entries
          .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
          .map(
            (e) =>
              `${DAY_SHORT[e.dayOfWeek]} ${e.startTime}–${e.endTime}`,
          );
        return { subjectId, name, bits };
      });
  }, [pendingSlotsBySubject, classSubjects]);

  const orderedDays = useMemo(() => {
    if (!classTimetable?.entries) return [];
    const seen = new Map<number, string>();
    for (const entry of classTimetable.entries) {
      if (!seen.has(entry.dayOfWeek)) {
        seen.set(entry.dayOfWeek, entry.dayName);
      }
    }
    return Array.from(seen.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([dayOfWeek, dayName]) => ({ dayOfWeek, dayName }));
  }, [classTimetable?.entries]);

  const orderedTimes = useMemo(() => {
    if (!classTimetable?.entries) return [];
    const times = Array.from(new Set(classTimetable.entries.map((e) => `${e.startTime}|${e.endTime}`)));
    return times
      .map((s) => {
        const [startTime, endTime] = s.split('|');
        return { startTime, endTime };
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [classTimetable?.entries]);

  useEffect(() => {
    if (!orderedDays.length) return;
    if (!orderedDays.some((d) => d.dayOfWeek === selectedDay)) {
      setSelectedDay(orderedDays[0].dayOfWeek);
    }
  }, [orderedDays, selectedDay]);

  const entryAt = (dayOfWeek: number, startTime: string) =>
    classTimetable?.entries.find((e) => e.dayOfWeek === dayOfWeek && e.startTime === startTime) ?? null;

  const lessonTone = (subjectName: string) => {
    const tones = [
      { card: 'bg-blue-50 border-blue-200', left: 'border-l-blue-500' },
      { card: 'bg-emerald-50 border-emerald-200', left: 'border-l-emerald-600' },
      { card: 'bg-amber-50 border-amber-200', left: 'border-l-amber-600' },
      { card: 'bg-violet-50 border-violet-200', left: 'border-l-violet-600' },
      { card: 'bg-rose-50 border-rose-200', left: 'border-l-rose-600' },
      { card: 'bg-cyan-50 border-cyan-200', left: 'border-l-cyan-600' },
    ];
    let hash = 0;
    for (let i = 0; i < subjectName.length; i += 1) hash = (hash * 31 + subjectName.charCodeAt(i)) >>> 0;
    return tones[hash % tones.length]!;
  };

  const getTeacherLabel = (entry: TimetableEntry) => {
    if (entry.teacherName) return entry.teacherName;
    if (entry.teacher?.name) return entry.teacher.name;
    return null;
  };

  const subjectsHref =
    selectedClassId.length > 0
      ? `/subjects?classId=${encodeURIComponent(selectedClassId)}`
      : '/subjects';

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1600px] mx-auto animate-fade-in space-y-4 sm:space-y-6">
      <PageHeader
        title="Timetable"
        subtitle="Each subject has its own weekdays and times. Pick a subject, add days, set times in the modal, then Generate timetable."
        actions={
          <Button variant="secondary" icon={<RefreshCw className="w-4 h-4" />} onClick={refreshAll}>
            Refresh
          </Button>
        }
      />

      {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}

      {!loading && context && (
        <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-3 mb-4">
                <Calendar className="w-4 h-4 text-gray-500" />
                <h3 className="font-bold text-gray-900">Full Class Timetable</h3>
              </div>

              <div className="mb-3 sm:mb-4">
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Select class
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full max-w-sm px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm"
                >
                  {context.classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} {cls.canEdit || context.role === 'ADMIN' ? '(editable)' : '(read-only)'}
                    </option>
                  ))}
                </select>
              </div>

              {classTimetable?.canEdit && (
                <div className="mb-4 sm:mb-5">
                  <div className="rounded-none bg-primary-50/50 dark:bg-primary-950/20 p-4 sm:p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Plus className="w-5 h-5 text-primary-600 dark:text-primary-400 shrink-0" />
                        <div>
                          <h4 className="text-base font-bold text-gray-900 dark:text-gray-100">Add lesson times</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                            Weekdays and times are separate for each subject — e.g. Maths on Monday does not use up Monday
                            for English. Choose a subject, tap its days, set times in the window, then switch subject and
                            repeat. Generate timetable publishes everything queued.
                          </p>
                        </div>
                      </div>
                      <Link
                        href={subjectsHref}
                        className="text-sm font-semibold text-primary-700 dark:text-primary-300 hover:underline whitespace-nowrap shrink-0"
                      >
                        Manage class subjects →
                      </Link>
                    </div>

                    {loadingClassSubjects ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Loading subjects…</p>
                    ) : classSubjects.length === 0 ? (
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        No subjects on this class yet.{' '}
                        <Link href={subjectsHref} className="font-semibold text-primary-700 dark:text-primary-300 underline">
                          Add subjects
                        </Link>{' '}
                        first, then return here to set days and times.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2 items-end">
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                              Subject
                            </label>
                            <select
                              value={slotSubjectId}
                              onChange={(e) => setSlotSubjectId(e.target.value)}
                              className="w-full max-w-xl px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-none text-sm text-gray-900 dark:text-gray-100"
                            >
                              {classSubjects.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                  {s.teacher ? ` (${s.teacher})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Weekdays for this subject (tap to add — times open in a window)
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { d: 1, label: 'Mon' },
                              { d: 2, label: 'Tue' },
                              { d: 3, label: 'Wed' },
                              { d: 4, label: 'Thu' },
                              { d: 5, label: 'Fri' },
                            ].map(({ d, label }) => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => toggleSlotDay(d)}
                                className={`px-3 py-1.5 rounded-none text-xs font-semibold border transition-colors ${
                                  slotDaysForSubject.includes(d)
                                    ? 'bg-primary-600 text-white border-primary-600 dark:bg-primary-500 dark:border-primary-500'
                                    : 'bg-white text-gray-600 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          {slotDaysForSubject.length > 0 && (
                            <button
                              type="button"
                              onClick={() => openTimeModalForDays(slotDaysForSubject, slotSubjectId)}
                              className="mt-2 text-sm font-semibold text-primary-700 dark:text-primary-300 underline"
                            >
                              Edit times for selected days
                            </button>
                          )}
                        </div>

                        {pendingSummary.length > 0 && (
                          <div className="rounded-none border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900/30 p-3 space-y-2">
                            <p className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                              Ready to publish (after Generate)
                            </p>
                            <ul className="text-sm text-gray-900 dark:text-gray-100 space-y-1.5">
                              {pendingSummary.map((row) => (
                                <li key={row.subjectId}>
                                  <span className="font-semibold">{row.name}:</span>{' '}
                                  {row.bits.join(', ')}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                          <Button
                            type="button"
                            variant="primary"
                            className="w-full sm:w-auto !rounded-none"
                            disabled={generatingTimetable || pendingSummary.length === 0}
                            onClick={() => void generateTimetableFromPending()}
                          >
                            {generatingTimetable ? 'Publishing…' : 'Generate timetable'}
                          </Button>
                          <p className="text-xs text-gray-600 dark:text-gray-400 sm:max-w-md">
                            Nothing is saved to the class timetable until you click Generate timetable.
                          </p>
                        </div>

                        {slotError && (
                          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                            {slotError}
                          </p>
                        )}
                        {slotMessage && (
                          <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
                            {slotMessage}
                          </p>
                        )}

                        <Modal
                          isOpen={timeModalOpen}
                          onClose={() => {
                            setTimeModalOpen(false);
                            setModalSubjectId('');
                            setModalDaysSnapshot([]);
                          }}
                          title="Set times for each day"
                          size="lg"
                          footer={
                            <>
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => {
                                  setTimeModalOpen(false);
                                  setModalSubjectId('');
                                  setModalDaysSnapshot([]);
                                }}
                              >
                                Cancel
                              </Button>
                              <Button type="button" variant="primary" className="!rounded-none" onClick={saveModalTimes}>
                                Save times
                              </Button>
                            </>
                          }
                        >
                          <p className="text-sm text-black mb-4">
                            Enter the lesson start and end for each selected weekday. Saving stores a draft; use Generate
                            timetable on the main screen to publish.
                          </p>
                          <div className="space-y-4 max-h-[min(60vh,420px)] overflow-y-auto pr-1 [&_label]:text-black [&_label]:font-semibold">
                            {[...modalDaysSnapshot].sort((a, b) => a - b).map((d) => (
                              <div
                                key={d}
                                className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_1fr_1fr] gap-3 items-end border-b border-gray-100 dark:border-gray-700 pb-4 last:border-0"
                              >
                                <p className="text-sm font-semibold text-black pb-2 sm:pb-0">
                                  {DAY_LONG[d]}
                                </p>
                                <Input
                                  type="time"
                                  label="Start"
                                  value={modalDayTimes[d]?.start ?? '08:00'}
                                  onChange={(e) =>
                                    setModalDayTimes((prev) => ({
                                      ...prev,
                                      [d]: { end: prev[d]?.end ?? '09:00', start: e.target.value },
                                    }))
                                  }
                                  className="!rounded-none"
                                />
                                <Input
                                  type="time"
                                  label="End"
                                  value={modalDayTimes[d]?.end ?? '09:00'}
                                  onChange={(e) =>
                                    setModalDayTimes((prev) => ({
                                      ...prev,
                                      [d]: { start: prev[d]?.start ?? '08:00', end: e.target.value },
                                    }))
                                  }
                                  className="!rounded-none"
                                />
                              </div>
                            ))}
                          </div>
                          {modalError && (
                            <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
                              {modalError}
                            </p>
                          )}
                        </Modal>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {classTimetable && classTimetable.entries.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTimetableView('weekly')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                        timetableView === 'weekly'
                          ? 'bg-primary-50 text-primary-700 border-primary-200'
                          : 'bg-white text-gray-600 border-gray-200'
                      }`}
                    >
                      Weekly
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimetableView('daily')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                        timetableView === 'daily'
                          ? 'bg-primary-50 text-primary-700 border-primary-200'
                          : 'bg-white text-gray-600 border-gray-200'
                      }`}
                    >
                      Daily
                    </button>
                  </div>

                  {timetableView === 'daily' ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {orderedDays.map((d) => (
                          <button
                            key={d.dayOfWeek}
                            type="button"
                            onClick={() => setSelectedDay(d.dayOfWeek)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                              selectedDay === d.dayOfWeek
                                ? 'bg-primary-50 text-primary-700 border-primary-200'
                                : 'bg-white text-gray-600 border-gray-200'
                            }`}
                          >
                            {d.dayName}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-2">
                        {classTimetable.entries
                          .filter((e) => e.dayOfWeek === selectedDay)
                          .sort((a, b) => a.startTime.localeCompare(b.startTime))
                          .map((entry) => {
                            const tone = lessonTone(entry.subject.name);
                            return (
                            <div key={entry.id} className={`rounded-lg border border-l-4 ${tone.card} ${tone.left} px-3 py-2.5 min-h-[64px]`}>
                              <p className="text-xs font-semibold text-gray-500">{entry.startTime} - {entry.endTime}</p>
                              <p className="text-sm font-semibold text-gray-900 mt-0.5 leading-tight">{entry.subject.name}</p>
                              {getTeacherLabel(entry) ? (
                                <p className="text-[11px] mt-1 text-gray-800 truncate flex items-center gap-1.5">
                                  <span className="text-gray-500 shrink-0">Teacher:</span>
                                  <span className="w-3.5 h-3.5 rounded-full bg-white border border-gray-200 inline-flex items-center justify-center text-[8px] leading-none shrink-0">
                                    👤
                                  </span>
                                  <span className="font-medium truncate">{getTeacherLabel(entry)}</span>
                                </p>
                              ) : null}
                            </div>
                          );
                          })}
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <div className="min-w-[760px] rounded-xl border border-gray-200 overflow-hidden">
                        <div className="grid" style={{ gridTemplateColumns: `120px repeat(${orderedDays.length}, minmax(120px, 1fr))` }}>
                          <div className="bg-gray-50 border-b border-r border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Time
                          </div>
                          {orderedDays.map((d) => (
                            <div
                              key={d.dayOfWeek}
                              className="bg-gray-50 border-b border-r border-gray-200 last:border-r-0 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center"
                            >
                              {d.dayName}
                            </div>
                          ))}

                          {orderedTimes.map((time) => (
                            <Fragment key={time.startTime}>
                              <div className="border-b border-r border-gray-200 px-3 py-3 text-xs font-semibold text-gray-600">
                                {time.startTime} - {time.endTime}
                              </div>
                              {orderedDays.map((d) => {
                                const entry = entryAt(d.dayOfWeek, time.startTime);
                                return (
                                  <div
                                    key={`${d.dayOfWeek}-${time.startTime}`}
                                    className="border-b border-r border-gray-200 last:border-r-0 p-2"
                                  >
                                    {entry ? (
                                      <div className={`rounded-lg border border-l-4 ${lessonTone(entry.subject.name).card} ${lessonTone(entry.subject.name).left} px-3 py-2.5 min-h-[72px]`}>
                                        <p className="text-sm font-semibold text-gray-900 leading-tight">{entry.subject.name}</p>
                                        {getTeacherLabel(entry) ? (
                                          <p className="text-[11px] mt-1 text-gray-800 leading-tight truncate flex items-center gap-1 flex-wrap">
                                            <span className="text-gray-500 shrink-0">Teacher:</span>
                                            <span className="w-3.5 h-3.5 rounded-full bg-white border border-gray-200 inline-flex items-center justify-center text-[8px] leading-none shrink-0">
                                              👤
                                            </span>
                                            <span className="font-medium truncate">{getTeacherLabel(entry)}</span>
                                          </p>
                                        ) : null}
                                      </div>
                                    ) : (
                                      <div className="h-[68px] rounded-lg border border-dashed border-gray-200 bg-gray-50/40" />
                                    )}
                                  </div>
                                );
                              })}
                            </Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No timetable slots for this class yet.</p>
              )}
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-3 mb-4">
                <Clock3 className="w-4 h-4 text-gray-500" />
                <h3 className="font-bold text-gray-900">Upcoming Classes (My Teaching)</h3>
              </div>

              {upcoming.length > 0 ? (
                <div className="space-y-2.5">
                  {upcoming.slice(0, 18).map((entry) => (
                    <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 px-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Badge variant="info">{entry.dayName}</Badge>
                        <span className="font-semibold">{entry.startTime} - {entry.endTime}</span>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 text-sm min-w-0">
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <span className="font-medium text-primary-700">{entry.subject.name}</span>
                          <span className="text-gray-400">•</span>
                          <span className="text-gray-600">{entry.class.name}</span>
                        </div>
                        {entry.teacherName ? (
                          <span className="text-xs text-gray-800 font-medium truncate max-w-[280px]">
                            Teacher: {entry.teacherName}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No assigned upcoming classes.</p>
              )}
            </div>
        </div>
      )}

      {loading && (
        <div className="text-sm text-gray-500">Loading timetable workspace...</div>
      )}
    </div>
  );
}
