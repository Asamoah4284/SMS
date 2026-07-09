"use client";

import React, { useEffect, useState } from 'react';
import { useUser } from '@/lib/UserContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';

interface Announcement {
  id: string;
  title: string;
  content: string;
  targetAudience: 'ALL' | 'TEACHERS' | 'STUDENTS' | 'PARENTS';
  createdAt: string;
  authorName?: string;
  push?: { sent?: number };
}

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export default function AnnouncementsClient() {
  const { user } = useUser();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newAudience, setNewAudience] = useState<'ALL' | 'TEACHERS' | 'STUDENTS' | 'PARENTS'>('PARENTS');
  const [submitting, setSubmitting] = useState(false);

  const canCreate = user?.role === 'ADMIN' || user?.role === 'TEACHER';
  const isTeacher = user?.role === 'TEACHER';

  useEffect(() => {
    fetchAnnouncements();
  }, [user]);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API}/announcements`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to fetch announcements');
      const data = await res.json();
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await fetch(`${API}/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          title: newTitle,
          content: newContent,
          targetAudience: newAudience,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to create announcement');
      setIsModalOpen(false);
      fetchAnnouncements();
      setNewTitle('');
      setNewContent('');
      setNewAudience(isTeacher ? 'PARENTS' : 'ALL');
      const sent = data.push?.sent;
      if (typeof sent === 'number' && sent > 0) {
        alert(`Announcement published. Push sent to ${sent} device(s).`);
      }
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Announcements" 
        actions={canCreate ? <Button onClick={() => setIsModalOpen(true)}>Create Announcement</Button> : undefined}
      />

      {canCreate && (
        <p className="text-sm text-gray-600">
          Posts to <strong>Parents</strong> or <strong>All</strong> send a push notification to the parent app.
          Posts to <strong>Teachers</strong> or <strong>All</strong> also alert staff in the dashboard bell.
        </p>
      )}
      
      {error && <Alert type="error" message={error} />}
      
      {loading ? (
        <p>Loading announcements...</p>
      ) : (
        <div className="space-y-4">
          {announcements.map((ann) => (
            <div key={ann.id} className="p-4 bg-white rounded shadow">
              <h3 className="text-lg font-semibold">{ann.title}</h3>
              <p className="text-sm text-gray-500 mb-2">
                To: {ann.targetAudience}
                {ann.authorName ? ` · ${ann.authorName}` : ''}
                {' · '}
                {new Date(ann.createdAt).toLocaleDateString()}
              </p>
              <p className="whitespace-pre-wrap">{ann.content}</p>
            </div>
          ))}
          {announcements.length === 0 && <p>No announcements found.</p>}
        </div>
      )}

      {isModalOpen && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Announcement">
          <form onSubmit={handleCreate} className="space-y-4 p-4">
            <Input 
              label="Title" 
              value={newTitle} 
              onChange={(e) => setNewTitle(e.target.value)} 
              required 
            />
            <div>
              <label className="block text-sm font-medium mb-1">Content</label>
              <textarea 
                className="w-full border rounded p-2"
                rows={4}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Audience</label>
              <select 
                className="w-full border rounded p-2"
                value={newAudience}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewAudience(e.target.value as 'ALL' | 'TEACHERS' | 'STUDENTS' | 'PARENTS')}
              >
                <option value="ALL">All</option>
                {!isTeacher && <option value="TEACHERS">Teachers</option>}
                <option value="STUDENTS">Students</option>
                <option value="PARENTS">Parents (push notification)</option>
              </select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Publishing…' : 'Publish'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
