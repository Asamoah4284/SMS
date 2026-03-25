'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardBody, Badge, Alert } from '@/components/ui';
import { Users, BookOpen } from 'lucide-react';
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
      <Card>
        <CardBody className="text-center py-12">
          <p className="text-gray-500">Loading classes...</p>
        </CardBody>
      </Card>
    );
  }

  if (error) {
    return <Alert type="error" message={error} />;
  }

  if (classes.length === 0) {
    return (
      <Card>
        <CardBody className="text-center py-12">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No classes yet. Create one to get started.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {classes.map((cls) => (
        <Link key={cls.id} href={`/classes/${cls.id}`}>
          <Card hoverable className="h-full">
            <CardBody>
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900">{cls.name}</h3>
                <p className="text-sm text-gray-600">
                  {classLevelLabels[cls.level as keyof typeof classLevelLabels] || cls.level}
                  {cls.section && ` - Section ${cls.section}`}
                </p>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="w-4 h-4" />
                  <span>{cls.studentCount} students</span>
                </div>
                {cls.classTeacher && (
                  <div className="text-sm">
                    <p className="text-gray-600">Class Teacher</p>
                    <p className="font-semibold text-gray-900">{cls.classTeacher.name}</p>
                  </div>
                )}
              </div>

              {!cls.classTeacher && (
                <Badge variant="warning">No teacher assigned</Badge>
              )}
            </CardBody>
          </Card>
        </Link>
      ))}
    </div>
  );
}
