'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GraduationCap, LogOut, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui';

interface StudentPortalShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  headerExtra?: React.ReactNode;
}

export function StudentPortalShell({
  children,
  title,
  subtitle,
  backHref,
  backLabel = 'Back',
  headerExtra,
}: StudentPortalShellProps) {
  const router = useRouter();

  const signOut = () => {
    localStorage.removeItem('studentToken');
    localStorage.removeItem('studentUser');
    localStorage.removeItem('studentMustChangePin');
    router.push('/student/login');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {backHref ? (
              <Link
                href={backHref}
                className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-primary-700 transition-colors shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{backLabel}</span>
              </Link>
            ) : (
              <Link href="/student/dashboard" className="flex items-center gap-2 shrink-0">
                <div className="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center shadow-sm">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold text-gray-900 hidden sm:inline">Student Portal</span>
              </Link>
            )}
          </div>

          {headerExtra && <div className="shrink-0">{headerExtra}</div>}

          <Button variant="ghost" size="sm" onClick={signOut} className="text-gray-500 shrink-0">
            <LogOut className="w-3.5 h-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>

        {(title || subtitle) && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-3">
            {title && <h1 className="text-lg font-bold text-gray-900 tracking-tight">{title}</h1>}
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
        )}
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-6">{children}</main>
    </div>
  );
}
