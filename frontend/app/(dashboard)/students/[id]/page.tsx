import StudentDetail from './StudentDetail';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function StudentDetailPage({ params }: Props) {
  const { id } = await params;
  return <StudentDetail studentId={id} />;
}
