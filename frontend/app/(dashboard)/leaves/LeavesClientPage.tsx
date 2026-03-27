'use client';

import { useState, useEffect, useCallback } from 'react';
import { Alert, Badge, Button, Modal, PageHeader } from '@/components/ui';
import { ClipboardList, Plus, CheckCircle2, XCircle, Clock, Trash2, Users } from 'lucide-react';
import { useUser } from '@/lib/UserContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type LeaveType = 'SICK_LEAVE' | 'CASUAL_LEAVE' | 'MATERNITY_LEAVE' | 'PATERNITY_LEAVE' | 'STUDY_LEAVE' | 'OTHER';

interface LeaveRequest {
  id: string;
  type: LeaveType;
  reason: string;
  startDate: string;
  endDate: string;
  status: LeaveStatus;
  adminNote: string | null;
  createdAt: string;
  user?: {
    firstName: string;
    lastName: string;
    phone: string;
    teacherProfile: { staffId: string } | null;
  };
}

const API = process.env.NEXT_PUBLIC_API_URL;

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
}

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  SICK_LEAVE: 'Sick Leave',
  CASUAL_LEAVE: 'Casual Leave',
  MATERNITY_LEAVE: 'Maternity Leave',
  PATERNITY_LEAVE: 'Paternity Leave',
  STUDY_LEAVE: 'Study Leave',
  OTHER: 'Other',
};

function statusBadge(status: LeaveStatus) {
  if (status === 'APPROVED') return <Badge variant="success">Approved</Badge>;
  if (status === 'REJECTED') return <Badge variant="error">Rejected</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LeavesClientPage() {
  const { isAdmin, isTeacher } = useUser();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | 'ALL'>('ALL');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [actionRequest, setActionRequest] = useState<LeaveRequest | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      const params = statusFilter !== 'ALL' ? `?status=${statusFilter}` : '';
      const res = await fetch(`${API}/permissions${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load requests');
      const data = await res.json();
      setRequests(data.requests ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleCancel = async (id: string) => {
    try {
      const token = getToken();
      const res = await fetch(`${API}/permissions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? 'Failed to cancel');
      }
      fetchRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel request');
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Leave Requests"
        subtitle={isAdmin ? 'Manage staff leave requests' : 'Submit and track your leave requests'}
        actions={
          isTeacher && !isAdmin ? (
            <Button onClick={() => setShowSubmitModal(true)}>
              <Plus size={16} className="mr-1.5" />
              Request Leave
            </Button>
          ) : undefined
        }
      />

      {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ClipboardList size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No leave requests found</p>
          {isTeacher && !isAdmin && (
            <p className="text-sm mt-1">Use the button above to submit a new request</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <LeaveCard
              key={req.id}
              request={req}
              isAdmin={isAdmin}
              onCancel={handleCancel}
              onAction={() => setActionRequest(req)}
            />
          ))}
        </div>
      )}

      {showSubmitModal && (
        <SubmitLeaveModal
          onClose={() => setShowSubmitModal(false)}
          onSuccess={() => { setShowSubmitModal(false); fetchRequests(); }}
        />
      )}

      {actionRequest && (
        <AdminActionModal
          request={actionRequest}
          onClose={() => setActionRequest(null)}
          onSuccess={() => { setActionRequest(null); fetchRequests(); }}
        />
      )}
    </div>
  );
}

// ─── Leave Card ───────────────────────────────────────────────────────────────

function LeaveCard({
  request,
  isAdmin,
  onCancel,
  onAction,
}: {
  request: LeaveRequest;
  isAdmin: boolean;
  onCancel: (id: string) => void;
  onAction: () => void;
}) {
  const dateRange = `${formatDate(request.startDate)} – ${formatDate(request.endDate)}`;
  const submittedOn = formatDate(request.createdAt);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Admin sees teacher name */}
          {isAdmin && request.user && (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                {request.user.firstName[0]}{request.user.lastName[0]}
              </div>
              <span className="font-semibold text-gray-900">
                {request.user.firstName} {request.user.lastName}
              </span>
              {request.user.teacherProfile?.staffId && (
                <span className="text-xs text-gray-400">#{request.user.teacherProfile.staffId}</span>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-gray-900">
              {LEAVE_TYPE_LABELS[request.type]}
            </span>
            {statusBadge(request.status)}
          </div>
          <p className="text-sm text-gray-500 mt-1">{dateRange}</p>
          <p className="text-sm text-gray-700 mt-2 line-clamp-2">{request.reason}</p>
          {request.adminNote && (
            <p className="text-sm text-primary-700 mt-1 italic">Note: {request.adminNote}</p>
          )}
          <p className="text-xs text-gray-400 mt-2">Submitted {submittedOn}</p>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {isAdmin && request.status === 'PENDING' && (
            <Button size="sm" onClick={onAction}>
              Review
            </Button>
          )}
          {!isAdmin && request.status === 'PENDING' && (
            <button
              onClick={() => onCancel(request.id)}
              className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
              title="Cancel request"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Submit Leave Modal ───────────────────────────────────────────────────────

function SubmitLeaveModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    type: 'SICK_LEAVE' as LeaveType,
    reason: '',
    startDate: '',
    endDate: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.reason.trim()) { setError('Please provide a reason'); return; }
    if (!form.startDate || !form.endDate) { setError('Please select both dates'); return; }
    if (form.startDate > form.endDate) { setError('End date must be after start date'); return; }

    setLoading(true);
    setError('');
    try {
      const token = getToken();
      const res = await fetch(`${API}/permissions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? 'Failed to submit');
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen title="Request Leave" onClose={onClose} size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} loading={loading}>Submit Request</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert type="error" message={error} />}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Leave Type</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as LeaveType })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            {(Object.entries(LEAVE_TYPE_LABELS) as [LeaveType, string][]).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason</label>
          <textarea
            rows={3}
            placeholder="Briefly describe the reason for your leave..."
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
          />
        </div>
      </form>
    </Modal>
  );
}

// ─── Admin Action Modal ───────────────────────────────────────────────────────

function AdminActionModal({
  request,
  onClose,
  onSuccess,
}: {
  request: LeaveRequest;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [adminNote, setAdminNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handle = async (status: 'APPROVED' | 'REJECTED') => {
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      const res = await fetch(`${API}/permissions/${request.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNote: adminNote.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? 'Failed');
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process');
    } finally {
      setLoading(false);
    }
  };

  const dateRange = `${formatDate(request.startDate)} – ${formatDate(request.endDate)}`;

  return (
    <Modal isOpen title="Review Leave Request" onClose={onClose} size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="danger" onClick={() => handle('REJECTED')} loading={loading}>Reject</Button>
          <Button onClick={() => handle('APPROVED')} loading={loading}>
            <CheckCircle2 size={15} className="mr-1.5" />
            Approve
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert type="error" message={error} />}

        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">
              {request.user?.firstName} {request.user?.lastName}
            </span>
            {request.user?.teacherProfile?.staffId && (
              <span className="text-xs text-gray-400">#{request.user.teacherProfile.staffId}</span>
            )}
          </div>
          <p className="text-sm text-gray-700">
            <span className="font-medium">{LEAVE_TYPE_LABELS[request.type]}</span>
            {' · '}{dateRange}
          </p>
          <p className="text-sm text-gray-600">{request.reason}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Note to teacher <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="Add a note to send with your decision..."
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
          />
        </div>
      </div>
    </Modal>
  );
}
