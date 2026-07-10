'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button } from '@/components/ui';
import { GraduationCap, Hash, Sparkles } from 'lucide-react';

const fieldInput =
  'w-full px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-400 transition-shadow';

export default function StudentLoginPage() {
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'}/auth/student/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: studentId.trim() }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      localStorage.setItem('studentToken', data.token);
      localStorage.setItem('studentUser', JSON.stringify(data.student));
      localStorage.removeItem('studentMustChangePin');
      router.push('/student/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-600 to-indigo-700 text-white items-center justify-center shadow-lg shadow-primary-600/25 mb-4">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Student Portal</h1>
          <p className="text-sm text-gray-500 mt-1">Take exams and view your results</p>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/50 p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-5 px-3 py-2 rounded-xl bg-primary-50 border border-primary-100">
            <Sparkles className="w-4 h-4 text-primary-600 shrink-0" />
            <p className="text-xs text-primary-800 leading-snug">
              Enter your <strong>Student ID</strong> from your school to sign in.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <Alert type="error" message={error} />}

            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
                <Hash className="w-3.5 h-3.5 text-gray-400" />
                Student ID
              </label>
              <input
                className={fieldInput}
                placeholder="e.g. STM-2025-001"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <Button type="submit" loading={loading} className="w-full mt-2" size="lg">
              Sign in
            </Button>
          </form>
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-5">
          Staff and parents use separate portals.
        </p>
      </div>
    </div>
  );
}
