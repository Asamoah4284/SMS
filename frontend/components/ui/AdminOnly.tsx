'use client';

import { useUser } from '@/lib/UserContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';

/**
 * Wraps a page/section that should only be visible to ADMINs.
 * Teachers see a friendly "access denied" message and are redirected
 * to /overview after a short delay.
 */
export default function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && !isAdmin) {
      const t = setTimeout(() => router.replace('/overview'), 2000);
      return () => clearTimeout(t);
    }
  }, [loading, user, isAdmin, router]);

  if (loading) return null; // layout already shows skeleton-free content

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center px-4">
        <div className="w-16 h-16 bg-danger-50 rounded-2xl flex items-center justify-center mb-4">
          <ShieldAlert size={32} className="text-danger-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-gray-500 max-w-sm">
          This section is only available to administrators. You will be redirected to the dashboard.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
