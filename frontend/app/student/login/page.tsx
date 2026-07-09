'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Input } from '@/components/ui';
import { GraduationCap } from 'lucide-react';

export default function StudentLoginPage() {
  const [studentId, setStudentId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'}/auth/student/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: studentId.trim(), pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      localStorage.setItem('studentToken', data.token);
      localStorage.setItem('studentUser', JSON.stringify(data.student));
      if (data.mustChangePin) {
        localStorage.setItem('studentMustChangePin', '1');
      } else {
        localStorage.removeItem('studentMustChangePin');
      }
      router.push('/student/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Student Portal</h1>
            <p className="text-sm text-gray-500">Sign in with your Student ID and PIN</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert type="error" message={error} />}
          <Input label="Student ID" placeholder="e.g. STM-2025-001" value={studentId} onChange={(e) => setStudentId(e.target.value)} required />
          <Input label="PIN" type="password" placeholder="••••" value={pin} onChange={(e) => setPin(e.target.value)} required maxLength={6} />
          <Button type="submit" loading={loading} className="w-full">Sign In</Button>
        </form>
      </div>
    </div>
  );
}
