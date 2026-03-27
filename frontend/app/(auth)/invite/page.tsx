import { schoolConfig } from '@/lib/theme';
import InviteForm from './InviteForm';
import Image from 'next/image';

export const metadata = { title: `Acceptance Code — ${schoolConfig.name}` };

export default function InvitePage() {
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
      <h1 className="text-2xl font-bold text-center mb-2">Accept Invitation</h1>
      <p className="text-center text-gray-600 text-sm mb-6">
        Enter your staff ID and invitation code to get started
      </p>
      <InviteForm />
    </div>
  );
}
