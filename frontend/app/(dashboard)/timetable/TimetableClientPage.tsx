'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, PageHeader } from '@/components/ui';
import { Calendar, BookOpen, Clock3, Plus, RefreshCw } from 'lucide-react';

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

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
];

export default function TimetableClientPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [context, setContext] = useState<TimetableContext | null>(null);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classTimetable, setClassTimetable] = useState<ClassTimetableResponse | null>(null);
  const [upcoming, setUpcoming] = useState<MyUpcomingResponse['entries']>([]);

  const [subjectName, setSubjectName] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('08:40');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

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
      setSelectedClassId(data.classes[0].id);
    }
  }, [selectedClassId, token]);

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

  const canEditClass = useMemo(() => {
    if (!context || !selectedClassId) return false;
    const selected = context.classes.find((c) => c.id === selectedClassId);
    return !!selected?.canEdit || context.role === 'ADMIN';
  }, [context, selectedClassId]);

  const assignedSubjectNames = useMemo(() => {
    if (!context || !selectedClassId) return [];
    return context.subjectAssignments
      .filter((a) => a.classId === selectedClassId)
      .map((a) => a.subjectName)
      .sort((a, b) => a.localeCompare(b));
  }, [context, selectedClassId]);

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) => {
      if (prev.includes(day)) {
        const next = prev.filter((d) => d !== day);
        return next.length === 0 ? prev : next;
      }
      return [...prev, day].sort((a, b) => a - b);
    });
  };

  const handleCreateSlot = async () => {
    if (!token || !selectedClassId) return;

    setSaving(true);
    setSaveMessage('');
    setError('');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/timetable/slots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          classId: selectedClassId,
          subjectName,
          startTime,
          endTime,
          daysOfWeek,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save timetable slot');
      }

      setSaveMessage(data.message || 'Saved');
      await fetchClassTimetable(selectedClassId);
      await fetchMyUpcoming();

      if (!data.reusedExistingSchedule) {
        setSubjectName('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save timetable slot');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto animate-fade-in space-y-6">
      <PageHeader
        title="Timetable"
        subtitle="Manage class schedules and subject periods"
        actions={
          <Button variant="secondary" icon={<RefreshCw className="w-4 h-4" />} onClick={refreshAll}>
            Refresh
          </Button>
        }
      />

      {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}
      {saveMessage && <Alert type="success" message={saveMessage} onDismiss={() => setSaveMessage('')} />}

      {!loading && context && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-3 mb-4">
                <Calendar className="w-4 h-4 text-gray-500" />
                <h3 className="font-bold text-gray-900">Full Class Timetable</h3>
              </div>

              <div className="mb-4">
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

              {classTimetable && classTimetable.entries.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
                        <th className="py-2 pr-3">Day</th>
                        <th className="py-2 pr-3">Time</th>
                        <th className="py-2 pr-3">Subject</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classTimetable.entries.map((entry) => (
                        <tr key={entry.id} className="border-b border-gray-100 last:border-0">
                          <td className="py-2.5 pr-3 font-medium text-gray-700">{entry.dayName}</td>
                          <td className="py-2.5 pr-3 text-gray-600">{entry.startTime} - {entry.endTime}</td>
                          <td className="py-2.5 pr-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold">
                              {entry.subject.name}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No timetable slots for this class yet.</p>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-[var(--shadow-card)]">
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
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-primary-700">{entry.subject.name}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-600">{entry.class.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No assigned upcoming classes.</p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-3 mb-3">
                <Plus className="w-4 h-4 text-gray-500" />
                <h3 className="font-bold text-gray-900">Add Subject To Timetable</h3>
              </div>

              <p className="text-xs text-gray-500 mb-4">
                Subject teachers can only add for classes they are assigned to. If the class already has a timetable for the subject,
                class schedule is reused automatically.
              </p>

              {!canEditClass && context.role === 'TEACHER' && (
                <Alert
                  type="info"
                  message="You are viewing this class timetable in read-only mode. You can still request/add subject slots, but existing class-teacher schedules are protected."
                  className="mb-4"
                />
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Subject name</label>
                  <input
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    placeholder="e.g. Mathematics"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                  />
                </div>

                {assignedSubjectNames.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">My assigned subjects in this class</p>
                    <div className="flex flex-wrap gap-1.5">
                      {assignedSubjectNames.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setSubjectName(name)}
                          className="px-2 py-1 rounded-full text-xs font-semibold bg-warning-50 text-warning-700 hover:bg-warning-100"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Start</label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">End</label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Days</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDay(d.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                          daysOfWeek.includes(d.value)
                            ? 'bg-primary-50 text-primary-700 border-primary-200'
                            : 'bg-white text-gray-600 border-gray-200'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleCreateSlot}
                  disabled={saving || !subjectName.trim() || !selectedClassId || daysOfWeek.length === 0}
                  icon={<BookOpen className="w-4 h-4" />}
                >
                  {saving ? 'Saving...' : 'Save Timetable Slot'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-sm text-gray-500">Loading timetable workspace...</div>
      )}
    </div>
  );
}
