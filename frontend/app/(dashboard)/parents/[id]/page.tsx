import ParentDetail from './ParentDetail';

export const metadata = { title: 'Parent Details — EduTrack SMS' };

export default function ParentDetailPage({ params }: { params: { id: string } }) {
  return <ParentDetail parentId={params.id} />;
}
