import ClassDetail from './ClassDetail';

export const metadata = { title: 'Class Details — DEACONS SMS' };

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClassDetail classId={id} />;
}
