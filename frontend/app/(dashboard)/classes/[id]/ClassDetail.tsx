'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardBody, Badge, Alert } from '@/components/ui';
import { Users, BookOpen, User } from 'lucide-react';
import { classLevelLabels } from '@/lib/theme';
import { calculateAge } from '@/lib/utils';

interface ClassDetail {
  id: string;
  name: string;
  level: string;
  section?: string | null;
  classTeacher?: {
    id: string;
    name: string;
    phone: string;
  } | null;
  students: Array<{
    id: string;
    name: string;
    dateOfBirth?: string;
    parentPhone?: string;
  }>;
  subjects: Array<{
    id: string;
    name: string;
    code?: string;
    teacher: string;
  }>;
}

export default function ClassDetail({ classId }: { classId: string }) {
  const [classData, setClassData] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchClassDetail();
  }, [classId]);

  const fetchClassDetail = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/classes/${classId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        throw new Error('Failed to fetch class');
      }

      const data = await res.json();
      setClassData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load class');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading class details...</div>;
  }

  if (error) {
    return <Alert type="error" message={error} />;
  }

  if (!classData) {
    return <Alert type="error" message="Class not found" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/classes" className="text-primary-600 hover:underline text-sm">
          ← Back to Classes
        </Link>
        <h2 className="text-3xl font-bold mt-2">{classData.name}</h2>
        <p className="text-gray-600">
          {classLevelLabels[classData.level as keyof typeof classLevelLabels]}
          {classData.section && ` • Section ${classData.section}`}
        </p>
      </div>

      {/* Class Teacher Card */}
      <Card>
        <CardHeader
          title="Class Teacher"
          action={
            !classData.classTeacher && (
              <Badge variant="warning">Unassigned</Badge>
            )
          }
        />
        <CardBody>
          {classData.classTeacher ? (
            <div>
              <p className="font-semibold text-lg text-gray-900">
                {classData.classTeacher.name}
              </p>
              <p className="text-gray-600">{classData.classTeacher.phone}</p>
            </div>
          ) : (
            <p className="text-gray-600">No teacher assigned to this class yet</p>
          )}
        </CardBody>
      </Card>

      {/* Students */}
      <Card>
        <CardHeader
          title="Students"
          subtitle={`${classData.students.length} enrolled`}
        />
        <CardBody>
          {classData.students.length === 0 ? (
            <p className="text-gray-600">No students in this class yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="text-left py-2 font-semibold text-gray-700">
                      Name
                    </th>
                    <th className="text-left py-2 font-semibold text-gray-700">
                      Age
                    </th>
                    <th className="text-left py-2 font-semibold text-gray-700">
                      Parent Contact
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {classData.students.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="py-3">{student.name}</td>
                      <td className="py-3">
                        {student.dateOfBirth 
                          ? `${Math.floor((new Date().getTime() - new Date(student.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} yrs`
                          : '-'}
                      </td>
                      <td className="py-3">{student.parentPhone || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Subjects */}
      <Card>
        <CardHeader
          title="Subjects"
          subtitle={`${classData.subjects.length} subjects`}
        />
        <CardBody>
          {classData.subjects.length === 0 ? (
            <p className="text-gray-600">No subjects assigned yet.</p>
          ) : (
            <div className="space-y-4">
              {classData.subjects.map((subject) => (
                <div
                  key={subject.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 p-4"
                >
                  <div>
                    <p className="font-semibold text-gray-900">{subject.name}</p>
                    {subject.code && (
                      <p className="text-sm text-gray-600">{subject.code}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Teacher</p>
                    <p className="font-semibold text-gray-900">
                      {subject.teacher}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
