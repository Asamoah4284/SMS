export const metadata = { title: 'Add Teacher — EduTrack SMS' };

import InviteTeacherForm from './InviteTeacherForm';

export default function AddTeacherPage() {
  return (
    <div className="p-6 max-w-[1600px] w-full mx-auto animate-in fade-in duration-500">
      <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">
        Invite Teacher
      </h2>
      <p className="text-sm text-gray-500 mt-1 font-medium">
        Invite a teacher. They will receive an SMS with a Staff ID and invitation code.
      </p>

      <div className="mt-6">
        <InviteTeacherForm />
      </div>
    </div>
  );
}

