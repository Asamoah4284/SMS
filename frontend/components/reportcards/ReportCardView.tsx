'use client';

import Image from 'next/image';
import { schoolConfig } from '@/lib/theme';

export interface ReportCardSubject {
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  classScore: number | null;
  examScore: number | null;
  totalScore: number | null;
  grade: string | null;
  position: number | null;
  remarks: string | null;
}

export interface ReportCardData {
  student: {
    id: string;
    studentId: string;
    name: string;
    gender: string;
    className: string | null;
    classTeacher: string | null;
    parentName: string | null;
    classSize: number;
    photo?: string | null;
  };
  term: {
    id: string;
    name: string;
    year: number;
    academicYear?: string;
    vacationDate?: string | null;
    endDate?: string | null;
  };
  results: ReportCardSubject[];
  totals?: { classScore: number; examScore: number; totalScore: number };
  average: number | null;
  aggregate: number | null;
  isPromoted: boolean;
  attendance: { PRESENT: number; ABSENT: number; LATE: number; EXCUSED: number };
  daysPresent?: number;
  totalDays: number;
  teacherRemarks: string | null;
  headmasterRemarks: string | null;
  conduct?: string | null;
  interest?: string | null;
  nextTermBegins: string | null;
  nextTermBeginsLabel?: string | null;
}

function scoreCell(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(0);
}

function remarkText(row: ReportCardSubject) {
  if (row.remarks?.trim()) return row.remarks.trim().toUpperCase();
  const g = row.grade;
  if (!g) return '';
  if (g === 'A1') return 'EXCELLENT';
  if (g === 'B2' || g === 'B3') return 'VERY GOOD';
  if (['C4', 'C5', 'C6'].includes(g)) return 'CREDIT';
  if (['D7', 'E8'].includes(g)) return 'PASS';
  if (g === 'F9') return 'FAIL';
  return g;
}

function formatDateLabel(iso: string | null | undefined, fallback?: string | null) {
  if (fallback) return fallback;
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rc-info-row">
      <span className="rc-info-label">{label}</span>
      <span className="rc-info-value">{value}</span>
    </div>
  );
}

