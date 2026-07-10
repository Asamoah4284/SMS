'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert, Button, Modal, PageHeader } from '@/components/ui';
import { useUser } from '@/lib/UserContext';
import { getApiBase, parseApiError } from '@/lib/apiBase';
import { Calendar, Plus, Edit2, Trash2, Loader2, Save, User, Sliders, Settings, Lock, Moon, Bell } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Term {
  id: string; name: string; year: number;
  startDate: string; endDate: string; isCurrent: boolean;
}

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : ''; }
const API = getApiBase();

const PREF_KEYS = {
  theme: 'edutrack_theme',
  inApp: 'edutrack_notify_inapp',
  email: 'edutrack_notify_email',
} as const;

// ─── Main ─────────────────────────────────────────────────────────────────────

function SettingsClientPageInner() {
  const searchParams = useSearchParams();
  const { isAdmin } = useUser();
  const tabParam = searchParams.get('tab');
  const initialTab =
    tabParam === 'preferences' || (tabParam === 'school' && isAdmin)
      ? tabParam
      : 'account';

  const [activeTab, setActiveTab] = useState<'account' | 'preferences' | 'school'>(initialTab);
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [termModal, setTermModal] = useState<Term | null | 'new'>(null);

  const fetchTerms = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API}/terms`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || 'Failed to load terms');
      }
      setTerms(data.terms ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load terms');
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (tabParam === 'account' || tabParam === 'preferences') {
      setActiveTab(tabParam);
    } else if (tabParam === 'school' && isAdmin) {
      setActiveTab('school');
    } else if (tabParam === 'school' && !isAdmin) {
      setActiveTab('account');
    }
  }, [tabParam, isAdmin]);

  useEffect(() => {
    if (!isAdmin && activeTab === 'school') {
      setActiveTab('account');
    }
  }, [isAdmin, activeTab]);

  useEffect(() => {
    if (activeTab === 'school') {
      fetchTerms();
    }
  }, [fetchTerms, activeTab]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete term "${name}"? This cannot be undone.`)) return;
    const token = getToken();
    const res = await fetch(`${API}/terms/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) { alert(data.message); return; }
    fetchTerms();
  };

  const handleSetCurrent = async (id: string) => {
    const token = getToken();
    const res = await fetch(`${API}/terms/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isCurrent: true }),
    });
    if (!res.ok) { alert('Failed to set current term'); return; }
    fetchTerms();
  };

  const tabs = [
    { id: 'account' as const, label: 'Account Settings', icon: User },
    { id: 'preferences' as const, label: 'App Preferences', icon: Sliders },
    ...(isAdmin
      ? [{ id: 'school' as const, label: 'School Config', icon: Settings, adminOnly: true as const }]
      : []),
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8 animate-fade-in space-y-6">
      <PageHeader
        title="Settings"
        subtitle={
          isAdmin
            ? 'Manage your account, preferences, and school configuration'
            : 'Manage your account and app preferences'
        }
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl transition-colors ${
              activeTab === tab.id
                ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {/* Account Settings Tab */}
        {activeTab === 'account' && <AccountSettingsTab />}

        {/* App Preferences Tab */}
        {activeTab === 'preferences' && <PreferencesTab />}

        {/* School Config Tab (admin only) */}
        {activeTab === 'school' && isAdmin && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <h2 className="font-semibold text-gray-900">Academic Terms</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Create and manage school terms. Only one term can be active at a time.</p>
                </div>
                <Button variant="primary" size="sm" onClick={() => setTermModal('new')}>
                  <Plus size={14} className="mr-1" />New Term
                </Button>
              </div>

              {error && <div className="p-4"><Alert type="error" message={error} /></div>}

              {loading ? (
                <div className="p-6 space-y-3">
                  {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
                </div>
              ) : terms.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Calendar size={36} className="mx-auto mb-2 opacity-40" />
                  <p className="font-medium">No terms created yet</p>
                  <p className="text-sm mt-1">Create your first academic term to get started.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {terms.map((t) => (
                    <div key={t.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        t.isCurrent ? 'bg-success-100' : 'bg-gray-100'
                      }`}>
                        <Calendar size={16} className={t.isCurrent ? 'text-success-600' : 'text-gray-400'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">{t.name} {t.year}</p>
                          {t.isCurrent && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-success-100 text-success-700">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {new Date(t.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' — '}
                          {new Date(t.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!t.isCurrent && (
                          <button
                            onClick={() => handleSetCurrent(t.id)}
                            className="text-xs text-primary-600 hover:text-primary-700 font-medium px-2 py-1 rounded-lg hover:bg-primary-50 transition-colors"
                          >
                            Set Current
                          </button>
                        )}
                        <button onClick={() => setTermModal(t)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => handleDelete(t.id, `${t.name} ${t.year}`)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-danger-600 hover:bg-danger-50 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {termModal !== null && (
              <TermModal
                term={termModal === 'new' ? null : termModal}
                onClose={() => setTermModal(null)}
                onSaved={() => { setTermModal(null); fetchTerms(); }}
              />
            )}
            </div>
        )}
      </div>
    </div>
  );
}

export default function SettingsClientPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Loading settings…</div>}>
      <SettingsClientPageInner />
    </Suspense>
  );
}

function AccountSettingsTab() {
  const { user, refresh, isTeacher } = useUser();
  const staffId = user?.teacherProfile?.staffId;
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName ?? '');
    setLastName(user.lastName ?? '');
    setEmail(user.email ?? '');
  }, [user]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileMessage('');
    setProfileSaving(true);
    try {
      const token = getToken();
      const res = await fetch(`${API}/auth/me`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ firstName, lastName, email: email || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(parseApiError(data, 'Failed to update profile'));
      setProfileMessage('Profile saved successfully');
      await refresh();
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordMessage('');
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPasswordError('Password must include uppercase, lowercase, and a number');
      return;
    }
    setPasswordSaving(true);
    try {
      const token = getToken();
      const res = await fetch(`${API}/auth/change-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(parseApiError(data, 'Failed to update password'));
      setPasswordMessage('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      localStorage.removeItem('mustChangePassword');
      await refresh();
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl animate-fade-in">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
          <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
            <User size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Profile</h3>
            <p className="text-sm text-gray-500">Update your name and contact details</p>
          </div>
        </div>
        <form onSubmit={handleProfileSubmit} className="space-y-3 pt-2">
          {profileError && <Alert type="error" message={profileError} onDismiss={() => setProfileError('')} />}
          {profileMessage && <Alert type="success" message={profileMessage} onDismiss={() => setProfileMessage('')} />}
          {isTeacher && staffId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Staff ID</label>
              <input
                type="text"
                value={staffId}
                disabled
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm bg-gray-50 text-gray-700 font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">Use this with your password to sign in.</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="text"
              value={user?.phone ?? ''}
              disabled
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm bg-gray-50 text-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1">Phone is your login ID and cannot be changed here.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email (optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu.gh"
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="primary" size="sm" type="submit" loading={profileSaving}>Save changes</Button>
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
          <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
            <Lock size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Change Password</h3>
            <p className="text-sm text-gray-500">Update your account password anytime</p>
          </div>
        </div>
        <form onSubmit={handlePasswordSubmit} className="space-y-3 pt-2">
          {passwordError && <Alert type="error" message={passwordError} onDismiss={() => setPasswordError('')} />}
          {passwordMessage && <Alert type="success" message={passwordMessage} onDismiss={() => setPasswordMessage('')} />}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
            <p className="text-xs text-gray-500 mt-1">8+ characters with uppercase, lowercase, and a number</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="primary" size="sm" type="submit" loading={passwordSaving}>Update password</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PreferencesTab() {
  const [theme, setTheme] = useState('system');
  const [inApp, setInApp] = useState(true);
  const [emailNotify, setEmailNotify] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setTheme(localStorage.getItem(PREF_KEYS.theme) || 'system');
    setInApp(localStorage.getItem(PREF_KEYS.inApp) !== 'false');
    setEmailNotify(localStorage.getItem(PREF_KEYS.email) === 'true');
  }, []);

  const applyTheme = (value: string) => {
    const root = document.documentElement;
    if (value === 'dark') root.classList.add('dark');
    else if (value === 'light') root.classList.remove('dark');
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches) root.classList.add('dark');
    else root.classList.remove('dark');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    localStorage.setItem(PREF_KEYS.theme, theme);
    localStorage.setItem(PREF_KEYS.inApp, String(inApp));
    localStorage.setItem(PREF_KEYS.email, String(emailNotify));
    applyTheme(theme);
    setMessage('Preferences saved');
    setSaving(false);
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl animate-fade-in">
      {message && <Alert type="success" message={message} onDismiss={() => setMessage('')} />}

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
          <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
            <Moon size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Appearance</h3>
            <p className="text-sm text-gray-500">Customize the look and feel of the app</p>
          </div>
        </div>
        <div className="pt-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Theme preference</label>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="w-full max-w-xs border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
          >
            <option value="system">System default</option>
            <option value="light">Light mode</option>
            <option value="dark">Dark mode</option>
          </select>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
          <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
            <Bell size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            <p className="text-sm text-gray-500">Choose how you want to be notified</p>
          </div>
        </div>
        <div className="space-y-4 pt-2">
          <label className="flex items-center justify-between cursor-pointer group">
            <div>
              <p className="font-medium text-gray-900">In-app notifications</p>
              <p className="text-sm text-gray-500">Bell alerts for announcements, leave requests, and updates</p>
            </div>
            <input
              type="checkbox"
              checked={inApp}
              onChange={(e) => setInApp(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
          </label>
          <div className="h-px bg-gray-50" />
          <label className="flex items-center justify-between cursor-pointer group">
            <div>
              <p className="font-medium text-gray-900">Email notifications</p>
              <p className="text-sm text-gray-500">Weekly summaries and important updates (coming soon)</p>
            </div>
            <input
              type="checkbox"
              checked={emailNotify}
              onChange={(e) => setEmailNotify(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="primary" size="sm" type="submit" loading={saving}>
          <Save size={14} className="mr-1" />
          Save changes
        </Button>
      </div>
    </form>
  );
}

// ─── Term Modal ───────────────────────────────────────────────────────────────

function TermModal({ term, onClose, onSaved }: {
  term: Term | null; onClose: () => void; onSaved: () => void;
}) {
  const currentYear = new Date().getFullYear();
  const [form, setForm] = useState({
    name: term?.name ?? 'First Term',
    year: term?.year?.toString() ?? String(currentYear),
    startDate: term?.startDate ? term.startDate.split('T')[0] : '',
    endDate: term?.endDate ? term.endDate.split('T')[0] : '',
    isCurrent: term?.isCurrent ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    const token = getToken();
    const method = term ? 'PUT' : 'POST';
    const url = term ? `${API}/terms/${term.id}` : `${API}/terms`;
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.message); return; }
    onSaved();
  };

  return (
    <Modal isOpen={true} title={term ? 'Edit Term' : 'New Academic Term'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert type="error" message={error} />}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Term Name *</label>
            <select required
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            >
              <option>First Term</option>
              <option>Second Term</option>
              <option>Third Term</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year *</label>
            <input type="number" min="2020" max="2050" required
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
            <input type="date" required
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
            <input type="date" required
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox"
            checked={form.isCurrent}
            onChange={(e) => setForm({ ...form, isCurrent: e.target.checked })}
            className="w-4 h-4 rounded accent-primary-600"
          />
          <span className="text-sm text-gray-700">Set as current active term</span>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
            {term ? 'Save Changes' : 'Create Term'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
