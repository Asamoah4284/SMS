'use client';

import { ReactNode } from 'react';
import { useUser } from '@/lib/UserContext';
import TeacherDashboard from './TeacherDashboard';

export default function OverviewRoleGate({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useUser();

  if (loading) return null;
  if (!isAdmin) return <TeacherDashboard />;
  return <>{children}</>;
}
