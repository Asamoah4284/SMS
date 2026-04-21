"use client";

import React, { useEffect, useState } from 'react';
import { useUser } from '@/lib/UserContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';

interface LibraryItem {
  id: string;
  title: string;
  description: string;
  fileUrl: string;
  uploadedBy: string;
  createdAt: string;
}

export default function LibraryPage() {
  const { user } = useUser();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newFileUrl, setNewFileUrl] = useState('');

  const canUpload = user?.role === 'ADMIN' || user?.role === 'TEACHER';

  useEffect(() => {
    fetchLibrary();
  }, [user]);

  const fetchLibrary = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'}/library`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Failed to fetch library materials');
      const data = await res.json();
      setItems(data.data || []);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'}/library`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          fileUrl: newFileUrl
        })
      });
      if (!res.ok) throw new Error('Failed to upload material');
      setIsModalOpen(false);
      fetchLibrary();
      setNewTitle('');
      setNewDesc('');
      setNewFileUrl('');
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const filteredItems = items.filter(i => 
    i.title.toLowerCase().includes(search.toLowerCase()) || 
    i.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Library" 
        actions={
          <div className="flex space-x-2">
            <Input 
              placeholder="Search..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
            {canUpload && (
              <Button onClick={() => setIsModalOpen(true)}>Upload Material</Button>
            )}
          </div>
        }
      />
      
      {error && <Alert type="error" message={error} />}

      {loading ? (
        <p>Loading digital materials...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map(item => (
            <div key={item.id} className="p-4 bg-white border rounded shadow-sm">
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="text-sm text-gray-500 mb-2">{new Date(item.createdAt).toLocaleDateString()}</p>
              <p className="mb-4 text-gray-700">{item.description}</p>
              <a href={item.fileUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                View Material
              </a>
            </div>
          ))}
          {filteredItems.length === 0 && <p className="col-span-full">No materials found.</p>}
        </div>
      )}

      {isModalOpen && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Upload Digital Material">
          <form onSubmit={handleUpload} className="space-y-4 p-4">
            <Input 
              label="Title" 
              value={newTitle} 
              onChange={(e) => setNewTitle(e.target.value)} 
              required 
            />
            <Input 
              label="Description" 
              value={newDesc} 
              onChange={(e) => setNewDesc(e.target.value)} 
            />
            <Input 
              label="File URL" 
              value={newFileUrl} 
              onChange={(e) => setNewFileUrl(e.target.value)} 
              required 
            />
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit">Upload</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
