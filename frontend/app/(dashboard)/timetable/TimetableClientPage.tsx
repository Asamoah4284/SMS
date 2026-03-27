'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert, Badge, Button, PageHeader } from '@/components/ui';
import { Calendar, Clock3, RefreshCw } from 'lucide-react';

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

  const MOCK_TEACHERS = [
    'Mr. Kwaku Mensah',
    'Mrs. Akotor Dei',
    'Ms. Gloria Sarpong',
    'Mr. Kojo Oyecl',
    'Ms. Zipye Acamce',
    'Mrs. Prapa Goyvers',
    'Mr. Knume Owasi',
    'Ms. Anu Kyeremaa',
  ];

  const mockTeacherFor = (entry: TimetableEntry) => {
    const key = `${entry.subject.name}-${entry.dayOfWeek}-${entry.startTime}`;
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
      hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }
    return MOCK_TEACHERS[hash % MOCK_TEACHERS.length]!;
  };

  const getTeacherLabel = (entry: TimetableEntry) => {
    if (entry.teacher?.name) return entry.teacher.name;
    if (entry.teacherName) return entry.teacherName;
    return mockTeacherFor(entry);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1600px] mx-auto animate-fade-in space-y-4 sm:space-y-6">
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

      {!loading && context && (
        <div className="space-y-4 sm:space-y-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-[var(--shadow-card)]">
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
                              {getTeacherLabel(entry) && (
                                <p className="text-[11px] mt-1 text-gray-500 truncate flex items-center gap-1.5">
                                  <span className="w-3.5 h-3.5 rounded-full bg-white border border-gray-200 inline-flex items-center justify-center text-[8px] leading-none">
                                    👤
                                  </span>
                                  {getTeacherLabel(entry)}
                                </p>
                              )}
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
                                        {getTeacherLabel(entry) && (
                                          <p className="text-[11px] mt-1 text-gray-500 leading-tight truncate flex items-center gap-1.5">
                                            <span className="w-3.5 h-3.5 rounded-full bg-white border border-gray-200 inline-flex items-center justify-center text-[8px] leading-none">
                                              👤
                                            </span>
                                            {getTeacherLabel(entry)}
                                          </p>
                                        )}
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

            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-[var(--shadow-card)]">
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
      )}

      {loading && (
        <div className="text-sm text-gray-500">Loading timetable workspace...</div>
      )}
    </div>
  );
}
