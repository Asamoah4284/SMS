'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Alert, Button, Badge } from '@/components/ui';
import { Loader2, LogOut, FileText } from 'lucide-react';

function getStudentToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('studentToken') : '';
}

const API = process.env.NEXT_PUBLIC_API_URL;

export default function StudentDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<{
    student: { studentId: string; firstName: string; lastName: string; class: { name: string } | null };
    availableExams: { id: string; title: string; subject: string; durationMinutes: number; hasAttempt: boolean; attemptStatus: string | null }[];
    recentAttempts: { title: string; subject: string; score: number | null; totalMarks: number; status: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getStudentToken();
    if (!token) {
      router.replace('/student/login');
      return;
    }
    fetch(`${API}/student-portal/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (r.status === 401) {
          localStorage.removeItem('studentToken');
          router.replace('/student/login');
          return null;
        }
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then((d) => { if (d) setData(d); })
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [router]);

  const signOut = () => {
    localStorage.removeItem('studentToken');
    localStorage.removeItem('studentUser');
    router.push('/student/login');
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hello, {data?.student.firstName}!</h1>
          <p className="text-gray-500">{data?.student.studentId} · {data?.student.class?.name ?? 'No class'}</p>
        </div>
        <Button variant="secondary" onClick={signOut}><LogOut className="w-4 h-4 mr-1" /> Sign Out</Button>
      </div>

      {error && <Alert type="error" message={error} />}

      <section className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2"><FileText className="w-5 h-5" /> Available Exams</h2>
        {data?.availableExams.length === 0 ? (
          <p className="text-gray-500">No exams available right now.</p>
        ) : (
          <div className="space-y-3">
            {data?.availableExams.map((exam) => (
              <div key={exam.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{exam.title}</p>
                  <p className="text-sm text-gray-500">{exam.subject} · {exam.durationMinutes} min</p>
                </div>
                {exam.hasAttempt ? (
                  <Badge variant={exam.attemptStatus === 'GRADED' ? 'success' : 'warning'}>{exam.attemptStatus}</Badge>
                ) : (
                  <Link href={`/student/exams/${exam.id}/take`}>
                    <Button size="sm">Start Exam</Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {data && data.recentAttempts.length > 0 && (
        <section className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold text-lg mb-4">Recent Results</h2>
          <div className="space-y-2">
            {data.recentAttempts.map((a, i) => (
              <div key={i} className="flex justify-between text-sm border-b py-2">
                <span>{a.title} ({a.subject})</span>
                <span className="font-medium">{a.score != null ? `${a.score}/${a.totalMarks}` : a.status}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
