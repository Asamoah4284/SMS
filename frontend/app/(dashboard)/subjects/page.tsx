import { Suspense } from 'react';
import SubjectsClientPage from './SubjectsClientPage';

export const metadata = { title: 'Class subjects — EduTrack SMS' };

export default function SubjectsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading…</div>}>
      <SubjectsClientPage />
    </Suspense>
  );
}