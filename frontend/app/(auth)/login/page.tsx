import LoginForm from "./LoginForm";
import { schoolConfig } from '@/lib/theme';
import Image from "next/image";

export const metadata = { title: `Login — ${schoolConfig.name}` };

export default function LoginPage() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 sm:p-7 w-full max-w-sm mx-auto">
      <div className="relative mx-auto h-20 w-20">
        <Image
          src="/images/logo.png"
          alt="School logo"
          fill
          className="object-contain"
          sizes="80px"
          priority
        />
      </div>
      <h1 className="text-2xl font-bold text-center mb-1.5 text-gray-900">{schoolConfig.name}</h1>
      <p className="text-center text-gray-500 text-sm mb-5">Sign in to your account</p>
      <LoginForm />
    </div>
  );
}
