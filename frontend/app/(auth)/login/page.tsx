import LoginForm from "./LoginForm";

export const metadata = { title: 'Login — EduTrack SMS' };

export default function LoginPage() {
  return (
    <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-sm mx-auto">
      <h1 className="text-2xl font-bold text-center mb-2">EduTrack SMS</h1>
      <p className="text-center text-gray-500 text-sm mb-6">Sign in to your account</p>
      <LoginForm />
    </div>
  );
}
