import NewClassForm from './NewClassForm';

export const metadata = { title: 'Create Class — EduTrack SMS' };

export default function NewClassPage() {
  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 md:p-0">
      <h2 className="text-2xl font-bold mb-4 sm:mb-6">Create New Class</h2>
      <NewClassForm />
    </div>
  );
}
