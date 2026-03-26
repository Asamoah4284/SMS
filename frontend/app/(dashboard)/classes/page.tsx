import ClassList from './ClassList';

export const metadata = { title: 'Classes — EduTrack SMS' };

export default function ClassesPage() {
  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1600px] w-full mx-auto animate-fade-in">
      <div className="flex items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Classes</h2>
          <p className="text-sm text-gray-500 mt-1">Manage class groups and assigned teachers.</p>
        </div>
      </div>
      <ClassList />
    </div>
  );
}
