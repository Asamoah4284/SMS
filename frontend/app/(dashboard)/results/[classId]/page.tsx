import ClassResultsDetail from './ClassResultsDetail';

interface Props {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ termId?: string }>;
}

export const metadata = { title: 'Class Results — EduTrack SMS' };

export default async function ClassResultsPage({ params, searchParams }: Props) {
  const { classId } = await params;
  const { termId } = await searchParams;
  return <ClassResultsDetail classId={classId} initialTermId={termId ?? ''} />;
}
