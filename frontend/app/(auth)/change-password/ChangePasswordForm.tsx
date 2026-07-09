'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Alert } from '@/components/ui';
import { Lock, AlertCircle } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

interface ChangePasswordFormProps {
  /** When true, user must change password before using the app (no cancel). */
  required?: boolean;
}

export default function ChangePasswordForm({ required = false }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const validate = () => {
    if (!currentPassword || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return false;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      setError('Password must include uppercase, lowercase, and a number');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;

    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Failed to change password');

      localStorage.removeItem('mustChangePassword');
      router.push('/overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {required && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900">
            This is your first login with the default password. Please create a new password to continue.
          </p>
        </div>
      )}

      {error && <Alert type="error" message={error} dismissible onDismiss={() => setError('')} />}

      <div className="p-4 bg-info-50 border border-info-200 rounded-lg flex gap-3">
        <AlertCircle className="w-5 h-5 text-info-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-info-800">
          Password must have: 8+ characters, uppercase, lowercase, and a number
        </p>
      </div>

      <Input
        label="Current password"
        type="password"
        placeholder="••••••••"
        icon={<Lock className="w-4 h-4" />}
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        required
      />

      <Input
        label="New password"
        type="password"
        placeholder="••••••••"
        icon={<Lock className="w-4 h-4" />}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <Input
        label="Confirm new password"
        type="password"
        placeholder="••••••••"
        icon={<Lock className="w-4 h-4" />}
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
      />

      <Button type="submit" loading={loading} className="w-full mt-2">
        {required ? 'Set new password & continue' : 'Update password'}
      </Button>
    </form>
  );
}
