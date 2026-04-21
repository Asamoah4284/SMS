'use client';

import { useState, useEffect, useCallback } from 'react';
import { Alert, Button, Modal, PageHeader, AdminOnly } from '@/components/ui';
import { Calendar, Plus, Edit2, Trash2, CheckCircle2, Loader2, Save, User, Sliders, Settings, Lock, Mail, Phone, Moon, Bell } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Term {
  id: string; name: string; year: number;
  startDate: string; endDate: string; isCurrent: boolean;
}

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : ''; }
const API = process.env.NEXT_PUBLIC_API_URL;

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SettingsClientPage() {
  const [activeTab, setActiveTab] = useState<'account' | 'preferences' | 'school'>('account');
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
    { id: 'account', label: 'Account Settings', icon: User },
    { id: 'preferences', label: 'App Preferences', icon: Sliders },
    { id: 'school', label: 'School Config', icon: Settings, adminOnly: true },
  ] as const;

  return (
    <div className="p-4 sm:p-6 md:p-8 animate-fade-in space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Manage your account, preferences, and school configuration"
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-px">
        {tabs.map(tab => {
          if ('adminOnly' in tab && tab.adminOnly) {
            return (
              <AdminOnly key={tab.id}>
                <button
                  onClick={() => setActiveTab(tab.id as 'account' | 'preferences' | 'school')}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-600'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <tab.icon size={16} />
                  {tab.label}
                </button>
              </AdminOnly>
            );
          }
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'account' | 'preferences' | 'school')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {/* Account Settings Tab */}
        {activeTab === 'account' && (
          <div className="space-y-6 max-w-2xl animate-fade-in">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
                  <Lock size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Change Password</h3>
                  <p className="text-sm text-gray-500">Update your account password</p>
                </div>
              </div>
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                  <input type="password" placeholder="••••••••" className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <input type="password" placeholder="••••••••" className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                </div>
                <div className="flex justify-end pt-2">
                  <Button variant="primary" size="sm">Update Password</Button>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
                  <Mail size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Contact Details</h3>
                  <p className="text-sm text-gray-500">Update your email and phone number</p>
                </div>
              </div>
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input type="email" placeholder="email@example.com" className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input type="tel" placeholder="+1 234 567 890" className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button variant="primary" size="sm">Save Details</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* App Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="space-y-6 max-w-2xl animate-fade-in">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Theme Preference</label>
                <select className="w-full max-w-xs border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer">
                  <option value="system">System Default</option>
                  <option value="light">Light Mode</option>
                  <option value="dark">Dark Mode</option>
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
                    <p className="font-medium text-gray-900 group-hover:text-primary-600 transition-colors">In-App Notifications</p>
                    <p className="text-sm text-gray-500">Receive alerts within the application dashboard</p>
                  </div>
                  <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                </label>
                <div className="h-px bg-gray-50"></div>
                <label className="flex items-center justify-between cursor-pointer group">
                  <div>
                    <p className="font-medium text-gray-900 group-hover:text-primary-600 transition-colors">Email Notifications</p>
                    <p className="text-sm text-gray-500">Receive important updates and weekly reports via email</p>
                  </div>
                  <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* School Config Tab */}
        {activeTab === 'school' && (
          <AdminOnly>
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
          </AdminOnly>
        )}
      </div>
    </div>
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
