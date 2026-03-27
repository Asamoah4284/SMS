'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Smartphone, ChevronRight, Users } from 'lucide-react';
import { Alert, Button, Input } from '@/components/ui';

interface Child {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  photo: string | null;
  class: { id: string; name: string } | null;
}

export default function ParentPortalAuthPage() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [children, setChildren] = useState<Child[] | null>(null);
  const [token, setToken] = useState('');
  const [selecting, setSelecting] = useState<string | null>(null);
  const router = useRouter();

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!phone.trim()) {
      setError('Please enter your phone number.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/parent/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Lookup failed');
      }

      setToken(data.token);
      setChildren(data.children);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChild = (child: Child) => {
    setSelecting(child.studentId);

    // Save token in cookie (7 days) and selected student in sessionStorage
    document.cookie = `parentToken=${token}; path=/; max-age=604800; samesite=lax`;
    sessionStorage.setItem('portalStudent', JSON.stringify({
      studentId: child.studentId,
      firstName: child.firstName,
      lastName: child.lastName,
      class: child.class,
    }));

    router.push('/parent-portal/portal');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 text-primary-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Parent Portal</h2>
          <p className="text-gray-500 text-sm mt-1.5">
            Enter the phone number you registered with
          </p>
        </div>

        {/* Step 1: Phone lookup */}
        {!children && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
            {error && (
              <Alert
                type="error"
                title={
                  error.toLowerCase().includes('no children')
                    ? 'Phone not found'
                    : 'Something went wrong'
                }
                message={error}
                dismissible
                onDismiss={() => setError('')}
                className="mb-4"
              />
            )}

            <form onSubmit={handleLookup} className="flex flex-col gap-4">
              <Input
                label="Phone Number"
                type="tel"
                placeholder="e.g. 0241234567"
                icon={<Smartphone className="w-4 h-4" />}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoFocus
              />
              <Button type="submit" loading={loading} className="w-full">
                Find My Children
              </Button>
            </form>
          </div>
        )}

        {/* Step 2: Children selection */}
        {children && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-700">
                {children.length === 1
                  ? '1 child found'
                  : `${children.length} children found`}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Select who you want to view</p>
            </div>

            <ul className="divide-y divide-gray-100">
              {children.map((child) => (
                <li key={child.id}>
                  <button
                    onClick={() => handleSelectChild(child)}
                    disabled={selecting !== null}
                    className="w-full flex items-center gap-3.5 px-5 py-4 hover:bg-gray-50 transition-colors text-left disabled:opacity-60"
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 text-primary-700 font-bold text-sm">
                      {child.firstName[0]}{child.lastName[0]}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">
                        {child.firstName} {child.lastName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {child.class?.name ?? 'No class assigned'} &middot; {child.studentId}
                      </p>
                    </div>

                    {selecting === child.studentId ? (
                      <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                  </button>
                </li>
              ))}
            </ul>

            <div className="px-5 py-3 border-t border-gray-100">
              <button
                onClick={() => { setChildren(null); setToken(''); setError(''); }}
                className="text-sm text-primary-600 hover:underline font-medium"
              >
                Use a different number
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
