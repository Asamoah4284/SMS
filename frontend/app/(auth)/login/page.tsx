import LoginForm from "./LoginForm";
import { schoolConfig } from '@/lib/theme';
import Image from "next/image";

export const metadata = { title: `Login — ${schoolConfig.name}` };

export default function LoginPage() {
  return (
    <div className="w-full animate-scale-in rounded-2xl border border-gray-100 bg-white p-6 shadow-[var(--shadow-card-hover)] sm:p-8">
      <header className="mb-7 flex flex-col items-center text-center">
        <div className="relative mb-4 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-primary-50 ring-4 ring-primary-100/70">
          <div className="relative h-14 w-14">
            <Image
              src={schoolConfig.logo}
              alt={`${schoolConfig.name} logo`}
              fill
              className="object-contain"
              sizes="56px"
              priority
            />
          </div>
        </div>
        <h1 className="max-w-[18rem] text-balance text-xl font-bold leading-snug tracking-tight text-gray-900">
          {schoolConfig.name}
        </h1>
        <p className="mt-3 text-sm text-gray-500">Sign in to your account</p>
      </header>
      <LoginForm />
    </div>
  );
}
