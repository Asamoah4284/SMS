import ClassFeesDetail from './ClassFeesDetail';

interface Props {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ termId?: string }>;
}

export const metadata = { title: 'Class Fees — EduTrack SMS' };

export default async function ClassFeesPage({ params, searchParams }: Props) {
  const { classId } = await params;
  const { termId } = await searchParams;
  return <ClassFeesDetail classId={classId} initialTermId={termId ?? ''} />;
}
