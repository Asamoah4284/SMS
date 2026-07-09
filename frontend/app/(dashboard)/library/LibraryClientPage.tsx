'use client';

import { useState, useEffect, useCallback } from 'react';
import { Alert, Badge, Button, Modal, PageHeader, Input } from '@/components/ui';
import { BookOpen, Plus, Trash2, Edit2, Users, Loader2 } from 'lucide-react';

interface Book {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  description: string | null;
  priceGhs: number;
  coverUrl: string | null;
  isActive: boolean;
  _count?: { assignments: number; payments: number };
}

interface Term {
  id: string;
  name: string;
  year: number;
  isCurrent: boolean;
}

interface ClassItem {
  id: string;
  name: string;
}

interface Assignment {
  id: string;
  bookId: string;
  classId: string | null;
  termId: string;
  book: Book;
  class: { id: string; name: string } | null;
  term: { id: string; name: string; year: number };
}

interface StudentPaymentRow {
  student: { id: string; studentId: string; firstName: string; lastName: string };
  books: { title: string; isPaid: boolean; remaining: number }[];
  balance: number;
}

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
}
const API = process.env.NEXT_PUBLIC_API_URL;

export default function LibraryClientPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classPayments, setClassPayments] = useState<StudentPaymentRow[]>([]);
  const [selectedTermId, setSelectedTermId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'catalog' | 'assignments' | 'payments'>('catalog');
  const [bookModal, setBookModal] = useState<Book | null | 'new'>(null);
  const [assignModal, setAssignModal] = useState(false);

  const [form, setForm] = useState({
    title: '',
    author: '',
    isbn: '',
    description: '',
    priceGhs: '',
    coverUrl: '',
  });
  const [assignForm, setAssignForm] = useState({ bookId: '', classId: '' });

  useEffect(() => {
    const token = getToken();
    Promise.all([
      fetch(`${API}/terms`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`${API}/classes?limit=100`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([termsData, classesData]) => {
        const list: Term[] = termsData.terms ?? [];
        setTerms(list);
        const cur = list.find((t) => t.isCurrent);
        setSelectedTermId(cur?.id ?? list[0]?.id ?? '');
        setClasses(classesData.classes ?? classesData ?? []);
      })
      .catch(() => setError('Failed to load terms/classes'));
  }, []);

  const fetchBooks = useCallback(async () => {
    const token = getToken();
    const res = await fetch(`${API}/books`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setBooks(await res.json());
  }, []);

  const fetchAssignments = useCallback(async () => {
    if (!selectedTermId) return;
    const token = getToken();
    const params = new URLSearchParams({ termId: selectedTermId });
    if (selectedClassId) params.set('classId', selectedClassId);
    const res = await fetch(`${API}/books/assignments/list?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setAssignments(await res.json());
  }, [selectedTermId, selectedClassId]);

  const fetchClassPayments = useCallback(async () => {
    if (!selectedClassId || !selectedTermId) {
      setClassPayments([]);
      return;
    }
    const token = getToken();
    const res = await fetch(`${API}/books/class/${selectedClassId}?termId=${selectedTermId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setClassPayments(data.students ?? []);
    }
  }, [selectedClassId, selectedTermId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([fetchBooks(), fetchAssignments(), fetchClassPayments()]);
    } catch {
      setError('Failed to load library data');
    } finally {
      setLoading(false);
    }
  }, [fetchBooks, fetchAssignments, fetchClassPayments]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openBookModal = (book: Book | 'new') => {
    if (book === 'new') {
      setForm({ title: '', author: '', isbn: '', description: '', priceGhs: '', coverUrl: '' });
    } else {
      setForm({
        title: book.title,
        author: book.author ?? '',
        isbn: book.isbn ?? '',
        description: book.description ?? '',
        priceGhs: String(book.priceGhs),
        coverUrl: book.coverUrl ?? '',
      });
    }
    setBookModal(book);
  };

  const saveBook = async () => {
    const token = getToken();
    const body = {
      title: form.title,
      author: form.author || null,
      isbn: form.isbn || null,
      description: form.description || null,
      priceGhs: parseFloat(form.priceGhs),
      coverUrl: form.coverUrl || null,
    };
    const isEdit = bookModal && bookModal !== 'new';
    const res = await fetch(`${API}/books${isEdit ? `/${bookModal.id}` : ''}`, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json();
      alert(d.message || 'Failed to save book');
      return;
    }
    setBookModal(null);
    fetchBooks();
  };

  const deleteBook = async (id: string) => {
    if (!confirm('Remove this book from the catalog?')) return;
    const token = getToken();
    await fetch(`${API}/books/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchBooks();
  };

  const saveAssignment = async () => {
    if (!assignForm.bookId || !assignForm.classId || !selectedTermId) {
      alert('Select book, class, and term');
      return;
    }
    const token = getToken();
    const res = await fetch(`${API}/books/assign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookId: assignForm.bookId,
        classId: assignForm.classId,
        termId: selectedTermId,
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      alert(d.message || 'Failed to assign');
      return;
    }
    setAssignModal(false);
    setAssignForm({ bookId: '', classId: '' });
    fetchAssignments();
    fetchClassPayments();
  };

  const removeAssignment = async (id: string) => {
    if (!confirm('Remove this assignment?')) return;
    const token = getToken();
    await fetch(`${API}/books/assign/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchAssignments();
    fetchClassPayments();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Textbook Library"
        subtitle="Manage books, class requirements, and payment tracking"
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
            >
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.year}
                </option>
              ))}
            </select>
            <Button onClick={() => openBookModal('new')}>
              <Plus className="w-4 h-4 mr-1" /> Add Book
            </Button>
          </div>
        }
      />

      {error && <Alert type="error" message={error} />}

      <div className="flex gap-2 border-b">
        {(['catalog', 'assignments', 'payments'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
            }`}
          >
            {t === 'catalog' ? 'Catalog' : t === 'assignments' ? 'Assignments' : 'Payments'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {tab === 'catalog' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {books.map((book) => (
                <div key={book.id} className="p-4 bg-white border rounded-xl shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{book.title}</h3>
                        {book.author && <p className="text-sm text-gray-500">{book.author}</p>}
                      </div>
                    </div>
                    <Badge variant="info">GH₵{book.priceGhs.toFixed(2)}</Badge>
                  </div>
                  {book.description && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{book.description}</p>
                  )}
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" variant="secondary" onClick={() => openBookModal(book)}>
                      <Edit2 className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => deleteBook(book.id)}>
                      <Trash2 className="w-3 h-3 mr-1" /> Remove
                    </Button>
                  </div>
                </div>
              ))}
              {books.length === 0 && (
                <p className="col-span-full text-gray-500 text-center py-8">No books yet. Add your first textbook.</p>
              )}
            </div>
          )}

          {tab === 'assignments' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  className="border rounded-lg px-3 py-2 text-sm"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                >
                  <option value="">All classes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <Button onClick={() => setAssignModal(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Assign to Class
                </Button>
              </div>
              <div className="bg-white border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left">
                    <tr>
                      <th className="px-4 py-3">Book</th>
                      <th className="px-4 py-3">Class</th>
                      <th className="px-4 py-3">Term</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((a) => (
                      <tr key={a.id} className="border-t">
                        <td className="px-4 py-3 font-medium">{a.book.title}</td>
                        <td className="px-4 py-3">{a.class?.name ?? '—'}</td>
                        <td className="px-4 py-3">
                          {a.term.name} {a.term.year}
                        </td>
                        <td className="px-4 py-3">GH₵{a.book.priceGhs.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            className="text-red-600 text-xs"
                            onClick={() => removeAssignment(a.id)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {assignments.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No assignments for this term.</p>
                )}
              </div>
            </div>
          )}

          {tab === 'payments' && (
            <div className="space-y-4">
              <select
                className="border rounded-lg px-3 py-2 text-sm"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
              >
                <option value="">Select a class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {!selectedClassId ? (
                <p className="text-gray-500">Select a class to view payment status.</p>
              ) : (
                <div className="bg-white border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left">
                      <tr>
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Books status</th>
                        <th className="px-4 py-3">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classPayments.map((row) => (
                        <tr key={row.student.id} className="border-t">
                          <td className="px-4 py-3">
                            <div className="font-medium">
                              {row.student.firstName} {row.student.lastName}
                            </div>
                            <div className="text-xs text-gray-500">{row.student.studentId}</div>
                          </td>
                          <td className="px-4 py-3">
                            {row.books.length === 0 ? (
                              <span className="text-gray-400">No books assigned</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {row.books.map((b, i) => (
                                  <Badge key={i} variant={b.isPaid ? 'success' : 'warning'}>
                                    {b.title.slice(0, 20)}
                                    {b.title.length > 20 ? '…' : ''}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {row.balance > 0 ? (
                              <span className="text-amber-700 font-medium">GH₵{row.balance.toFixed(2)}</span>
                            ) : (
                              <Badge variant="success">Paid</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {bookModal && (
        <Modal
          isOpen
          onClose={() => setBookModal(null)}
          title={bookModal === 'new' ? 'Add Book' : 'Edit Book'}
        >
          <div className="space-y-3 p-2">
            <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <Input label="Author" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
            <Input label="ISBN" value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} />
            <Input label="Price (GHS)" type="number" step="0.01" value={form.priceGhs} onChange={(e) => setForm({ ...form, priceGhs: e.target.value })} required />
            <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Input label="Cover URL" value={form.coverUrl} onChange={(e) => setForm({ ...form, coverUrl: e.target.value })} />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setBookModal(null)}>Cancel</Button>
              <Button onClick={saveBook}>Save</Button>
            </div>
          </div>
        </Modal>
      )}

      {assignModal && (
        <Modal isOpen onClose={() => setAssignModal(false)} title="Assign Book to Class">
          <div className="space-y-3 p-2">
            <label className="block text-sm font-medium">Book</label>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={assignForm.bookId}
              onChange={(e) => setAssignForm({ ...assignForm, bookId: e.target.value })}
            >
              <option value="">Select book</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title} — GH₵{b.priceGhs}
                </option>
              ))}
            </select>
            <label className="block text-sm font-medium">Class</label>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={assignForm.classId}
              onChange={(e) => setAssignForm({ ...assignForm, classId: e.target.value })}
            >
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setAssignModal(false)}>Cancel</Button>
              <Button onClick={saveAssignment}>
                <Users className="w-4 h-4 mr-1" /> Assign
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