export function ReportCardView({
  data,
  className,
  classTeacher,
  pageBreakAfter = true,
}: {
  data: ReportCardData;
  className?: string;
  classTeacher?: string;
  pageBreakAfter?: boolean;
}) {
  const displayClass = className ?? data.student.className ?? '—';
  const displayTeacher = classTeacher ?? data.student.classTeacher ?? '—';
  const academicYear = data.term.academicYear ?? `${data.term.year}/${data.term.year + 1}`;
  const vacationDate = formatDateLabel(
    typeof data.term.endDate === 'string' ? data.term.endDate : null,
    data.term.vacationDate
  );
  const nextTerm = formatDateLabel(data.nextTermBegins, data.nextTermBeginsLabel);
  const daysPresent = data.daysPresent ?? data.attendance.PRESENT + data.attendance.LATE;

  const totals = data.totals ?? {
    classScore: data.results.reduce((s, r) => s + (r.classScore ?? 0), 0),
    examScore: data.results.reduce((s, r) => s + (r.examScore ?? 0), 0),
    totalScore: data.results.reduce((s, r) => s + (r.totalScore ?? 0), 0),
  };

  const contactLine = [
    schoolConfig.phone ? `Tel: ${schoolConfig.phone}` : null,
    schoolConfig.email ? schoolConfig.email : null,
  ]
    .filter(Boolean)
    .join(' | ');

  return (
    <article className={`rc-sheet ${pageBreakAfter ? 'rc-page-break' : ''}`}>
      {/* School header */}
      <header className="rc-header">
        <div className="rc-logo-wrap">
          <Image
            src={schoolConfig.logo}
            alt=""
            width={56}
            height={56}
            className="rc-logo"
            unoptimized
          />
        </div>
        <div className="rc-header-text">
          <h1 className="rc-school-name">{schoolConfig.name.toUpperCase()}</h1>
          <p className="rc-school-levels">[{schoolConfig.levels}]</p>
          {contactLine && <p className="rc-school-contact">{contactLine}</p>}
          {schoolConfig.address && <p className="rc-school-address">{schoolConfig.address}</p>}
        </div>
      </header>

      <div className="rc-divider" />

      {/* Student details */}
      <section className="rc-student-grid">
        <InfoRow label="Full Name:" value={data.student.name.toUpperCase()} />
        <InfoRow label="Academic Year:" value={academicYear} />
        <InfoRow label="No. On Roll:" value={String(data.student.classSize)} />
        <InfoRow label="Term:" value={data.term.name.toUpperCase()} />
        <InfoRow label="Class:" value={displayClass} />
        <InfoRow label="Vacation Date:" value={vacationDate} />
        <InfoRow label="Attendance:" value={`${daysPresent} / ${data.totalDays}`} />
        <InfoRow label="Next Term Begins:" value={nextTerm} />
      </section>

      {/* Scores table */}
      <h2 className="rc-section-title">TERM SCORES</h2>
      <table className="rc-table">
        <thead>
          <tr>
            <th className="rc-th-subject">SUBJECT</th>
            <th>
              CLASS
              <br />
              SCORE
              <br />
              <span className="rc-th-sub">(50%)</span>
            </th>
            <th>
              EXAM
              <br />
              SCORE
              <br />
              <span className="rc-th-sub">(50%)</span>
            </th>
            <th>
              TOTAL
              <br />
              SCORE
              <br />
              <span className="rc-th-sub">(100%)</span>
            </th>
            <th className="rc-th-remarks">REMARKS</th>
          </tr>
        </thead>
        <tbody>
          {data.results.length === 0 ? (
            <tr>
              <td colSpan={5} className="rc-empty">
                No subject results recorded for this term.
              </td>
            </tr>
          ) : (
            <>
              {data.results.map((row) => (
                <tr key={row.subjectId}>
                  <td className="rc-td-subject">{row.subjectName.toUpperCase()}</td>
                  <td className="rc-td-num">{scoreCell(row.classScore)}</td>
                  <td className="rc-td-num">{scoreCell(row.examScore)}</td>
                  <td className="rc-td-num rc-td-total">{scoreCell(row.totalScore)}</td>
                  <td className="rc-td-remarks">{remarkText(row)}</td>
                </tr>
              ))}
              <tr className="rc-totals-row">
                <td className="rc-td-subject">
                  <strong>Total Scores</strong>
                </td>
                <td className="rc-td-num">
                  <strong>{scoreCell(totals.classScore)}</strong>
                </td>
                <td className="rc-td-num">
                  <strong>{scoreCell(totals.examScore)}</strong>
                </td>
                <td className="rc-td-num">
                  <strong>{scoreCell(totals.totalScore)}</strong>
                </td>
                <td />
              </tr>
            </>
          )}
        </tbody>
      </table>

      {/* Comments */}
      <h2 className="rc-section-title rc-section-title-spaced">COMMENTS AND REMARKS</h2>
      <div className="rc-comments">
        <div className="rc-comment-block">
          <p className="rc-comment-label">CONDUCT :</p>
          <p className="rc-comment-value">{data.conduct?.toUpperCase() || '—'}</p>
        </div>
        <div className="rc-comment-block">
          <p className="rc-comment-label">INTEREST :</p>
          <p className="rc-comment-value">{data.interest?.toUpperCase() || '—'}</p>
        </div>
        <div className="rc-comment-block rc-comment-wide">
          <p className="rc-comment-label">TEACHER&apos;S REMARKS :</p>
          <p className="rc-comment-value">{data.teacherRemarks || '—'}</p>
          <div className="rc-signature">
            <span>Class Teacher: {displayTeacher}</span>
            <span className="rc-signature-line">Signature</span>
          </div>
        </div>
        <div className="rc-comment-block rc-comment-wide">
          <p className="rc-comment-label">HEADTEACHER&apos;S REMARKS :</p>
          <p className="rc-comment-value">{data.headmasterRemarks || '—'}</p>
          <div className="rc-signature">
            <span>Head Teacher</span>
            <span className="rc-signature-line">Signature</span>
          </div>
        </div>
      </div>

      {data.aggregate != null && (
        <p className="rc-footer-note">
          <strong>BECE Aggregate:</strong> {data.aggregate} ·{' '}
          <strong>Promotion:</strong> {data.isPromoted ? 'Promoted' : 'Repeat'}
        </p>
      )}
    </article>
  );
}

