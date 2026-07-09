import ChangePasswordForm from './ChangePasswordForm';

export default function ChangePasswordPage() {
  return (
    <div className="w-full max-w-md">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Change your password</h1>
      <p className="text-sm text-gray-500 mb-6">For security, set a personal password before using the dashboard.</p>
      <ChangePasswordForm required />
    </div>
  );
}
