'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TeacherSubject {
  classId: string;
  class: { id: string; name: string };
  subjectId: string;
  subject: { id: string; name: string };
}

export interface TeacherProfile {
  id: string;
  staffId: string;
  classTeacherOf: { id: string; name: string; level: string } | null;
  subjectTeachers: TeacherSubject[];
}

export interface AppUser {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'TEACHER' | 'PARENT';
  teacherProfile?: TeacherProfile | null;
}

interface UserContextValue {
  user: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  isClassTeacher: boolean;
  /** Teacher with subject assignments but no class of their own */
  isSubjectTeacher: boolean;
  /** The classId this teacher is class-teacher of (null if not a class teacher) */
  myClassId: string | null;
  /** Subject+class combos this teacher teaches */
  mySubjects: TeacherSubject[];
  /** Reload the user profile from /auth/me */
  refresh: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
  isAdmin: false,
  isTeacher: false,
  isClassTeacher: false,
  isSubjectTeacher: false,
  myClassId: null,
  mySubjects: [],
  refresh: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // Optimistically read from localStorage first (no flash)
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const parsed: AppUser = JSON.parse(raw);
        setUser((prev) => prev ?? parsed); // only seed if not already loaded
      }
    } catch { /* ignore */ }

    // Fetch full profile from /auth/me
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) { setLoading(false); return; }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const fullUser: AppUser = data.user;
        setUser(fullUser);
        // Update localStorage so next page load is instant
        localStorage.setItem('user', JSON.stringify({
          id: fullUser.id,
          phone: fullUser.phone,
          firstName: fullUser.firstName,
          lastName: fullUser.lastName,
          role: fullUser.role,
        }));
      }
    } catch { /* silently keep cached value */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isAdmin = user?.role === 'ADMIN';
  const isTeacher = user?.role === 'TEACHER';
  const isClassTeacher = isTeacher && !!user?.teacherProfile?.classTeacherOf;
  const myClassId = user?.teacherProfile?.classTeacherOf?.id ?? null;
  const mySubjects = user?.teacherProfile?.subjectTeachers ?? [];
  const isSubjectTeacher = isTeacher && !isClassTeacher && mySubjects.length > 0;

  return (
    <UserContext.Provider value={{ user, loading, isAdmin, isTeacher, isClassTeacher, isSubjectTeacher, myClassId, mySubjects, refresh: load }}>
      {children}
    </UserContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUser() {
  return useContext(UserContext);
}
