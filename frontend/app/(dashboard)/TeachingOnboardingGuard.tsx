'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@/lib/UserContext';

/**
 * Subject-only teachers must complete `/onboarding/teaching` before using the rest of the app.
 */
export function TeachingOnboardingGuard({ children }: { children: React.ReactNode }) {
  const { needsTeachingSetup, loading } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!needsTeachingSetup) return;
    if (pathname === '/onboarding/teaching' || pathname.startsWith('/onboarding/teaching/')) return;
    router.replace('/onboarding/teaching');
  }, [loading, needsTeachingSetup, pathname, router]);

  return <>{children}</>;
}
