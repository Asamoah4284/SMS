'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ReportCardData, ReportCardPrintStyles, ReportCardView } from '@/components/reportcards/ReportCardView';

interface BulkData {
  class: { id: string; name: string; level: string; classTeacher: string | null };
  term: { id: string; name: string; year: number } | null;
  isPublished: boolean;
  cards: ReportCardData[];
}

const API = process.env.NEXT_PUBLIC_API_URL;

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
}

export default function PrintReportCards({ classId, termId }: { classId: string; termId: string }) {
  const [data, setData] = useState<BulkData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!termId) {
      Promise.resolve().then(() => setError('No term specified'));
      return;
    }
    const token = getToken();
    fetch(`${API}/results/reportcard/class/${classId}/term/${termId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.message) throw new Error(d.message);
        setData(d);
        setTimeout(() => window.print(), 500);
      })
      .catch((err) => setError(err.message));
  }, [classId, termId]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-600">
        <p>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500 gap-2">
        <Loader2 className="animate-spin" size={20} />
        <span>Loading report cards...</span>
      </div>
    );
  }

  return (
  <>
      <div className="print:hidden p-4 bg-slate-100 min-h-screen">
        <div className="max-w-[900px] mx-auto flex items-center justify-between gap-3 mb-4">
          <p className="font-medium text-gray-700">
            {data.cards.length} report cards — {data.class.name} · {data.term?.name} {data.term?.year}
          </p>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
          >
            Print / Save PDF
          </button>
        </div>
        <div className="max-w-[900px] mx-auto flex flex-col gap-8">
          {data.cards.map((card, index) => (
            <ReportCardView
              key={card.student.id}
              data={card}
              className={data.class.name}
              classTeacher={data.class.classTeacher ?? card.student.classTeacher ?? ''}
              pageBreakAfter={index < data.cards.length - 1}
            />
          ))}
        </div>
      </div>

      <div className="hidden print:block">
        {data.cards.map((card, index) => (
          <ReportCardView
            key={card.student.id}
            data={card}
            className={data.class.name}
            classTeacher={data.class.classTeacher ?? card.student.classTeacher ?? ''}
            pageBreakAfter={index < data.cards.length - 1}
          />
        ))}
      </div>

      <ReportCardPrintStyles />
    </>
  );
}
