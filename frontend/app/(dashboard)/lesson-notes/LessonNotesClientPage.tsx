'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Input } from '@/components/ui';
import { Download, FileText, Trash2, Upload } from 'lucide-react';

type ClassItem = { id: string; name: string; level: string };
type Note = {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
  class: ClassItem;
  uploader: { firstName: string; lastName: string } | null;
};

const API = process.env.NEXT_PUBLIC_API_URL;
const fileSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default function LessonNotesClientPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const isAdmin = typeof window !== 'undefined' && JSON.parse(localStorage.getItem('user') || '{}').role === 'ADMIN';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API}/lesson-notes`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load lesson notes');
      setNotes(data.notes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lesson notes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    fetch(`${API}/classes?limit=200`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => setClasses(data.classes ?? []))
      .catch(() => setError('Failed to load classes'));
    load();
  }, [load]);

  const upload = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!title.trim() || !classId || !file) {
      setError('Choose a class, enter a title, and select a file.');
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append('title', title.trim());
      body.append('classId', classId);
      body.append('file', file);
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API}/lesson-notes`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      setTitle('');
      setFile(null);
      setClassId('');
      setMessage('Lesson note uploaded successfully.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const download = async (note: Note) => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API}/lesson-notes/${note.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setError('Could not download this lesson note.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = note.fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const remove = async (note: Note) => {
    if (!window.confirm(`Delete "${note.title}"?`)) return;
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API}/lesson-notes/${note.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setError('Could not delete this lesson note.');
      return;
    }
    await load();
  };

  return (
    <div className="p-5 sm:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Teaching resources</p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">Lesson Notes</h1>
        <p className="text-sm text-gray-500 mt-1">View the notes shared with your class.</p>
      </div>

      {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}
      {message && <Alert type="success" message={message} onDismiss={() => setMessage('')} />}

      {isAdmin && (
        <form onSubmit={upload} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 font-bold text-gray-900"><Upload className="w-4 h-4 text-primary-600" /> Upload lesson note</div>
          <div className="grid sm:grid-cols-3 gap-3">
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Week 4 Mathematics" />
            <label className="block text-xs font-medium text-gray-600">
              Class
              <select value={classId} onChange={(e) => setClassId(e.target.value)} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
                <option value="">Select class</option>
                {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium text-gray-600">
              File
              <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-xs text-gray-600" />
            </label>
          </div>
          <p className="text-xs text-gray-400">PDF, Word, Excel, or PowerPoint files up to 25 MB.</p>
          <Button type="submit" loading={uploading} icon={<Upload className="w-4 h-4" />}>Upload note</Button>
        </form>
      )}

      {loading ? <p className="text-sm text-gray-500">Loading lesson notes…</p> : notes.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center">
          <FileText className="w-8 h-8 text-gray-300 mx-auto" />
          <p className="font-semibold text-gray-700 mt-3">No lesson notes yet</p>
          <p className="text-sm text-gray-500 mt-1">Notes shared with your class will appear here.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {notes.map((note) => (
            <div key={note.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex gap-4">
              <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0"><FileText className="w-5 h-5" /></div>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-gray-900 truncate">{note.title}</h2>
                <p className="text-xs text-gray-500 truncate mt-1">{note.fileName}</p>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <Badge variant="default">{note.class.name}</Badge>
                  <span className="text-xs text-gray-400">{fileSize(note.fileSize)}</span>
                  <span className="text-xs text-gray-400">{new Date(note.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button type="button" variant="secondary" onClick={() => download(note)} icon={<Download className="w-4 h-4" />}>Download</Button>
                  {isAdmin && <button type="button" onClick={() => remove(note)} className="p-2 text-gray-400 hover:text-danger-600" title="Delete lesson note"><Trash2 className="w-4 h-4" /></button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
