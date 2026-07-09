'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import Image from 'next/image';
import { Alert, Badge, Button, Modal } from '@/components/ui';
import {
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  Users,
  Search,
  Library,
  BookMarked,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronDown,
  Upload,
  X,
} from 'lucide-react';

interface Book {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  description: string | null;
  priceGhs: number;
  coverUrl: string | null;
  isActive: boolean;
  assignedClass?: { id: string; name: string } | null;
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

type TabId = 'catalog' | 'assignments' | 'payments';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
}
const API = process.env.NEXT_PUBLIC_API_URL;

const TAB_LABELS: Record<TabId, string> = {
  catalog: 'Catalog',
  assignments: 'Assignments',
  payments: 'Payments',
};

const selectClass =
  'appearance-none border border-gray-200 rounded-lg pl-2.5 pr-8 py-1.5 text-xs sm:text-sm bg-white shadow-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-400/40 focus:border-primary-300 transition-shadow';

const fieldInput =
  'w-full px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-400 transition-shadow';

function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
        {required && <span className="text-danger-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-1 leading-snug">{hint}</p>}
    </div>
  );
}

function CoverPreview({
  src,
  title,
  onClick,
}: {
  src: string;
  title: string;
  onClick?: () => void;
}) {
  const trimmed = src.trim();
  const [imgError, setImgError] = useState(false);
  useEffect(() => setImgError(false), [trimmed]);

  const inner = (
    <div className="rounded-lg border border-gray-200 bg-gray-50 overflow-hidden shadow-sm">
      <div className="relative aspect-[3/4] w-full bg-gradient-to-br from-slate-800 via-primary-900 to-primary-800">
        {trimmed && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={trimmed}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
            <Upload className="w-6 h-6 text-white/60 mb-1.5" />
            <p className="text-[10px] text-white/50 leading-tight">Click to upload cover</p>
          </div>
        )}
        {onClick && trimmed && !imgError && (
          <div className="absolute inset-0 bg-black/0 hover:bg-black/25 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
            <span className="text-[10px] font-medium text-white bg-black/50 px-2 py-1 rounded-md">
              Change image
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6 pointer-events-none">
          <p className="text-[11px] font-medium text-white line-clamp-2 leading-tight">
            {title.trim() || 'Untitled book'}
          </p>
        </div>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
        {inner}
      </button>
    );
  }
  return inner;
}

