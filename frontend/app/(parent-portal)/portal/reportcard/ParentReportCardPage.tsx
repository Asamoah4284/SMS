'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ArrowLeft } from 'lucide-react';
import { ReportCardData, ReportCardPrintStyles, ReportCardView } from '@/components/reportcards/ReportCardView';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export default function ParentReportCardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const termId = searchParams.get('termId') ?? '';

  const [data, setData] = useState<ReportCardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = getCookie('parentToken');
    const raw = sessionStorage.getItem('portalStudent');

    if (!token || !raw) {
      router.replace('/parent-portal');
      return;
    }
    if (!termId) {
      setError('No term selected for this report card.');
      setLoading(false);
      return;
    }

    let schoolStudentId: string;
    try {
      schoolStudentId = JSON.parse(raw).studentId;
    } catch {
      router.replace('/parent-portal');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/portal/child/${schoolStudentId}/reportcard/${termId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      if (res.status === 401 || res.status === 403) {
        document.cookie = 'parentToken=; path=/; max-age=0';
        router.replace('/parent-portal');
        return;
      }
      if (!res.ok) throw new Error(json.error || json.message || 'Failed to load report card');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report card');
    } finally {
      setLoading(false);
    }
  }, [router, termId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-gray-500 gap-2">
        <Loader2 className="animate-spin" size={20} />
        <span>Loading report card…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
        <p className="font-semibold text-gray-900 mb-1">Could not load report card</p>
        <p className="text-sm text-gray-500 mb-4">{error}</p>
        <button
          type="button"
          onClick={() => router.push('/portal')}
          className="text-sm text-primary-600 hover:underline font-medium"
        >
          Back to portal
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="print:hidden flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push('/portal')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to portal
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
        >
          Download PDF
        </button>
      </div>

      <div className="print:hidden bg-slate-100 rounded-2xl p-4 sm:p-6">
        <ReportCardView data={data} pageBreakAfter={false} />
      </div>
      <div className="hidden print:block">
        <ReportCardView data={data} pageBreakAfter={false} />
      </div>
      <ReportCardPrintStyles />
    </div>
  );
}
