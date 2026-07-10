'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ReportCardData, ReportCardPrintStyles, ReportCardView } from '@/components/reportcards/ReportCardView';

const API = process.env.NEXT_PUBLIC_API_URL;

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
}

export default function PrintStudentReportCard({
  studentId,
  termId,
  autoPrint = true,
}: {
  studentId: string;
  termId: string;
  autoPrint?: boolean;
}) {
  const [data, setData] = useState<ReportCardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!termId) {
      Promise.resolve().then(() => setError('No term specified'));
      return;
    }
    const token = getToken();
    fetch(`${API}/results/reportcard/${studentId}/${termId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.message) throw new Error(d.message);
        setData(d);
        if (autoPrint) setTimeout(() => window.print(), 500);
      })
      .catch((err) => setError(err.message));
  }, [studentId, termId, autoPrint]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-600 px-4 text-center">
        <p>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500 gap-2">
        <Loader2 className="animate-spin" size={20} />
        <span>Loading report card…</span>
      </div>
    );
  }

  return (
    <>
      <div className="print:hidden p-4 bg-slate-100 min-h-screen">
        <div className="max-w-[900px] mx-auto flex items-center justify-between gap-3 mb-4">
          <p className="font-medium text-gray-700">
            Report card — {data.student.name} · {data.term.name} {data.term.year}
          </p>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 shrink-0"
          >
            Print / Save PDF
          </button>
        </div>
        <div className="max-w-[900px] mx-auto">
          <ReportCardView data={data} pageBreakAfter={false} />
        </div>
      </div>

      <div className="hidden print:block">
        <ReportCardView data={data} pageBreakAfter={false} />
      </div>
      <ReportCardPrintStyles />
    </>
  );
}
