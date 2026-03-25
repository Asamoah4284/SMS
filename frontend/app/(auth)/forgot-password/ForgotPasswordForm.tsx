'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, Input, Alert } from '@/components/ui';
import { Phone } from 'lucide-react';
import OTPVerification from './OTPVerification';

export default function ForgotPasswordForm() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!phone.trim()) {
      setError('Please enter your phone number');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/forgot-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      setOtpSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  if (otpSent) {
    return <OTPVerification phone={phone} />;
  }

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

      <Input
        label="Phone Number"
        placeholder="0241234567"
        icon={<Phone className="w-4 h-4" />}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        helperText="Ghana format: 0241234567 or +233241234567"
      />

      <Button
        type="submit"
        loading={loading}
        className="w-full mt-2"
      >
        Send OTP via SMS
      </Button>

      <div className="pt-2 text-center text-sm">
        <p className="text-gray-600">
          Remember your password?{' '}
          <Link href="/login" className="text-primary-600 hover:underline font-medium">
            Sign in here
          </Link>
        </p>
      </div>
    </form>
  );
}