export function ReportCardPrintStyles() {
  return (
    <style>{`
      .rc-sheet {
        max-width: 820px;
        margin: 0 auto;
        padding: 28px 32px 36px;
        background: #fff;
        color: #0f172a;
        font-family: "Times New Roman", Georgia, serif;
        border: 2px solid #1e3a5f;
        box-shadow: 0 4px 24px rgba(15, 23, 42, 0.06);
      }
      .rc-page-break { page-break-after: always; }
      .rc-header {
        display: flex;
        align-items: center;
        gap: 16px;
        text-align: center;
      }
      .rc-logo-wrap { flex-shrink: 0; }
      .rc-logo { object-fit: contain; }
      .rc-header-text { flex: 1; }
      .rc-school-name {
        font-size: 1.15rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        color: #1e3a5f;
        margin: 0;
        line-height: 1.25;
      }
      .rc-school-levels {
        font-size: 0.72rem;
        color: #475569;
        margin: 4px 0 0;
        font-style: italic;
      }
      .rc-school-contact, .rc-school-address {
        font-size: 0.72rem;
        color: #64748b;
        margin: 2px 0 0;
      }
      .rc-divider {
        height: 2px;
        background: linear-gradient(90deg, #1e3a5f, #c9a020, #1e3a5f);
        margin: 14px 0 16px;
      }
      .rc-student-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px 28px;
        font-size: 0.82rem;
        margin-bottom: 18px;
        padding: 12px 14px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
      }
      .rc-info-row { display: flex; gap: 6px; align-items: baseline; }
      .rc-info-label { font-weight: 700; color: #1e3a5f; white-space: nowrap; }
      .rc-info-value { font-weight: 600; color: #0f172a; }
      .rc-section-title {
        text-align: center;
        font-size: 0.9rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        color: #1e3a5f;
        margin: 0 0 8px;
        text-decoration: underline;
        text-underline-offset: 4px;
      }
      .rc-section-title-spaced { margin-top: 20px; }
      .rc-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.78rem;
        margin-bottom: 8px;
      }
      .rc-table th, .rc-table td {
        border: 1px solid #94a3b8;
        padding: 7px 6px;
        text-align: center;
        vertical-align: middle;
      }
      .rc-th-subject, .rc-td-subject { text-align: left !important; padding-left: 10px !important; }
      .rc-th-remarks, .rc-td-remarks { text-align: left !important; padding-left: 8px !important; font-size: 0.72rem; }
      .rc-table thead th {
        background: #1e3a5f;
        color: #fff;
        font-weight: 700;
        line-height: 1.2;
      }
      .rc-th-sub { font-size: 0.62rem; font-weight: 500; opacity: 0.9; }
      .rc-td-num { font-weight: 600; }
      .rc-td-total { font-weight: 800; color: #1e3a5f; }
      .rc-totals-row td { background: #f1f5f9; }
      .rc-empty { padding: 16px !important; color: #64748b; font-style: italic; }
      .rc-comments {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px 20px;
        margin-top: 8px;
      }
      .rc-comment-wide { grid-column: 1 / -1; }
      .rc-comment-label {
        font-size: 0.75rem;
        font-weight: 800;
        color: #1e3a5f;
        margin: 0 0 4px;
        letter-spacing: 0.04em;
      }
      .rc-comment-value {
        font-size: 0.82rem;
        color: #334155;
        margin: 0 0 10px;
        min-height: 1.4em;
        line-height: 1.45;
      }
      .rc-signature {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        font-size: 0.7rem;
        color: #64748b;
        margin-top: 8px;
      }
      .rc-signature-line {
        border-top: 1px solid #94a3b8;
        min-width: 120px;
        text-align: center;
        padding-top: 2px;
      }
      .rc-footer-note {
        margin-top: 16px;
        font-size: 0.75rem;
        color: #475569;
        text-align: center;
        border-top: 1px dashed #cbd5e1;
        padding-top: 10px;
      }
      @media print {
        body { margin: 0; background: #fff; }
        .print\\:hidden { display: none !important; }
        .rc-sheet {
          box-shadow: none;
          border: 1px solid #000;
          max-width: none;
          padding: 20px 24px;
        }
      }
    `}</style>
  );
}
