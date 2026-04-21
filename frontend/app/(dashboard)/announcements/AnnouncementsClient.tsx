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
}

export default function AnnouncementsClient() {
  const { user } = useUser();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newAudience, setNewAudience] = useState<'ALL' | 'TEACHERS' | 'STUDENTS' | 'PARENTS'>('ALL');

  const canCreate = user?.role === 'SUPER_ADMIN' || user?.role === 'SCHOOL_ADMIN' || user?.role === 'TEACHER';

  useEffect(() => {
    fetchAnnouncements();
  }, [user]);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'}/announcements`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch announcements');
      const data = await res.json();
      setAnnouncements(data.data || []);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'}/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          title: newTitle,
          content: newContent,
          targetAudience: newAudience
        })
      });
      if (!res.ok) throw new Error('Failed to create announcement');
      setIsModalOpen(false);
      fetchAnnouncements();
      setNewTitle('');
      setNewContent('');
      setNewAudience('ALL');
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Announcements" 
        actions={canCreate ? <Button onClick={() => setIsModalOpen(true)}>Create Announcement</Button> : undefined}
      />
      
      {error && <Alert type="error" message={error} />}
      
      {loading ? (
        <p>Loading announcements...</p>
      ) : (
        <div className="space-y-4">
          {announcements.map((ann) => (
            <div key={ann.id} className="p-4 bg-white rounded shadow">
              <h3 className="text-lg font-semibold">{ann.title}</h3>
              <p className="text-sm text-gray-500 mb-2">To: {ann.targetAudience} - {new Date(ann.createdAt).toLocaleDateString()}</p>
              <p>{ann.content}</p>
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
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewAudience(e.target.value)}
              >
                <option value="ALL">All</option>
                <option value="TEACHERS">Teachers</option>
                <option value="STUDENTS">Students</option>
                <option value="PARENTS">Parents</option>
              </select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit">Submit</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
