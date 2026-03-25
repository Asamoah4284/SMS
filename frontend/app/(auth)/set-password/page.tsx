import SetPasswordForm from './SetPasswordForm';

export const metadata = { title: 'Set Password — EduTrack SMS' };

export default function SetPasswordPage() {
  return (
    <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-sm mx-auto animate-scale-in">
      <h1 className="text-2xl font-bold text-center mb-2">Create Password</h1>
      <p className="text-center text-gray-600 text-sm mb-6">
        Choose a strong password to secure your account
      </p>
      <SetPasswordForm />
    </div>
  );
}
