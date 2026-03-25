'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Button, Modal, Input, Alert,
  Badge, SkeletonTable, PageHeader,
} from '@/components/ui';
import {
  UserPlus, GraduationCap, Phone, Hash,
  CheckCircle2, Clock, MoreVertical,
} from 'lucide-react';

interface Teacher {
  id: string;
  staffId: string;
  qualification: string | null;
  classTeacherOf: { id: string; name: string } | null;
  user: {
    firstName: string;
    lastName: string;
    phone: string;
    isActive: boolean;
  };
}

interface InviteResult {
  staffId: string;
  maskedPhone: string;
  name: string;
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Invite modal state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/teachers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load teachers');
      const data = await res.json();
      setTeachers(data.teachers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teachers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

  const handleInviteSuccess = (result: InviteResult) => {
    setInviteResult(result);
    fetchTeachers(); // refresh list
  };

  const closeInvite = () => {
    setInviteOpen(false);
    setInviteResult(null);
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto animate-fade-in">
      <PageHeader
        title="Teachers"
        subtitle={loading ? '' : `${teachers.length} staff member${teachers.length !== 1 ? 's' : ''}`}
        actions={
          <Button icon={<UserPlus className="w-4 h-4" />} onClick={() => setInviteOpen(true)}>
            Invite Teacher
          </Button>
        }
      />

      {error && (
        <Alert type="error" message={error} className="mb-6" onDismiss={() => setError('')} />
      )}

      {loading ? (
        <SkeletonTable rows={6} />
      ) : teachers.length === 0 ? (
        <EmptyState onInvite={() => setInviteOpen(true)} />
      ) : (
        <TeachersTable teachers={teachers} />
      )}

      {/* Invite Modal */}
      <Modal
        isOpen={inviteOpen}
        onClose={closeInvite}
        title={inviteResult ? 'Invitation Sent!' : 'Invite Teacher'}
        size="sm"
      >
        {inviteResult ? (
          <InviteSuccessView result={inviteResult} onDone={closeInvite} onInviteAnother={() => setInviteResult(null)} />
        ) : (
          <InviteForm onSuccess={handleInviteSuccess} onCancel={closeInvite} />
        )}
      </Modal>
    </div>
  );
}

// ─── Teachers Table ───────────────────────────────────────────────────────────

function TeachersTable({ teachers }: { teachers: Teacher[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
      {/* Table header */}
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
        <span>Teacher</span>
        <span>Staff ID</span>
        <span className="hidden md:block">Phone</span>
        <span className="hidden lg:block">Class</span>
        <span className="text-right">Status</span>
      </div>

      <div className="divide-y divide-gray-100">
        {teachers.map((teacher) => (
          <TeacherRow key={teacher.id} teacher={teacher} />
        ))}
      </div>
    </div>
  );
}

function TeacherRow({ teacher }: { teacher: Teacher }) {
  const fullName = `${teacher.user.firstName} ${teacher.user.lastName}`.trim();
  const initials = `${teacher.user.firstName[0] ?? ''}${teacher.user.lastName[0] ?? ''}`.toUpperCase();

  return (
    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center px-6 py-4 hover:bg-gray-50 transition-colors group">
      {/* Name + avatar */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{fullName || '—'}</p>
          {teacher.qualification && (
            <p className="text-xs text-gray-500 truncate">{teacher.qualification}</p>
          )}
        </div>
      </div>

      {/* Staff ID */}
      <div className="flex items-center gap-1.5 text-sm font-mono font-semibold text-gray-700">
        <Hash className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        {teacher.staffId}
      </div>

      {/* Phone */}
      <div className="hidden md:flex items-center gap-1.5 text-sm text-gray-600">
        <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        {teacher.user.phone}
      </div>

      {/* Class */}
      <div className="hidden lg:block text-sm text-gray-600 truncate">
        {teacher.classTeacherOf ? (
          <span className="font-medium text-primary-700">{teacher.classTeacherOf.name}</span>
        ) : (
          <span className="text-gray-400 italic">Not assigned</span>
        )}
      </div>

      {/* Status */}
      <div className="flex items-center justify-end gap-2">
        {teacher.user.isActive ? (
          <Badge variant="success">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Active
          </Badge>
        ) : (
          <Badge variant="warning">
            <Clock className="w-3 h-3 mr-1" /> Pending
          </Badge>
        )}
        <button className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Invite Form ──────────────────────────────────────────────────────────────

function InviteForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: (result: InviteResult) => void;
  onCancel: () => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setError('All fields are required.');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ firstName, lastName, phone }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send invitation');

      onSuccess({
        staffId: data.staffId,
        maskedPhone: data.phone,
        name: `${firstName} ${lastName}`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="First Name"
          placeholder="Kwame"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <Input
          label="Last Name"
          placeholder="Asante"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
      </div>

      <Input
        label="Phone Number"
        placeholder="024XXXXXXX"
        inputMode="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        helperText="An SMS with their Staff ID and invitation code will be sent here."
      />

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" loading={loading} className="flex-1">
          Send Invitation
        </Button>
      </div>
    </form>
  );
}

// ─── Invite Success View ──────────────────────────────────────────────────────

function InviteSuccessView({
  result,
  onDone,
  onInviteAnother,
}: {
  result: InviteResult;
  onDone: () => void;
  onInviteAnother: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center text-center gap-3 py-2">
        <div className="w-14 h-14 rounded-full bg-success-100 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-success-600" />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-lg">{result.name}</p>
          <p className="text-sm text-gray-500">has been invited successfully</p>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 font-medium">Staff ID</span>
          <span className="font-mono font-bold text-gray-900 text-base">{result.staffId}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 font-medium">SMS sent to</span>
          <span className="font-semibold text-gray-700">{result.maskedPhone}</span>
        </div>
      </div>

      <p className="text-xs text-gray-500 text-center">
        Keep note of the Staff ID. The teacher needs it to accept their invitation.
      </p>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onInviteAnother} className="flex-1">
          Invite Another
        </Button>
        <Button onClick={onDone} className="flex-1">
          Done
        </Button>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onInvite }: { onInvite: () => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-[var(--shadow-card)] flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mb-4">
        <GraduationCap className="w-8 h-8 text-primary-500" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">No teachers yet</h3>
      <p className="text-gray-500 max-w-sm mb-6">
        Invite your first teacher. They&apos;ll receive an SMS with their Staff ID and a code to set up their account.
      </p>
      <Button icon={<UserPlus className="w-4 h-4" />} onClick={onInvite}>
        Invite First Teacher
      </Button>
    </div>
  );
}
