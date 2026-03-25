'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Input, Card, CardBody, Alert } from '@/components/ui';
import { classLevelLabels } from '@/lib/theme';

export default function NewClassForm() {
  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const [section, setSection] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !level) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/classes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, level, section: section || null }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create class');
      }

      router.push('/classes');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create class');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert
              type="error"
              message={error}
              dismissible
              onDismiss={() => setError('')}
            />
          )}

          <Input
            label="Class Name"
            placeholder="e.g., Basic 1A"
            value={name}
            onChange={(e) => setName(e.target.value)}
            helperText="Display name for the class"
          />

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Academic Level <span className="text-danger-600">*</span>
            </label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            >
              <option value="">Select a level</option>
              {Object.entries(classLevelLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Section (Optional)"
            placeholder="e.g., A, B, C"
            value={section}
            onChange={(e) => setSection(e.target.value.toUpperCase())}
            helperText="Leave blank if single section"
          />

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              loading={loading}
              className="flex-1"
            >
              Create Class
            </Button>
            <Link href="/classes" className="flex-1">
              <Button
                type="button"
                variant="secondary"
                className="w-full"
              >
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
