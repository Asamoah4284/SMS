import StudentDetail from "./StudentDetail";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "Student",
};

export default async function StudentDetailPage({ params }: Props) {
  const { id } = await params;
  return <StudentDetail studentId={id} />;
}
