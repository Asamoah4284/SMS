import ParentDetail from './ParentDetail';

export const metadata = { title: 'Parent Details — EduTrack SMS' };

export default async function ParentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ParentDetail parentId={id} />;
}
