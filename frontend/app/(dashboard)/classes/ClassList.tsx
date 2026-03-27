'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button } from '@/components/ui';
import { BookOpen, ChevronRight, Search, Users, UserCheck, UserX } from 'lucide-react';
import { classLevelLabels } from '@/lib/theme';

interface Class {
  id: string;
  name: string;
  level: string;
  section?: string | null;
  studentCount: number;
  classTeacher?: {
    id: string;
    name: string;
  } | null;
}

export default function ClassList() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/classes`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch classes');
      }

      const data = await res.json();
      setClasses(data.classes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm animate-pulse">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="h-5 w-28 bg-gray-200 rounded-md" />
                <div className="mt-2 h-4 w-36 bg-gray-100 rounded-full" />
              </div>
              <div className="h-5 w-20 bg-gray-100 rounded-full" />
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="h-4 w-24 bg-gray-100 rounded-md" />
              <div className="h-4 w-28 bg-gray-100 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <Alert type="error" message={error} />;
  }

  if (classes.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
        <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No classes yet. Create one to get started.</p>
      </div>
    );
  }

  const filteredClasses = classes.filter((cls) => {
    const levelLabel = classLevelLabels[cls.level as keyof typeof classLevelLabels] ?? cls.level;
    const haystack = [
      cls.name,
      cls.level,
      levelLabel,
      cls.section ?? '',
      cls.classTeacher?.name ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(searchQuery.toLowerCase().trim());
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search class name, level, section, teacher..."
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <Button onClick={() => setSearchQuery(searchInput)} icon={<Search className="w-4 h-4" />}>
          Search
        </Button>
      </div>

      {filteredClasses.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
          <p className="text-sm text-gray-500">No classes match your search.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClasses.map((cls) => {
            const levelLabel =
              classLevelLabels[cls.level as keyof typeof classLevelLabels] ?? cls.level;
            const subLabel = cls.section ? `${levelLabel} · Section ${cls.section}` : levelLabel;
            const hasTeacher = Boolean(cls.classTeacher);

            return (
              <div
                key={cls.id}
                className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm"
              >
                <Link
                  href={`/classes/${cls.id}`}
                  className="group block hover:bg-gray-50/40 transition-colors rounded-xl"
                >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-bold text-gray-900 truncate">{cls.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border border-gray-200 bg-gray-50 text-gray-700">
                        {subLabel}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {hasTeacher ? (
                      <Badge variant="success" className="gap-1">
                        <UserCheck className="w-3 h-3" />
                        Assigned
                      </Badge>
                    ) : (
                      <Badge variant="warning" className="gap-1">
                        <UserX className="w-3 h-3" />
                        No teacher
                      </Badge>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span className="font-semibold text-gray-900">{cls.studentCount}</span>
                    <span className="text-sm text-gray-500">students</span>
                  </div>
                  <div className="text-right min-w-0">
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                      Class Teacher
                    </p>
                    <p className={`text-sm font-semibold truncate ${hasTeacher ? 'text-gray-900' : 'text-gray-400'}`}>
                      {hasTeacher ? cls.classTeacher!.name : 'Not assigned'}
                    </p>
                  </div>
                </div>
                </Link>

                <div className="mt-3 pt-3 border-t border-gray-100">
                  <Link
                    href={`/timetable?classId=${cls.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Timetable
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
