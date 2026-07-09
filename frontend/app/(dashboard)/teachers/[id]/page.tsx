import TeacherDetail from './TeacherDetail';

export const metadata = { title: 'Teacher Details — DEACONS SMS' };

export default async function TeacherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TeacherDetail teacherId={id} />;
}
