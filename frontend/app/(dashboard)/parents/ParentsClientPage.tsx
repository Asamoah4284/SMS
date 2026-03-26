'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Alert, PageHeader, SkeletonTable } from '@/components/ui';
import { UserRound, Phone, Users, ChevronRight, Search } from 'lucide-react';

interface Parent {
  id: string;
  user: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    isActive: boolean;
  };
  childrenCount: number;
  children: Array<{ id: string; name: string; studentId: string; class: { name: string } | null }>;
}

export default function ParentsClientPage() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchParents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken');
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/parents${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load parents');
      const data = await res.json();
      setParents(data.parents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load parents');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => fetchParents(), 300);
    return () => clearTimeout(t);
  }, [fetchParents]);

  return (
    <div className="p-8 max-w-[1600px] mx-auto animate-fade-in">
      <PageHeader
        title="Parents & Guardians"
        subtitle={loading ? '' : `${parents.length} guardian${parents.length !== 1 ? 's' : ''}`}
      />

      {error && <Alert type="error" message={error} className="mb-6" onDismiss={() => setError('')} />}

      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
        />
      </div>

      {loading ? (
        <SkeletonTable rows={6} />
      ) : parents.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
          <div className="grid grid-cols-[2fr_1fr_1fr_2fr_auto] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
            <span>Parent / Guardian</span>
            <span className="hidden md:block">Phone</span>
            <span>Children</span>
            <span className="hidden lg:block">Classes</span>
            <span />
          </div>
          <div className="divide-y divide-gray-100">
            {parents.map((parent) => (
              <ParentRow key={parent.id} parent={parent} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ParentRow({ parent }: { parent: Parent }) {
  const fullName = `${parent.user.firstName} ${parent.user.lastName}`.trim() || 'Unnamed Guardian';
  const initials = `${parent.user.firstName[0] ?? ''}${parent.user.lastName[0] ?? ''}`.toUpperCase() || '??';

  return (
    <Link
      href={`/parents/${parent.id}`}
      className="grid grid-cols-[2fr_1fr_1fr_2fr_auto] gap-4 items-center px-6 py-4 hover:bg-gray-50 transition-colors group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-warning-100 text-warning-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate group-hover:text-primary-700 transition-colors">{fullName}</p>
          {parent.user.email && <p className="text-xs text-gray-400 truncate">{parent.user.email}</p>}
        </div>
      </div>

      <div className="hidden md:flex items-center gap-1.5 text-sm text-gray-600">
        <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        {parent.user.phone}
      </div>

      <div className="flex items-center gap-1.5 text-sm text-gray-700">
        <Users className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <span className="font-semibold">{parent.childrenCount}</span>
        <span className="text-gray-400">{parent.childrenCount === 1 ? 'child' : 'children'}</span>
      </div>

      <div className="hidden lg:flex flex-wrap gap-1.5">
        {parent.children.slice(0, 3).map((child) => (
          <span key={child.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 text-xs font-semibold rounded-full">
            {child.class?.name ?? 'No class'}
          </span>
        ))}
        {parent.children.length > 3 && (
          <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
            +{parent.children.length - 3} more
          </span>
        )}
      </div>

      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-[var(--shadow-card)] flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-warning-50 flex items-center justify-center mb-4">
        <UserRound className="w-8 h-8 text-warning-500" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">No parents registered</h3>
      <p className="text-gray-500 max-w-sm">
        Parents who create accounts through the parent portal will appear here. You can then assign their children to them.
      </p>
    </div>
  );
}
