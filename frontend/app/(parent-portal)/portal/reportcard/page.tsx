import { Suspense } from 'react';
import ParentReportCardPage from './ParentReportCardPage';

export const metadata = { title: 'Report Card — Parent Portal' };

export default function ReportCardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh] text-gray-500">
          Loading report card…
        </div>
      }
    >
      <ParentReportCardPage />
    </Suspense>
  );
}
