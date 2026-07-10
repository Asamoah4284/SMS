'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Alert, Button, Input, PasswordInput } from '@/components/ui';
import { Lock, User } from 'lucide-react';

export default function LoginForm() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const invalidCreds = error.toLowerCase().includes('invalid credentials');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim() || !password.trim()) {
      setError('Please enter your Staff ID/Phone and password to continue.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Save tokens
      localStorage.setItem('accessToken', data.token);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      document.cookie = `accessToken=${data.token}; path=/; max-age=604800; samesite=lax`;

      if (data.mustChangePassword) {
        localStorage.setItem('mustChangePassword', '1');
        router.push('/change-password');
      } else {
        localStorage.removeItem('mustChangePassword');
        router.push('/overview');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <Alert
          type="error"
          title="We couldn’t sign you in"
          message={error}
          dismissible
          onDismiss={() => setError('')}
        />
      )}

      <Input
        label="Staff ID or Phone"
        placeholder="e.g., JK-12345 or 0241234567"
        icon={<User className="w-4 h-4" />}
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        autoComplete="username"
      />

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <label className="text-sm font-semibold text-gray-700">Password</label>
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-primary-600 transition-colors hover:text-primary-700 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          placeholder="Enter your password"
          icon={<Lock className="w-4 h-4" />}
          value={password}
          onChange={(value) => setPassword(value)}
          error={invalidCreds ? 'Incorrect password' : undefined}
          helperText={invalidCreds ? 'Tip: check Caps Lock or use “Show password”.' : undefined}
          autoComplete="current-password"
        />
      </div>

      <Button type="submit" loading={loading} size="lg" className="w-full">
        Sign In
      </Button>
    </form>
  );
}
