"use client";

import React, { useEffect, useState } from 'react';
import { useUser } from '@/lib/UserContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

interface Template {
  id: string;
  name: string;
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
}

export default function CertificatesPage() {
  const { user } = useUser();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, [user]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      
      const templatesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'}/certificates/templates`, { headers });
      const studentsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'}/students`, { headers });
      
      const tempJson = templatesRes.ok ? await templatesRes.json() : { data: [] };
      const studJson = studentsRes.ok ? await studentsRes.json() : { data: [] };
      
      setTemplates(tempJson.data || []);
      setStudents(studJson.data || []);
    } catch (err: unknown) {
      setError('Failed to load certificates data. ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setError('');
    setSuccessMsg('');
    if (!selectedTemplateId || !selectedStudentId) {
      setError('Please select both a student and a template.');
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'}/certificates/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          studentId: selectedStudentId,
          templateId: selectedTemplateId
        })
      });
      if (!res.ok) throw new Error('Failed to generate certificate');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'certificate.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      setSuccessMsg('Certificate generated successfully!');
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Certificates" />
      
      {error && <Alert type="error" message={error} />}
      {successMsg && <Alert type="success" message={successMsg} />}

      {loading ? (
        <p>Loading data...</p>
      ) : (
        <div className="max-w-2xl bg-white p-6 rounded shadow border space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Select Student</label>
            <select 
              className="w-full border rounded p-2"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
            >
              <option value="">-- Choose a Student --</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Select Certificate Template</label>
            <select 
              className="w-full border rounded p-2"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
            >
              <option value="">-- Choose a Template --</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="pt-4">
            <Button onClick={handleGenerate} className="w-full">
              Generate Certificate (PDF)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
