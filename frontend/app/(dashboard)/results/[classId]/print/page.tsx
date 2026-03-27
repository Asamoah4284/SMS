import PrintReportCards from './PrintReportCards';

interface Props {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ termId?: string }>;
}

export const metadata = { title: 'Print Report Cards — EduTrack SMS' };

export default async function PrintPage({ params, searchParams }: Props) {
  const { classId } = await params;
  const { termId } = await searchParams;
  return <PrintReportCards classId={classId} termId={termId ?? ''} />;
}
