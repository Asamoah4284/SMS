import PrintStudentReportCard from './PrintStudentReportCard';

interface Props {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ termId?: string }>;
}

export const metadata = { title: 'Report Card — DASE' };

export default async function StudentReportCardPage({ params, searchParams }: Props) {
  const { studentId } = await params;
  const { termId } = await searchParams;
  return <PrintStudentReportCard studentId={studentId} termId={termId ?? ''} />;
}
