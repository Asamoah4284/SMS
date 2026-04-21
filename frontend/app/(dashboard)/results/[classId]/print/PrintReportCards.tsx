'use client';

import { useEffect, useState } from 'react';
import { schoolConfig } from '@/lib/theme';
import { Loader2 } from 'lucide-react';

interface SubjectResult {
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  totalScore: number | null;
  grade: string | null;
  position: number | null;
  remarks: string | null;
}

interface StudentCard {
  student: {
    id: string;
    studentId: string;
    name: string;
    gender: string;
    parentName: string | null;
    classSize: number;
  };
  results: SubjectResult[];
  average: number | null;
  aggregate: number | null;
  isPromoted: boolean;
  attendance: { PRESENT: number; ABSENT: number; LATE: number; EXCUSED: number };
  totalDays: number;
  teacherRemarks: string | null;
  headmasterRemarks: string | null;
  nextTermBegins: string | null;
}

interface BulkData {
  class: { id: string; name: string; level: string; classTeacher: string | null };
  term: { id: string; name: string; year: number } | null;
  isPublished: boolean;
  cards: StudentCard[];
}

const API = process.env.NEXT_PUBLIC_API_URL;

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
}

export default function PrintReportCards({ classId, termId }: { classId: string; termId: string }) {
  const [data, setData] = useState<BulkData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!termId) { Promise.resolve().then(() => setError('No term specified')); return; }
    const token = getToken();
    fetch(`${API}/results/reportcard/class/${classId}/term/${termId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.message) throw new Error(d.message);
        setData(d);
        // Auto-print once loaded
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
      {/* Screen header */}
      <div className="print:hidden p-4 bg-gray-100 flex items-center justify-between">
        <p className="font-medium text-gray-700">
          {data.cards.length} report cards — {data.class.name} · {data.term?.name} {data.term?.year}
        </p>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
        >
          Print / Save PDF
        </button>
      </div>

      {/* Report cards */}
      {data.cards.map((card) => (
        <ReportCard
          key={card.student.id}
          card={card}
          className={data.class.name}
          classTeacher={data.class.classTeacher ?? ''}
          term={data.term}
        />
      ))}

      <style>{`
        @media print {
          body { margin: 0; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </>
  );
}

function ReportCard({ card, className, classTeacher, term }: {
  card: StudentCard;
  className: string;
  classTeacher: string;
  term: { name: string; year: number } | null;
}) {
  const scores = card.results.map((r) => r.totalScore).filter((s) => s !== null) as number[];
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  return (
    <div style={{ pageBreakAfter: 'always', padding: '32px', maxWidth: '720px', margin: '0 auto', fontFamily: 'serif' }}>
      {/* School header */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #1a1a1a', paddingBottom: '12px', marginBottom: '12px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>{schoolConfig.name}</h1>
        {schoolConfig.motto && <p style={{ fontSize: '13px', fontStyle: 'italic', color: '#555', margin: '2px 0' }}>{schoolConfig.motto}</p>}
        {schoolConfig.address && <p style={{ fontSize: '11px', color: '#666', margin: '2px 0' }}>{schoolConfig.address}</p>}
        <h2 style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', margin: '8px 0 0' }}>
          End of Term Report Card
        </h2>
        <p style={{ fontSize: '13px', margin: '2px 0' }}>{term ? `${term.name} ${term.year}` : ''}</p>
      </div>

      {/* Student info grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 32px', fontSize: '13px', marginBottom: '12px' }}>
        <div><strong>Name:</strong> {card.student.name}</div>
        <div><strong>Student ID:</strong> {card.student.studentId}</div>
        <div><strong>Class:</strong> {className}</div>
        <div><strong>Class Teacher:</strong> {classTeacher}</div>
        <div><strong>Gender:</strong> {card.student.gender}</div>
        <div><strong>Class Size:</strong> {card.student.classSize}</div>
      </div>

      {/* Results table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '12px' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={thStyle}>Subject</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>Score (/100)</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>Grade</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>Position</th>
            <th style={{ ...thStyle, textAlign: 'left' }}>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {card.results.map((sub) => (
            <tr key={sub.subjectId}>
              <td style={tdStyle}>{sub.subjectName}</td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                {sub.totalScore !== null ? sub.totalScore.toFixed(1) : 'ABS'}
              </td>
              <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>{sub.grade ?? '—'}</td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>{sub.position ?? '—'}</td>
              <td style={tdStyle}>{sub.remarks ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: card.aggregate !== null ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <SummaryBox label="Average Score" value={avg !== null ? `${avg.toFixed(1)}%` : '—'} />
        {card.aggregate !== null && <SummaryBox label="Aggregate" value={String(card.aggregate)} />}
        <SummaryBox label="Days Present" value={`${card.attendance.PRESENT + card.attendance.LATE}/${card.totalDays}`} />
        <SummaryBox label="Promotion" value={card.isPromoted ? 'Promoted' : 'Repeat'} bold highlight={card.isPromoted} />
      </div>

      {/* GES key */}
      <p style={{ fontSize: '10px', color: '#666', marginBottom: '12px' }}>
        <strong>Grading:</strong> A1 (80–100) Excellent · B2 (70–79) Very Good · B3 (65–69) Good ·
        C4 (60–64) Credit · C5 (55–59) Credit · C6 (50–54) Credit ·
        D7 (45–49) Pass · E8 (40–44) Pass · F9 (&lt;40) Fail
      </p>

      {/* Remarks & signatures */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', fontSize: '12px', borderTop: '1px solid #ccc', paddingTop: '12px' }}>
        <div>
          <strong>Class Teacher&apos;s Remarks:</strong>
          <p style={{ fontStyle: 'italic', color: '#444', minHeight: '32px', margin: '4px 0 12px' }}>
            {card.teacherRemarks ?? ''}
          </p>
          <div style={{ borderTop: '1px solid #999', width: '120px', paddingTop: '2px', fontSize: '10px', color: '#888' }}>Signature</div>
        </div>
        <div>
          <strong>Headmaster&apos;s Remarks:</strong>
          <p style={{ fontStyle: 'italic', color: '#444', minHeight: '32px', margin: '4px 0 12px' }}>
            {card.headmasterRemarks ?? ''}
          </p>
          <div style={{ borderTop: '1px solid #999', width: '120px', paddingTop: '2px', fontSize: '10px', color: '#888' }}>Signature</div>
        </div>
      </div>

      {card.nextTermBegins && (
        <p style={{ fontSize: '12px', marginTop: '12px' }}>
          <strong>Next Term Begins:</strong>{' '}
          {new Date(card.nextTermBegins).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  border: '1px solid #ccc', padding: '6px 8px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase',
};
const tdStyle: React.CSSProperties = {
  border: '1px solid #ccc', padding: '5px 8px',
};

function SummaryBox({ label, value, bold, highlight }: {
  label: string; value: string; bold?: boolean; highlight?: boolean;
}) {
  return (
    <div style={{
      border: '1px solid #ddd', borderRadius: '6px', padding: '8px', textAlign: 'center',
      background: highlight ? '#f0fff4' : undefined,
    }}>
      <p style={{ fontSize: '10px', color: '#666', margin: '0 0 2px' }}>{label}</p>
      <p style={{ fontSize: '14px', fontWeight: bold ? 'bold' : undefined, margin: 0,
        color: highlight === true ? '#166534' : highlight === false ? '#991b1b' : undefined }}>
        {value}
      </p>
    </div>
  );
}
