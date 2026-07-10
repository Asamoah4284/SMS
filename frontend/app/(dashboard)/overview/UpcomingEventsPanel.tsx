'use client';

import { useCallback, useState } from 'react';
import {
  CalendarDays,
  ClipboardCheck,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
} from 'lucide-react';
import { Modal, Button, Alert } from '@/components/ui';
import { getApiBase } from '@/lib/apiBase';

export type UpcomingEventItem = {
  id: string;
  title: string;
  date: string;
  type: 'assessment' | 'exam' | 'term' | 'event';
  subtitle: string;
  description?: string | null;
  location?: string | null;
  isCustom?: boolean;
};

const EVENT_STYLES: Record<
  UpcomingEventItem['type'],
  { icon: typeof CalendarDays; iconClass: string; iconBg: string }
> = {
  assessment: {
    icon: ClipboardCheck,
    iconClass: 'text-purple-700',
    iconBg: 'bg-purple-50 border-purple-100',
  },
  exam: {
    icon: ClipboardCheck,
    iconClass: 'text-purple-700',
    iconBg: 'bg-purple-50 border-purple-100',
  },
  term: {
    icon: CalendarDays,
    iconClass: 'text-emerald-700',
    iconBg: 'bg-emerald-50 border-emerald-100',
  },
  event: {
    icon: CalendarDays,
    iconClass: 'text-blue-700',
    iconBg: 'bg-blue-50 border-blue-100',
  },
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
}

type EventForm = {
  title: string;
  description: string;
  location: string;
  eventDate: string;
};

const emptyForm = (): EventForm => ({
  title: '',
  description: '',
  location: '',
  eventDate: '',
});

export default function UpcomingEventsPanel({
  initialEvents,
  isAdmin,
}: {
  initialEvents: UpcomingEventItem[];
  isAdmin: boolean;
}) {
  const API = getApiBase();
  const [events, setEvents] = useState(initialEvents);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UpcomingEventItem | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const refreshEvents = useCallback(async () => {
    const res = await fetch(`${API}/events`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) return;
    const custom = (await res.json()) as Array<{
      id: string;
      title: string;
      date: string;
      subtitle: string;
      description?: string;
      location?: string;
    }>;
    setEvents((prev) => {
      const auto = prev.filter((e) => !e.isCustom && e.type !== 'event');
      const merged = [
        ...auto,
        ...custom.map((e) => ({
          id: e.id,
          title: e.title,
          date: e.date,
          type: 'event' as const,
          subtitle: e.subtitle,
          description: e.description,
          location: e.location,
          isCustom: true,
        })),
      ]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 8);
      return merged;
    });
  }, [API]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError('');
    setModalOpen(true);
  };

  const openEdit = (event: UpcomingEventItem) => {
    setEditing(event);
    setForm({
      title: event.title,
      description: event.description ?? '',
      location: event.location ?? '',
      eventDate: toDatetimeLocalValue(event.date),
    });
    setError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm());
    setError('');
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.eventDate) {
      setError('Title and date/time are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        location: form.location.trim() || null,
        eventDate: new Date(form.eventDate).toISOString(),
      };
      const url = editing ? `${API}/events/${editing.id}` : `${API}/events`;
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save event');

      setSuccess(
        editing
          ? 'Event updated.'
          : `Event created — ${data.notifications?.push?.sent ?? 0} parent push, ${data.notifications?.inApp ?? 0} staff notified.`
      );
      closeModal();
      await refreshEvents();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (event: UpcomingEventItem) => {
    if (!window.confirm(`Delete “${event.title}”?`)) return;
    setDeletingId(event.id);
    try {
      const res = await fetch(`${API}/events/${event.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete');
      }
      await refreshEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-900">Upcoming Events</h3>
        {isAdmin ? (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add event
          </button>
        ) : null}
      </div>

      {success ? (
        <Alert type="success" message={success} dismissible={false} className="mb-3 text-xs" />
      ) : null}
      {error && !modalOpen ? (
        <Alert type="error" message={error} dismissible={false} className="mb-3 text-xs" />
      ) : null}

      <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
        {events.length === 0 ? (
          <p className="text-xs text-gray-500 px-4 py-6">
            No upcoming events scheduled.
            {isAdmin ? ' Tap “Add event” to create one.' : ''}
          </p>
        ) : (
          events.map((e) => {
            const style = EVENT_STYLES[e.type];
            const Icon = style.icon;
            const canManage = isAdmin && e.isCustom;
            return (
              <div
                key={e.id}
                className="flex items-center justify-between gap-4 px-4 py-3 bg-white hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={[
                      'w-9 h-9 rounded-xl border flex items-center justify-center shrink-0',
                      style.iconBg,
                    ].join(' ')}
                  >
                    <Icon className={['w-4.5 h-4.5', style.iconClass].join(' ')} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-gray-900 truncate">{e.title}</p>
                    <p className="text-[11px] font-medium text-gray-500 truncate">{e.subtitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <p className="text-[11px] font-semibold text-gray-500 hidden sm:block">
                    {formatDateTime(e.date)}
                  </p>
                  {canManage ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(e)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50"
                        aria-label="Edit event"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(e)}
                        disabled={deletingId === e.id}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                        aria-label="Delete event"
                      >
                        {deletingId === e.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit event' : 'Add school event'}>
        <div className="space-y-4">
          {error ? <Alert type="error" message={error} dismissible={false} /> : null}
          {!editing ? (
            <p className="text-xs text-gray-500">
              Saving will notify all teachers in the dashboard and send a push notification to the parent app.
            </p>
          ) : null}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. PTA Meeting"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date & time</label>
            <input
              type="datetime-local"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              value={form.eventDate}
              onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location (optional)</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="e.g. School assembly hall"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <textarea
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-400"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Details parents and teachers should know"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'Save changes' : 'Create & notify'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
