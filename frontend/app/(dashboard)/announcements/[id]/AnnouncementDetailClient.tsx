'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Megaphone, Trash2 } from 'lucide-react';
import { useUser } from '@/lib/UserContext';
import { Alert, Badge, Button, PageHeader } from '@/components/ui';

interface Announcement {
  id: string;
  title: string;
  content: string;
  targetAudience: 'ALL' | 'TEACHERS' | 'STUDENTS' | 'PARENTS';
  createdAt: string;
  authorName?: string;
}

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

const AUDIENCE_LABEL: Record<string, string> = {
  ALL: 'Everyone',
  TEACHERS: 'Teachers',
  STUDENTS: 'Students',
  PARENTS: 'Parents',
};

export default function AnnouncementDetailClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useUser();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const canDelete = user?.role === 'ADMIN' || user?.role === 'TEACHER';

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError('');
        const res = await fetch(`${API}/announcements/${id}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Failed to load announcement');
        if (!cancelled) setAnnouncement(data);
      } catch (err: unknown) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleDelete = async () => {
    if (!announcement) return;
    if (!window.confirm(`Delete announcement “${announcement.title}”?`)) return;
    try {
      setDeleting(true);
      const res = await fetch(`${API}/announcements/${announcement.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to delete');
      router.push('/announcements');
    } catch (err: unknown) {
      alert((err as Error).message);
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 px-4 py-4 sm:px-6 md:px-8 max-w-[900px] mx-auto animate-fade-in min-h-full">
      <div className="flex items-center gap-3">
        <Link
          href="/announcements"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to announcements
        </Link>
      </div>

      {error && <Alert type="error" message={error} />}

      {loading ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-gray-500 shadow-sm">
          Loading announcement…
        </div>
      ) : announcement ? (
        <article className="rounded-2xl border border-gray-100 bg-white shadow-[var(--shadow-card)] overflow-hidden">
          <div className="px-5 sm:px-6 py-5 border-b border-gray-100 bg-primary-50/40">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                    <Megaphone className="w-4 h-4" />
                  </span>
                  <Badge variant="info">
                    {AUDIENCE_LABEL[announcement.targetAudience] || announcement.targetAudience}
                  </Badge>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-950">
                  {announcement.title}
                </h1>
                <p className="mt-2 text-sm text-gray-500">
                  {announcement.authorName ? `${announcement.authorName} · ` : ''}
                  {new Date(announcement.createdAt).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
              {canDelete && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                >
                  <Trash2 className="w-4 h-4" />
                  {deleting ? 'Deleting…' : 'Delete'}
                </Button>
              )}
            </div>
          </div>
          <div className="px-5 sm:px-6 py-6">
            <p className="text-[15px] leading-7 text-gray-800 whitespace-pre-wrap">
              {announcement.content}
            </p>
          </div>
        </article>
      ) : !error ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-gray-500 shadow-sm">
          Announcement not found.
        </div>
      ) : null}
    </div>
  );
}
