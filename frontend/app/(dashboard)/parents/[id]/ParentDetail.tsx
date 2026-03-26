'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Modal } from '@/components/ui';
import {
  Phone, Mail, Calendar, Users, BookOpen, CheckCircle2,
  AlertTriangle, CreditCard, ChevronRight, UserPlus,
  Search, X, TrendingDown,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  studentId: string;
  class: { id: string; name: string } | null;
  attendanceRate: number | null;
  recentAbsences: number;
  fees: {
    totalDue: number;
    totalPaid: number;
    balance: number;
    status: 'FULLY_PAID' | 'PARTIAL' | 'UNPAID';
  };
}

interface ParentData {
  id: string;
  user: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    isActive: boolean;
    joinedAt: string;
  };
  children: Child[];
}

interface UnassignedStudent {
  id: string;
  name: string;
  studentId: string;
  class: { name: string } | null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ParentDetail({ parentId }: { parentId: string }) {
  const [parent, setParent] = useState<ParentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);

  const fetchParent = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/parents/${parentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Parent not found');
      setParent(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load parent');
    } finally {
      setLoading(false);
    }
  }, [parentId]);

  useEffect(() => { fetchParent(); }, [fetchParent]);

  const handleUnassign = async (studentId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/parents/${parentId}/students/${studentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to unassign');
      fetchParent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unassign student');
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 md:p-8 max-w-[1200px] mx-auto animate-fade-in space-y-5">
        <div className="h-8 w-40 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-36 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error && !parent) return <div className="p-8"><Alert type="error" message={error} /></div>;
  if (!parent) return null;

  const fullName = `${parent.user.firstName} ${parent.user.lastName}`.trim() || 'Unnamed Guardian';
  const initials = `${parent.user.firstName[0] ?? ''}${parent.user.lastName[0] ?? ''}`.toUpperCase() || '??';
  const totalFeeBalance = parent.children.reduce((s, c) => s + c.fees.balance, 0);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1200px] mx-auto animate-fade-in space-y-5">
      <Link href="/parents" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium">
        ← Back to Parents
      </Link>

      {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}

      {/* Profile header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-start gap-4 flex-col sm:flex-row">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-lg flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{fullName}</h1>
              {parent.user.isActive
                ? <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1" />Active</Badge>
                : <Badge variant="default">Inactive</Badge>}
            </div>
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 text-sm text-gray-600 mt-2">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                {parent.user.phone}
              </span>
              {parent.user.email && (
                <span className="flex items-center gap-1.5 min-w-0">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  <span className="truncate">{parent.user.email}</span>
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                Registered{" "}
                {new Date(parent.user.joinedAt).toLocaleDateString("en-GB", {
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
          <a
            href={`tel:${parent.user.phone}`}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-50 text-primary-700 rounded-xl font-semibold text-sm hover:bg-primary-100 transition-colors"
          >
            <Phone className="w-4 h-4" />
            Call
          </a>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm text-center">
          <Users className="w-6 h-6 text-primary-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-gray-900">{parent.children.length}</p>
          <p className="text-xs text-gray-500 font-medium">Child{parent.children.length !== 1 ? 'ren' : ''}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm text-center">
          <CheckCircle2 className="w-6 h-6 text-success-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-gray-900">
            {parent.children.length > 0
              ? `${Math.round(parent.children.filter((c) => c.attendanceRate !== null).reduce((s, c) => s + (c.attendanceRate ?? 0), 0) / Math.max(parent.children.filter((c) => c.attendanceRate !== null).length, 1))}%`
              : '—'}
          </p>
          <p className="text-xs text-gray-500 font-medium">Avg Attendance</p>
        </div>
        <div className={`bg-white border border-gray-200 rounded-2xl p-4 shadow-sm text-center ${totalFeeBalance > 0 ? 'border-danger-200 bg-danger-50/30' : ''}`}>
          <CreditCard className={`w-6 h-6 mx-auto mb-1 ${totalFeeBalance > 0 ? 'text-danger-600' : 'text-success-600'}`} />
          <p className={`text-2xl font-bold ${totalFeeBalance > 0 ? 'text-danger-700' : 'text-success-700'}`}>
            {totalFeeBalance > 0 ? `GHS ${totalFeeBalance.toFixed(2)}` : 'Paid'}
          </p>
          <p className="text-xs text-gray-500 font-medium">Fee Balance</p>
        </div>
      </div>

      {/* Children */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Children</h2>
            <p className="text-sm text-gray-500">{parent.children.length} enrolled student{parent.children.length !== 1 ? 's' : ''}</p>
          </div>
          <Button className="w-full sm:w-auto" size="sm" icon={<UserPlus className="w-3.5 h-3.5" />} onClick={() => setAssignOpen(true)}>
            Assign Child
          </Button>
        </div>

        {parent.children.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <Users className="w-8 h-8 mx-auto mb-2 text-gray-200" />
            <p className="text-sm">No children assigned yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {parent.children.map((child) => (
              <ChildCard key={child.id} child={child} onUnassign={() => handleUnassign(child.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Assign modal */}
      <Modal isOpen={assignOpen} onClose={() => setAssignOpen(false)} title="Assign Child" size="sm">
        <AssignStudentForm
          parentId={parentId}
          onAssigned={() => { setAssignOpen(false); fetchParent(); }}
          onCancel={() => setAssignOpen(false)}
        />
      </Modal>
    </div>
  );
}

// ─── Child Card ───────────────────────────────────────────────────────────────

function ChildCard({ child, onUnassign }: { child: Child; onUnassign: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  const feeStatusCls: Record<Child['fees']['status'], string> = {
    FULLY_PAID: 'bg-success-50 text-success-700 border-success-200',
    PARTIAL: 'bg-warning-50 text-warning-700 border-warning-200',
    UNPAID: 'bg-danger-50 text-danger-700 border-danger-200',
  };
  const feeLabel: Record<Child['fees']['status'], string> = {
    FULLY_PAID: 'Fees Paid',
    PARTIAL: `GHS ${child.fees.balance.toFixed(2)} due`,
    UNPAID: `GHS ${child.fees.balance.toFixed(2)} due`,
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 px-4 sm:px-6 py-4 hover:bg-gray-50/50 transition-colors">
      <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
        {`${child.firstName[0]}${child.lastName[0]}`.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <Link href={`/students/${child.id}`} className="font-bold text-gray-900 hover:text-primary-700 transition-colors">
            {child.firstName} {child.lastName}
          </Link>
          <span className="text-xs font-mono text-gray-400">{child.studentId}</span>
        </div>
        <div className="flex flex-wrap gap-3 mt-1">
          {child.class && (
            <Link href={`/classes/${child.class.id}`} className="flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline">
              <BookOpen className="w-3 h-3" />{child.class.name}
            </Link>
          )}
          {child.attendanceRate !== null && (
            <span className={`flex items-center gap-1 text-xs font-semibold ${child.attendanceRate >= 75 ? 'text-success-700' : 'text-danger-700'}`}>
              {child.attendanceRate >= 75
                ? <CheckCircle2 className="w-3 h-3" />
                : <TrendingDown className="w-3 h-3" />}
              {child.attendanceRate}% attendance
            </span>
          )}
          {child.recentAbsences > 2 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-warning-700">
              <AlertTriangle className="w-3 h-3" />{child.recentAbsences} recent absences
            </span>
          )}
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${feeStatusCls[child.fees.status]}`}>
            <CreditCard className="w-3 h-3" />{feeLabel[child.fees.status]}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
        <Link href={`/students/${child.id}`} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
          <ChevronRight className="w-4 h-4" />
        </Link>
        {!confirming ? (
          <button onClick={() => setConfirming(true)} className="p-1.5 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={async () => { setRemoving(true); await onUnassign(); setRemoving(false); setConfirming(false); }}
              disabled={removing}
              className="text-xs font-semibold px-2 py-1 bg-danger-600 text-white rounded-lg hover:bg-danger-700 disabled:opacity-50"
            >
              {removing ? '...' : 'Remove'}
            </button>
            <button onClick={() => setConfirming(false)} className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Assign Student Form ──────────────────────────────────────────────────────

function AssignStudentForm({
  parentId, onAssigned, onCancel,
}: {
  parentId: string;
  onAssigned: () => void;
  onCancel: () => void;
}) {
  const [students, setStudents] = useState<UnassignedStudent[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/parents/unassigned-students/list${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load students');
      const data = await res.json();
      setStudents(data.students);
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchStudents, 300);
    return () => clearTimeout(t);
  }, [fetchStudents]);

  const handleAssign = async (studentId: string) => {
    setAssigning(studentId);
    setError('');
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/parents/${parentId}/students/${studentId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign');
      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign student');
    } finally {
      setAssigning(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Select a student to assign to this parent. Only students without a linked guardian are shown.</p>

      {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search students..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
        />
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
        {loading ? (
          <div className="py-8 text-center text-sm text-gray-400">Loading...</div>
        ) : students.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">
            {search ? 'No students match your search' : 'All students are already assigned to a guardian'}
          </div>
        ) : (
          students.map((student) => (
            <div key={student.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{student.name}</p>
                <p className="text-xs text-gray-500">{student.studentId} · {student.class?.name ?? 'No class'}</p>
              </div>
              <button
                onClick={() => handleAssign(student.id)}
                disabled={assigning === student.id}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {assigning === student.id ? '...' : <><UserPlus className="w-3 h-3" />Assign</>}
              </button>
            </div>
          ))
        )}
      </div>

      <Button variant="secondary" onClick={onCancel} className="w-full">Done</Button>
    </div>
  );
}
