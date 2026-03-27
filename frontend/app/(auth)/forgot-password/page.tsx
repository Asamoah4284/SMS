import { schoolConfig } from '@/lib/theme';
import ForgotPasswordForm from './ForgotPasswordForm';
import Image from 'next/image';

export const metadata = { title: 'Forgot Password — EduTrack SMS' };

export default function ForgotPasswordPage() {
  return (
    <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-sm mx-auto animate-scale-in">
      <Image
        src="/images/logo.png"
        alt={`${schoolConfig.name} Logo`}
        width={64}
        height={64}
        className="w-16 h-16 mx-auto mb-4"
        priority
      />

      <h1 className="text-2xl font-bold text-center mb-2">Reset Password</h1>
      <p className="text-center text-gray-600 text-sm mb-6">
        Enter your phone number to receive an OTP
      </p>
      <ForgotPasswordForm />
    </div>
  );
}
