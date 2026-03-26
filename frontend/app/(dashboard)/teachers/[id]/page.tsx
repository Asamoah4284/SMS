import TeacherDetail from './TeacherDetail';

export const metadata = { title: 'Teacher Details — EduTrack SMS' };

export default function TeacherDetailPage({ params }: { params: { id: string } }) {
  return <TeacherDetail teacherId={params.id} />;
}
