'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Alert } from '@/components/ui';
import { Lock, AlertCircle } from 'lucide-react';

interface OTPVerificationProps {
  phone: string;
}

export default function OTPVerification({ phone }: OTPVerificationProps) {
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'otp' | 'password'>('otp');
  const [tempToken, setTempToken] = useState('');
  const router = useRouter();

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otp.length !== 6) {
      setError('OTP must be 6 digits');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/verify-otp`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, otp }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid OTP');
      }

      setTempToken(data.tempToken);
      setStep('password');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError('Password must have uppercase, lowercase, and a number');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/reset-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tempToken,
            phone,
            password: newPassword,
            confirmPassword,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      router.push('/login?reset=success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'otp') {
    return (
      <form onSubmit={handleOtpSubmit} className="flex flex-col gap-5">
        {error && (
          <Alert
            type="error"
            message={error}
            dismissible
            onDismiss={() => setError('')}
          />
        )}

        <p className="text-sm text-gray-600">
          We sent a 6-digit code to {phone}
        </p>

        <Input
          label="OTP Code"
          placeholder="000000"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          helperText="Check your SMS inbox"
        />

        <Button
          type="submit"
          loading={loading}
          className="w-full mt-2"
        >
          Verify OTP
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-5">
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
        label="New Password"
        type="password"
        placeholder="••••••••"
        icon={<Lock className="w-4 h-4" />}
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
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
        Reset Password
      </Button>
    </form>
  );
}
