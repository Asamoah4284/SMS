import { Suspense } from 'react';
import TimetableClientPage from './TimetableClientPage';

export const metadata = { title: 'Timetable — EduTrack SMS' };

function TimetableFallback() {
  return (
    <div className="animate-fade-in space-y-6 p-4 md:p-6">
      <div className="h-10 w-48 max-w-full bg-gray-200 rounded-xl animate-pulse" />
      <div className="h-72 bg-gray-100 rounded-2xl animate-pulse" />
    </div>
  );
}

export default function TimetablePage() {
  return (
    <Suspense fallback={<TimetableFallback />}>
      <TimetableClientPage />
    </Suspense>
  );
}
