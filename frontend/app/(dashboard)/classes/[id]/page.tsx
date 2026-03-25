import ClassDetail from './ClassDetail';

export const metadata = { title: 'Class Details — EduTrack SMS' };

export default function ClassDetailPage({ params }: { params: { id: string } }) {
  return <ClassDetail classId={params.id} />;
}
