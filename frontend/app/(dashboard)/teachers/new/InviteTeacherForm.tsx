'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Input } from '@/components/ui';
import { CheckCircle2 } from 'lucide-react';

type ClassOption = { id: string; name: string; hasTeacher: boolean };

type InviteResult = {
  staffId: string;
  maskedPhone: string;
  name: string;
};

export default function InviteTeacherForm() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  const [isClassTeacher, setIsClassTeacher] = useState(false);
  const [classId, setClassId] = useState('');
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<InviteResult | null>(null);

  useEffect(() => {
    if (!isClassTeacher || classes.length > 0) return;
    setLoadingClasses(true);
    const token = localStorage.getItem('accessToken');
    fetch(`${apiBaseUrl}/classes?limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setClasses(
          (d.classes ?? []).map((c: { id: string; name: string; classTeacher: unknown }) => ({
            id: c.id,
            name: c.name,
            hasTeacher: Boolean(c.classTeacher),
          }))
        );
      })
      .catch(() => {})
      .finally(() => setLoadingClasses(false));
  }, [apiBaseUrl, isClassTeacher, classes.length]);

  const availableClasses = useMemo(
    () => classes.filter((c) => !c.hasTeacher),
    [classes]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setError('All fields are required.');
      return;
    }
    if (isClassTeacher && !classId) {
      setError('Please select a class for this class teacher.');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const body: Record<string, string> = { firstName, lastName, phone };
      if (isClassTeacher && classId) body.classId = classId;

      const res = await fetch(`${apiBaseUrl}/auth/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send invitation');

      setResult({
        staffId: data.staffId,
        maskedPhone: data.phone,
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setResult(null);
    setError('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setIsClassTeacher(false);
    setClassId('');
  };

  if (result) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm shadow-gray-200/50 max-w-2xl">
        <div className="flex flex-col items-center text-center gap-3 py-2">
          <div className="w-14 h-14 rounded-full bg-success-100 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-success-600" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-lg">{result.name}</p>
            <p className="text-sm text-gray-500">has been invited successfully</p>
          </div>
        </div>

        <div className="mt-5 bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 font-medium">Staff ID</span>
            <span className="font-mono font-bold text-gray-900 text-base">{result.staffId}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 font-medium">SMS sent to</span>
            <span className="font-semibold text-gray-700">{result.maskedPhone}</span>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <Button variant="secondary" onClick={resetForm} className="flex-1">
            Invite Another
          </Button>
          <Button onClick={() => window.history.back()} className="flex-1">
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm shadow-gray-200/50 max-w-2xl">
      {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="First Name"
          placeholder="Kwame"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <Input
          label="Last Name"
          placeholder="Asante"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
      </div>

      <div className="mt-4">
        <Input
          label="Phone Number"
          placeholder="024XXXXXXX"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          helperText="An SMS with Staff ID and invitation code will be sent here."
        />
      </div>

      <div className="mt-4 border border-gray-200 rounded-xl p-4 space-y-3">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-sm font-semibold text-gray-900">Class Teacher</p>
            <p className="text-xs text-gray-500 mt-0.5">Assign this teacher to a class now</p>
          </div>
          <div
            onClick={() => {
              setIsClassTeacher(!isClassTeacher);
              setClassId('');
            }}
            className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
              isClassTeacher ? 'bg-primary-600' : 'bg-gray-200'
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                isClassTeacher ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </div>
        </label>

        {isClassTeacher && (
          <div>
            {loadingClasses ? (
              <p className="text-sm text-gray-400">Loading classes...</p>
            ) : availableClasses.length === 0 ? (
              <p className="text-sm text-warning-700 bg-warning-50 rounded-lg px-3 py-2">
                All classes already have teachers assigned
              </p>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Select Class
                </label>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                >
                  <option value="">Choose a class...</option>
                  {availableClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {!isClassTeacher && (
          <p className="text-xs text-gray-400">
            Subject assignments can be added from the teacher&apos;s profile after they join
          </p>
        )}
      </div>

      <div className="mt-5 flex gap-3">
        <Button type="button" variant="secondary" onClick={() => window.history.back()} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" loading={loading} className="flex-1">
          Send Invitation
        </Button>
      </div>
    </form>
  );
}

