'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Sliders, LogOut, GraduationCap } from 'lucide-react';
import { useUser } from '@/lib/UserContext';

interface ProfileDropdownProps {
  displayName: string;
  roleLabel: string;
  initials: string;
}

export function ProfileDropdown({ displayName, roleLabel, initials }: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { user, isTeacher } = useUser();
  const staffId = user?.teacherProfile?.staffId;
  const teacherProfileId = user?.teacherProfile?.id;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    document.cookie = 'accessToken=; path=/; max-age=0; samesite=lax';
    router.push('/login');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className="flex items-center gap-3 cursor-pointer group p-1.5 rounded-lg hover:bg-gray-50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <div className="flex flex-col text-right hidden sm:flex">
          <span className="text-sm font-semibold text-gray-800 leading-tight group-hover:text-blue-600 transition-colors">
            {displayName}
          </span>
          <span className="text-xs text-gray-500 uppercase tracking-wider">{roleLabel}</span>
          {isTeacher && staffId && (
            <span className="text-[11px] text-gray-400 font-mono tracking-normal normal-case mt-0.5">
              {staffId}
            </span>
          )}
        </div>
        <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-full shadow-sm flex items-center justify-center ring-2 ring-white border border-gray-100 text-white font-bold tracking-tight">
          {initials}
        </div>
      </div>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
          <div className="p-3 border-b border-gray-50 sm:hidden">
            <p className="text-sm font-semibold text-gray-800">{displayName}</p>
            <p className="text-xs text-gray-500 uppercase">{roleLabel}</p>
            {isTeacher && staffId && (
              <p className="text-[11px] text-gray-400 font-mono mt-0.5">{staffId}</p>
            )}
          </div>
          <div className="p-1">
            <Link
              href="/settings?tab=account"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <User className="w-4 h-4" />
              View Profile
            </Link>
            {isTeacher && teacherProfileId && (
              <Link
                href={`/teachers/${teacherProfileId}`}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <GraduationCap className="w-4 h-4" />
                Teaching profile
              </Link>
            )}
            <Link
              href="/settings?tab=preferences"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <Sliders className="w-4 h-4" />
              Preferences
            </Link>
          </div>
          <div className="p-1 border-t border-gray-50">
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
