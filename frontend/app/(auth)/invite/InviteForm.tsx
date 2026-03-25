'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Input, Alert } from '@/components/ui';
import { Hash, Lock } from 'lucide-react';

export default function InviteForm() {
  const [staffId, setStaffId] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const router = useRouter();

  // Redirect after successful verification — not in JSX body
  useEffect(() => {
    if (!verified) return;
    const timer = setTimeout(() => router.push('/set-password'), 1500);
    return () => clearTimeout(timer);
  }, [verified, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!staffId.trim() || !inviteCode.trim()) {
      setError('Please enter both Staff ID and invitation code.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/verify-invite`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ staffId: staffId.toUpperCase(), inviteCode }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      sessionStorage.setItem('tempToken', data.tempToken);
      sessionStorage.setItem('staffId', staffId.toUpperCase());
      setVerified(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (verified) {
    return (
      <Alert
        type="success"
        title="Code verified!"
        message="Redirecting you to set your password…"
        dismissible={false}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <Alert type="error" message={error} dismissible onDismiss={() => setError('')} />
      )}

      <Input
        label="Staff ID"
        placeholder="e.g., JK-12345"
        icon={<Hash className="w-4 h-4" />}
        value={staffId}
        onChange={(e) => setStaffId(e.target.value.toUpperCase())}
        helperText="Sent in your invitation SMS"
      />

      <Input
        label="Invitation Code"
        placeholder="000000"
        icon={<Lock className="w-4 h-4" />}
        maxLength={6}
        inputMode="numeric"
        value={inviteCode}
        onChange={(e) => setInviteCode(e.target.value.replace(/\D/g, ''))}
        helperText="6-digit code from the same SMS"
      />

      <Button type="submit" loading={loading} className="w-full mt-2">
        Verify & Continue
      </Button>

      <p className="text-center text-sm text-gray-500 pt-2">
        Already have an account?{' '}
        <Link href="/login" className="text-primary-600 hover:underline font-semibold">
          Sign in
        </Link>
      </p>
    </form>
  );
}
