'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  GraduationCap,
  Megaphone,
  CalendarDays,
  ExternalLink,
} from 'lucide-react';
import { Alert, Badge, Button } from '@/components/ui';
import { api } from '@/lib/api';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  type: string;
  createdAt: string;
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

function relatedHref(type: string): string | null {
  if (type === 'ANNOUNCEMENT') return '/announcements';
  if (type === 'LEAVE_REQUEST' || type === 'LEAVE_UPDATE') return '/leaves';
  if (type === 'FEE_PAYMENT') return '/fees';
  if (type === 'BOOK_PAYMENT') return '/library';
  return null;
}

function relatedLabel(type: string): string {
  if (type === 'ANNOUNCEMENT') return 'Open announcements';
  if (type === 'LEAVE_REQUEST' || type === 'LEAVE_UPDATE') return 'Open leave requests';
  if (type === 'FEE_PAYMENT') return 'Open fees';
  if (type === 'BOOK_PAYMENT') return 'Open library';
  return 'Open related page';
}

function typeMeta(type: string) {
  switch (type) {
    case 'ANNOUNCEMENT':
      return { label: 'Announcement', icon: Megaphone, variant: 'info' as const };
    case 'LEAVE_REQUEST':
    case 'LEAVE_UPDATE':
      return { label: 'Leave', icon: CalendarDays, variant: 'warning' as const };
    case 'FEE_PAYMENT':
      return { label: 'School fees', icon: GraduationCap, variant: 'success' as const };
    case 'BOOK_PAYMENT':
      return { label: 'Book payment', icon: BookOpen, variant: 'success' as const };
    default:
      return { label: 'Notification', icon: Bell, variant: 'default' as const };
  }
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function NotificationDetailClient() {
  const { id } = useParams<{ id: string }>();
  const [notification, setNotification] = useState<NotificationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError('');
        const token = getAccessToken();
        if (!token) throw new Error('Please sign in again');
        const data = await api.get<NotificationItem>(`/notifications/${id}`, token);
        if (!cancelled) setNotification(data);
      } catch (err: unknown) {
        if (!cancelled) setError((err as Error).message || 'Failed to load notification');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const meta = notification ? typeMeta(notification.type) : null;
  const Icon = meta?.icon ?? Bell;
  const actionHref = notification ? relatedHref(notification.type) : null;

  return (
    <div className="space-y-6 px-4 py-4 sm:px-6 md:px-8 max-w-[900px] mx-auto animate-fade-in min-h-full">
      <div className="flex items-center gap-3">
        <Link
          href="/overview"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
      </div>

      {error && <Alert type="error" message={error} />}

      {loading ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-gray-500 shadow-sm">
          Loading notification…
        </div>
      ) : notification && meta ? (
        <article className="rounded-2xl border border-gray-100 bg-white shadow-[var(--shadow-card)] overflow-hidden">
          <div className="px-5 sm:px-6 py-5 border-b border-gray-100 bg-primary-50/40">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                    <Icon className="w-4 h-4" />
                  </span>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-950">
                  {notification.title}
                </h1>
                <p className="mt-2 text-sm text-gray-500">{formatWhen(notification.createdAt)}</p>
              </div>
            </div>
          </div>

          <div className="px-5 sm:px-6 py-6">
            <p className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap">
              {notification.message}
            </p>

            {actionHref && (
              <div className="mt-8 pt-5 border-t border-gray-100">
                <Link href={actionHref}>
                  <Button variant="secondary" size="sm">
                    <ExternalLink className="w-4 h-4" />
                    {relatedLabel(notification.type)}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </article>
      ) : null}
    </div>
  );
}
