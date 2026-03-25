import NewClassForm from './NewClassForm';

export const metadata = { title: 'Create Class — EduTrack SMS' };

export default function NewClassPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Create New Class</h2>
      <NewClassForm />
    </div>
  );
}
