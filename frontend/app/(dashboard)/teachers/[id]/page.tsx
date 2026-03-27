import TeacherDetail from './TeacherDetail';

export const metadata = { title: 'Teacher Details — EduTrack SMS' };

export default async function TeacherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TeacherDetail teacherId={id} />;
}
