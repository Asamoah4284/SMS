'use client';

import Sidebar from './Sidebar';
import { useState } from 'react';
import { Bell, Menu } from 'lucide-react';
import { UserProvider, useUser } from '@/lib/UserContext';
import { TeachingOnboardingGuard } from './TeachingOnboardingGuard';
import { PasswordChangeGuard } from './PasswordChangeGuard';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { ProfileDropdown } from '@/components/ui/ProfileDropdown';

function DashboardHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const { user } = useUser();
  const first = user?.firstName?.trim() ?? '';
  const last = user?.lastName?.trim() ?? '';
  const initials = `${first.charAt(0)}${last.charAt(0)}`.trim().toUpperCase() || 'AD';
  const displayName = user ? `${first} ${last}`.trim() || 'Account' : 'Loading…';
  const roleLabel = user?.role === 'ADMIN' ? 'Administrator' : user?.role === 'TEACHER' ? 'Teacher' : 'User';
  const staffId = user?.teacherProfile?.staffId;

  return (
    <header className="bg-white border-b border-gray-200 h-16 md:h-20 flex items-center justify-between px-4 md:px-8 shrink-0 z-10 w-full relative">
      <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
        <button
          type="button"
          aria-label="Open sidebar"
          className="md:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          onClick={onMenuClick}
        >
          <Menu className="w-5 h-5" />
        </button>
        {user?.role === 'TEACHER' && staffId && (
          <div className="hidden sm:flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-100 px-3 py-1.5">
            <span className="text-xs font-medium text-gray-500">Staff ID</span>
            <span className="text-xs font-mono font-semibold text-gray-800">{staffId}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-6">
        <NotificationBell />
        <div className="h-8 w-px bg-gray-200 hidden sm:block" />
        <ProfileDropdown 
          displayName={displayName} 
          roleLabel={roleLabel} 
          initials={initials} 
        />
      </div>
    </header>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <UserProvider>
      <div className="flex h-screen bg-white overflow-hidden font-sans relative">
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close sidebar"
            className="fixed inset-0 bg-black/30 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col h-screen min-w-0">
          <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />

          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-white custom-scrollbar h-full w-full">
            <div className="min-h-full">
              <PasswordChangeGuard>
                <TeachingOnboardingGuard>{children}</TeachingOnboardingGuard>
              </PasswordChangeGuard>
            </div>
          </main>
        </div>
      </div>
    </UserProvider>
  );
}