async function uploadCoverImage(file: File): Promise<string> {
  const token = getToken();
  const body = new FormData();
  body.append('cover', file);
  const res = await fetch(`${API}/books/upload-cover`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Failed to upload cover image');
  return data.url as string;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof BookOpen;
  accent: 'primary' | 'success' | 'warning' | 'slate';
}) {
  const accents = {
    primary: 'bg-primary-50 text-primary-700 border-primary-100',
    success: 'bg-success-50 text-success-700 border-success-100',
    warning: 'bg-warning-50 text-warning-800 border-warning-100',
    slate: 'bg-gray-50 text-gray-700 border-gray-100',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-3">
      <div className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center ${accents[accent]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide truncate">{label}</p>
        <p className="text-lg font-bold text-gray-900 tabular-nums leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof BookOpen;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="w-11 h-11 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-primary-600" />
      </div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="text-xs text-gray-500 mt-1 max-w-sm leading-relaxed">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function BookCover({ book }: { book: Book }) {
  if (book.coverUrl) {
    return (
      <div className="relative aspect-[5/3] w-full overflow-hidden rounded-t-xl bg-gray-100">
        <Image
          src={book.coverUrl}
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 33vw"
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
      </div>
    );
  }
  return (
    <div className="relative aspect-[5/3] w-full overflow-hidden rounded-t-xl bg-gradient-to-br from-slate-800 via-primary-900 to-primary-700 flex items-center justify-center">
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_20%,white_0%,transparent_50%)]" />
      <BookOpen className="w-8 h-8 text-white/90 relative z-10 drop-shadow-sm" />
    </div>
  );
}

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
  const [tab, setTab] = useState<TabId>('catalog');
  const [bookModal, setBookModal] = useState<Book | null | 'new'>(null);
  const [assignModal, setAssignModal] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');

  const [form, setForm] = useState({
    title: '',
    author: '',
    isbn: '',
    description: '',
    priceGhs: '',
    coverUrl: '',
    classId: '',
  });
  const [assignForm, setAssignForm] = useState({ bookId: '', classId: '' });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [bookSaving, setBookSaving] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState('');
  const coverInputRef = useRef<HTMLInputElement>(null);

  const clearCoverDraft = useCallback(() => {
    setCoverFile(null);
    setCoverPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setCoverUploadError('');
  }, []);

  useEffect(() => () => {
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
  }, [coverPreviewUrl]);

  const closeBookModal = () => {
    clearCoverDraft();
    setBookModal(null);
  };

  const handleCoverFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setCoverUploadError('Please choose a JPEG, PNG, WebP, or GIF image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setCoverUploadError('Image must be 5 MB or smaller.');
      return;
    }
    setCoverUploadError('');
    setCoverFile(file);
    setForm((f) => ({ ...f, coverUrl: '' }));
    setCoverPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

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
    const params = selectedTermId ? `?termId=${selectedTermId}` : '';
    const res = await fetch(`${API}/books${params}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setBooks(await res.json());
  }, [selectedTermId]);

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

  const selectedTerm = terms.find((t) => t.id === selectedTermId);

  const filteredBooks = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return books;
    return books.filter((b) => {
      const hay = [b.title, b.author, b.isbn, b.description].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [books, catalogSearch]);

  const catalogValue = useMemo(
    () => books.reduce((s, b) => s + b.priceGhs, 0),
    [books],
  );

  const assignmentClasses = useMemo(
    () => new Set(assignments.map((a) => a.classId).filter(Boolean)).size,
    [assignments],
  );

  const paymentStats = useMemo(() => {
    const paid = classPayments.filter((r) => r.balance <= 0 && r.books.length > 0).length;
    const owing = classPayments.filter((r) => r.balance > 0).length;
    const totalOwed = classPayments.reduce((s, r) => s + r.balance, 0);
    return { paid, owing, totalOwed };
  }, [classPayments]);

  const openBookModal = (book: Book | 'new') => {
    clearCoverDraft();
    if (book === 'new') {
      setForm({
        title: '',
        author: '',
        isbn: '',
        description: '',
        priceGhs: '',
        coverUrl: '',
        classId: selectedClassId || '',
      });
    } else {
      setForm({
        title: book.title,
        author: book.author ?? '',
        isbn: book.isbn ?? '',
        description: book.description ?? '',
        priceGhs: String(book.priceGhs),
        coverUrl: book.coverUrl ?? '',
        classId: book.assignedClass?.id ?? '',
      });
    }
    setBookModal(book);
  };

  const coverDisplaySrc = coverPreviewUrl || form.coverUrl;

  const saveBook = async () => {
    if (!selectedTermId) {
      alert('Please select a term first.');
      return;
    }
    if (!form.classId) {
      alert('Please select the class this book is for.');
      return;
    }

    setBookSaving(true);
    setCoverUploadError('');
    const token = getToken();
    try {
      let coverUrl: string | null = form.coverUrl.trim() || null;
      if (coverFile) {
        coverUrl = await uploadCoverImage(coverFile);
      }
      const body = {
        title: form.title,
        author: form.author || null,
        isbn: form.isbn || null,
        description: form.description || null,
        priceGhs: parseFloat(form.priceGhs),
        coverUrl,
        classId: form.classId,
        termId: selectedTermId,
      };
      const isEdit = bookModal && bookModal !== 'new';
      const res = await fetch(`${API}/books${isEdit ? `/${bookModal.id}` : ''}`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Failed to save book');
      }
      closeBookModal();
      fetchBooks();
      fetchAssignments();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save book';
      if (coverFile) setCoverUploadError(msg);
      else alert(msg);
    } finally {
      setBookSaving(false);
    }
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
    <div className="animate-fade-in space-y-4 px-4 py-4 sm:px-6 md:px-8 max-w-[1400px] mx-auto min-h-full">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="hidden sm:flex w-9 h-9 rounded-lg bg-primary-600 text-white items-center justify-center shrink-0">
            <Library className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-gray-900">Textbook Library</h1>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 sm:line-clamp-1">
              Catalog, class assignments, and payment tracking
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="relative">
            <select
              className={selectClass}
              value={selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
            >
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.year}{t.isCurrent ? ' ★' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <Button variant="primary" size="sm" onClick={() => openBookModal('new')}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Book
          </Button>
        </div>
      </div>

      {error && <Alert type="error" message={error} />}

      {/* Toolbar: tabs + contextual filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-0.5 bg-gray-100 p-0.5 rounded-lg w-fit border border-gray-100">
          {(['catalog', 'assignments', 'payments'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                tab === t
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {tab === 'catalog' && !loading && (
          <div className="relative flex-1 max-w-xs sm:max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="Search title, author, ISBN…"
              className="w-full pl-8 pr-3 py-1.5 text-xs sm:text-sm border border-gray-200 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-400/40"
            />
          </div>
        )}

        {tab === 'assignments' && !loading && (
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <select
                className={selectClass}
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
              >
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <Button variant="primary" size="sm" onClick={() => setAssignModal(true)}>
              <Plus className="w-4 h-4 mr-1" /> Assign to Class
            </Button>
          </div>
        )}

        {tab === 'payments' && !loading && (
          <div className="relative max-w-xs w-full sm:w-auto">
            <select
              className={`${selectClass} w-full`}
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
            >
              <option value="">Select a class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}
      </div>

      {/* Stats */}
      {!loading && tab === 'catalog' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <StatCard
            label="Titles in catalog"
            value={String(books.length)}
            sub={selectedTerm ? `${selectedTerm.name} ${selectedTerm.year}` : undefined}
            icon={BookOpen}
            accent="primary"
          />
          <StatCard
            label="Assigned this term"
            value={String(assignments.length)}
            sub="Across all classes"
            icon={BookMarked}
            accent="slate"
          />
          <StatCard
            label="Catalog value"
            value={`GH₵${catalogValue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`}
            sub="Sum of list prices"
            icon={Sparkles}
            accent="success"
          />
        </div>
      )}

      {!loading && tab === 'assignments' && (
        <div className="grid grid-cols-2 gap-2.5 max-w-lg">
          <StatCard
            label="Active assignments"
            value={String(assignments.length)}
            icon={BookMarked}
            accent="primary"
          />
          <StatCard
            label="Classes with books"
            value={String(assignmentClasses)}
            icon={Users}
            accent="slate"
          />
        </div>
      )}

      {!loading && tab === 'payments' && selectedClassId && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <StatCard
            label="Fully paid"
            value={String(paymentStats.paid)}
            icon={CheckCircle2}
            accent="success"
          />
          <StatCard
            label="With balance"
            value={String(paymentStats.owing)}
            icon={Clock}
            accent="warning"
          />
          <StatCard
            label="Outstanding"
            value={`GH₵${paymentStats.totalOwed.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`}
            icon={BookOpen}
            accent="slate"
          />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm animate-pulse">
              <div className="aspect-[5/3] bg-gray-100" />
              <div className="p-3 space-y-2">
                <div className="h-5 w-3/4 bg-gray-200 rounded-md" />
                <div className="h-4 w-1/2 bg-gray-100 rounded-md" />
                <div className="h-9 w-full bg-gray-100 rounded-xl mt-4" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {tab === 'catalog' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredBooks.map((book) => (
                <article
                  key={book.id}
                  className="group bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden hover:shadow-md hover:border-gray-200/80 transition-all flex flex-col"
                >
                  <BookCover book={book} />
                  <div className="p-3 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 group-hover:text-primary-800 transition-colors">
                          {book.title}
                        </h3>
                        {book.author && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{book.author}</p>
                        )}
                      </div>
                      <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md bg-primary-50 text-primary-800 text-[11px] font-bold tabular-nums border border-primary-100">
                        GH₵{book.priceGhs.toFixed(2)}
                      </span>
                    </div>
                    {book.isbn && (
                      <p className="text-[11px] font-mono text-gray-400 mb-2">ISBN {book.isbn}</p>
                    )}
                    {book.assignedClass && (
                      <Badge variant="default" className="mb-2 text-[10px]">
                        {book.assignedClass.name}
                      </Badge>
                    )}
                    {book.description && (
                      <p className="text-xs text-gray-600 line-clamp-2 leading-snug flex-1">{book.description}</p>
                    )}
                    {(book._count?.assignments ?? 0) > 0 && (
                      <p className="text-[11px] text-gray-400 mt-1.5">
                        {book._count?.assignments} assignment{book._count?.assignments !== 1 ? 's' : ''}
                      </p>
                    )}
                    <div className="flex gap-1.5 mt-2.5 pt-2.5 border-t border-gray-50">
                      <Button size="sm" variant="secondary" className="flex-1" onClick={() => openBookModal(book)}>
                        <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                      </Button>
                      <Button size="sm" variant="ghost" className="text-danger-600 hover:bg-danger-50" onClick={() => deleteBook(book.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
              {books.length === 0 && (
                <EmptyState
                  icon={BookOpen}
                  title="Your catalog is empty"
                  description="Add textbooks with title, price, and optional cover image. Parents can pay for assigned books through the portal."
                  action={
                    <Button variant="primary" size="sm" onClick={() => openBookModal('new')}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add your first book
                    </Button>
                  }
                />
              )}
              {books.length > 0 && filteredBooks.length === 0 && (
                <EmptyState
                  icon={Search}
                  title="No matches"
                  description="Try a different search term or clear the filter."
                  action={
                    <Button variant="secondary" size="sm" onClick={() => setCatalogSearch('')}>
                      Clear search
                    </Button>
                  }
                />
              )}
            </div>
          )}

          {tab === 'assignments' && (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-100">
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide">Book</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide">Class</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide">Term</th>
                      <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wide">Price</th>
                      <th className="px-3 py-2 w-20" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {assignments.map((a) => (
                      <tr key={a.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-3 py-2.5 font-medium text-gray-900">{a.book.title}</td>
                        <td className="px-3 py-2.5 text-gray-600">{a.class?.name ?? '—'}</td>
                        <td className="px-3 py-2.5 text-gray-600">{a.term.name} {a.term.year}</td>
                        <td className="px-3 py-2.5 text-right font-medium tabular-nums text-gray-900">
                          GH₵{a.book.priceGhs.toFixed(2)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            className="text-[11px] font-semibold text-danger-600 hover:text-danger-700 px-1.5 py-0.5 rounded hover:bg-danger-50 transition-colors"
                            onClick={() => removeAssignment(a.id)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {assignments.length === 0 && (
                <div className="py-8 text-center">
                  <BookMarked className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 font-medium">No assignments for this term</p>
                  <p className="text-xs text-gray-400 mt-0.5">Assign books to classes so students can purchase them.</p>
                  <Button variant="primary" size="sm" className="mt-4" onClick={() => setAssignModal(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Assign to Class
                  </Button>
                </div>
              )}
            </div>
          )}

          {tab === 'payments' && (
            <>
              {!selectedClassId ? (
                <div className="bg-white border border-dashed border-gray-200 rounded-xl py-8 text-center">
                  <Users className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 font-medium">Select a class</p>
                  <p className="text-xs text-gray-400 mt-0.5 max-w-sm mx-auto">
                    Choose a class above to see payment status for assigned textbooks.
                  </p>
                </div>
              ) : (
                <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-gray-50/80 border-b border-gray-100">
                          <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide">Student</th>
                          <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide">Books</th>
                          <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wide">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {classPayments.map((row) => (
                          <tr key={row.student.id} className="hover:bg-gray-50/60 transition-colors">
                            <td className="px-3 py-2.5">
                              <p className="font-medium text-gray-900 text-sm">
                                {row.student.firstName} {row.student.lastName}
                              </p>
                              <p className="text-[10px] text-gray-400 font-mono">{row.student.studentId}</p>
                            </td>
                            <td className="px-3 py-2.5">
                              {row.books.length === 0 ? (
                                <span className="text-gray-400 text-xs">No books assigned</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {row.books.map((b, i) => (
                                    <Badge key={i} variant={b.isPaid ? 'success' : 'warning'}>
                                      {b.title.length > 18 ? `${b.title.slice(0, 18)}…` : b.title}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {row.balance > 0 ? (
                                <span className="font-semibold text-warning-800 tabular-nums text-sm">
                                  GH₵{row.balance.toFixed(2)}
                                </span>
                              ) : (
                                <Badge variant="success">Paid</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {classPayments.length === 0 && (
                    <p className="text-center text-gray-500 text-sm py-8">No students in this class.</p>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {bookModal && (
        <Modal
          isOpen
          onClose={closeBookModal}
          title={bookModal === 'new' ? 'Add book' : 'Edit book'}
          size="md"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={closeBookModal} disabled={bookSaving}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={saveBook} loading={bookSaving}>
                {bookModal === 'new' ? 'Add to catalog' : 'Save changes'}
              </Button>
            </>
          }
        >
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              handleCoverFile(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            {bookModal === 'new'
              ? `List a textbook for a class in ${selectedTerm?.name ?? 'the selected term'} ${selectedTerm?.year ?? ''}. Parents can pay when it is assigned.`
              : 'Update catalog details. Change the class for this term if needed.'}
          </p>

          <div className="grid sm:grid-cols-[1fr_minmax(120px,140px)] gap-4">
            <div className="space-y-3 min-w-0">
              <FormField label="Title" required>
                <input
                  className={fieldInput}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Mathematics for JHS 1"
                  required
                />
              </FormField>

              <FormField label="Class" required hint={`For ${selectedTerm?.name ?? 'selected term'} ${selectedTerm?.year ?? ''}.`}>
                <div className="relative">
                  <select
                    className={`${selectClass} w-full`}
                    value={form.classId}
                    onChange={(e) => setForm({ ...form, classId: e.target.value })}
                    required
                  >
                    <option value="">Select class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Author">
                  <input
                    className={fieldInput}
                    value={form.author}
                    onChange={(e) => setForm({ ...form, author: e.target.value })}
                    placeholder="Optional"
                  />
                </FormField>
                <FormField label="ISBN">
                  <input
                    className={fieldInput}
                    value={form.isbn}
                    onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                    placeholder="Optional"
                  />
                </FormField>
              </div>

              <FormField label="Price" required hint="Amount in Ghana cedis (GHS).">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                    GH₵
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={`${fieldInput} pl-11 tabular-nums`}
                    value={form.priceGhs}
                    onChange={(e) => setForm({ ...form, priceGhs: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
              </FormField>

              <FormField label="Description">
                <textarea
                  className={`${fieldInput} min-h-[72px] resize-y leading-snug`}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Edition, publisher, or notes for staff…"
                  rows={3}
                />
              </FormField>

              <FormField label="Cover image" hint="JPEG, PNG, WebP or GIF — max 5 MB. Upload or paste a link.">
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-gray-200 rounded-lg text-xs text-gray-600 hover:border-primary-300 hover:bg-primary-50/40 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {coverFile ? coverFile.name : 'Choose image from device'}
                  </span>
                </button>
                <div className="relative mt-2">
                  <input
                    className={fieldInput}
                    value={form.coverUrl}
                    onChange={(e) => {
                      clearCoverDraft();
                      setForm({ ...form, coverUrl: e.target.value });
                    }}
                    placeholder="Or paste image URL (https://…)"
                    type="url"
                    disabled={!!coverFile}
                  />
                  {coverFile && (
                    <button
                      type="button"
                      onClick={clearCoverDraft}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded"
                      title="Remove uploaded image"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {coverUploadError && (
                  <p className="text-[11px] text-danger-600 mt-1">{coverUploadError}</p>
                )}
              </FormField>
            </div>

            <div className="sm:pt-5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2 hidden sm:block">
                Preview
              </p>
              <CoverPreview
                src={coverDisplaySrc}
                title={form.title}
                onClick={() => coverInputRef.current?.click()}
              />
              <p className="hidden sm:block text-[10px] text-gray-400 text-center mt-1.5">
                Click preview to upload
              </p>
            </div>
          </div>
        </Modal>
      )}

      {assignModal && (
        <Modal
          isOpen
          onClose={() => setAssignModal(false)}
          title="Assign to class"
          size="sm"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setAssignModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={saveAssignment}>
                <Users className="w-3.5 h-3.5 mr-1" /> Assign
              </Button>
            </>
          }
        >
          <p className="text-xs text-gray-500 mb-4">
            Link a catalog book to a class for <strong className="font-medium text-gray-700">{selectedTerm?.name} {selectedTerm?.year}</strong>.
          </p>
          <div className="space-y-3">
            <FormField label="Book" required>
              <div className="relative">
                <select
                  className={`${selectClass} w-full`}
                  value={assignForm.bookId}
                  onChange={(e) => setAssignForm({ ...assignForm, bookId: e.target.value })}
                >
                  <option value="">Select book</option>
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>{b.title} — GH₵{b.priceGhs}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </FormField>
            <FormField label="Class" required>
              <div className="relative">
                <select
                  className={`${selectClass} w-full`}
                  value={assignForm.classId}
                  onChange={(e) => setAssignForm({ ...assignForm, classId: e.target.value })}
                >
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  );
}
