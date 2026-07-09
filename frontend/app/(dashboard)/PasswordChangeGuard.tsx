'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@/lib/UserContext';

/**
 * Redirects staff to /change-password when mustChangePassword is set (e.g. after CSV seed).
 */
export function PasswordChangeGuard({ children }: { children: React.ReactNode }) {
  const { mustChangePassword, loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (mustChangePassword && pathname !== '/change-password') {
      router.replace('/change-password');
    }
  }, [mustChangePassword, loading, pathname, router]);

  if (!loading && mustChangePassword && pathname !== '/change-password') {
    return null;
  }

  return children;
}
