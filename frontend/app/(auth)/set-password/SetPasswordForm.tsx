'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Alert } from '@/components/ui';
import { Lock, AlertCircle } from 'lucide-react';

export default function SetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [staffId, setStaffId] = useState('');
  const router = useRouter();

  useEffect(() => {
    const token = sessionStorage.getItem('tempToken');
    const id = sessionStorage.getItem('staffId');

    if (!token || !id) {
      setError('Session expired. Please sign in through invitation again.');
      setTimeout(() => router.push('/invite'), 2000);
    } else {
      setTempToken(token);
      setStaffId(id);
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!/[a-z]/.test(password)) {
      setError('Password must contain at least one lowercase letter');
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }

    if (!/\d/.test(password)) {
      setError('Password must contain at least one number');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/set-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tempToken, staffId, password, confirmPassword }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to set password');
      }

      // Save tokens
      localStorage.setItem('accessToken', data.token);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      document.cookie = `accessToken=${data.token}; path=/; max-age=604800; samesite=lax`;

      // Clear session
      sessionStorage.removeItem('tempToken');
      sessionStorage.removeItem('staffId');

      router.push('/overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <Alert
          type="error"
          message={error}
          dismissible
          onDismiss={() => setError('')}
        />
      )}

      <div className="p-4 bg-info-50 border border-info-200 rounded-lg flex gap-3">
        <AlertCircle className="w-5 h-5 text-info-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-info-800">
          Password must have: 8+ chars, uppercase, lowercase, and a number
        </p>
      </div>

      <Input
        label="Password"
        type="password"
        placeholder="••••••••"
        icon={<Lock className="w-4 h-4" />}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <Input
        label="Confirm Password"
        type="password"
        placeholder="••••••••"
        icon={<Lock className="w-4 h-4" />}
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />

      <Button
        type="submit"
        loading={loading}
        className="w-full mt-2"
      >
        Create Account
      </Button>
    </form>
  );
}
