import LoginForm from "./LoginForm";
import { schoolConfig } from '@/lib/theme';
import Image from "next/image";

export const metadata = { title: `Login — ${schoolConfig.name}` };

export default function LoginPage() {
  return (
    <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-sm mx-auto">
      <Image
        src="/logo.png"
        alt={`${schoolConfig.name} Logo`}
        width={64}
        height={64}
        className="w-16 h-16 mx-auto mb-4"
        priority
      />
      <h1 className="text-2xl font-bold text-center mb-2">{schoolConfig.name}</h1>
      <p className="text-center text-gray-500 text-sm mb-6">Sign in to your account</p>
      <LoginForm />
    </div>
  );
}
