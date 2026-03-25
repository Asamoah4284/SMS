"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  CalendarCheck, 
  FileText, 
  CreditCard, 
  Megaphone, 
  ShieldCheck, 
  BarChart, 
  Settings 
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    document.cookie = 'accessToken=; path=/; max-age=0; samesite=lax';
    router.push('/login');
  };

  const managementItems = [
    { name: "Students", href: "/students", icon: Users },
    { name: "Teachers", href: "/teachers", icon: GraduationCap },
    { name: "Classes", href: "/classes", icon: BookOpen },
    { name: "Attendance", href: "/attendance", icon: CalendarCheck },
    { name: "Results", href: "/results", icon: FileText },
    { name: "Fees", href: "/fees", icon: CreditCard },
  ];

  const administrationItems = [
    { name: "Announcements", href: "/announcements", icon: Megaphone },
    { name: "Permissions", href: "/permissions", icon: ShieldCheck },
    { name: "Reports", href: "/reports", icon: BarChart },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col h-full shadow-sm relative z-10 transition-all duration-300">
      {/* Brand area */}
      <div className="p-6 border-b border-gray-100 flex items-center shrink-0">
        <Link href="/" className="flex items-center gap-3 outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 transition-opacity hover:opacity-80">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-lg tracking-tight">E</span>
          </div>
          <h1 className="font-bold text-xl tracking-tight text-gray-900">EduTrack <span className="text-blue-600">SMS</span></h1>
        </Link>
      </div>

      {/* Navigation scroll area */}
      <div className="flex-1 py-4 overflow-y-auto w-full custom-scrollbar">
        <nav className="flex flex-col gap-1 px-3 w-full">
          {/* Dashboard Home */}
          <div className="px-2 mb-1">
            <Link 
              href="/overview"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                pathname === "/overview" ? "bg-black text-white shadow-md shadow-gray-200" : "text-gray-600 hover:bg-gray-100 hover:text-black"
              }`}
            >
              <BarChart className="w-5 h-5" />
              Overview
            </Link>
          </div>
          
          <div className="h-4" /> {/* Spacer */}
          
          <p className="px-5 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Management</p>

          <div className="px-2 w-full space-y-1">
            {managementItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link 
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                    isActive ? "bg-blue-50 text-blue-700 shadow-sm" : "text-gray-600 hover:bg-gray-100 hover:text-black"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? "text-blue-700" : ""}`} />
                  {item.name}
                </Link>
              )
            })}
          </div>

          <div className="h-4" /> {/* Spacer */}
          <p className="px-5 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Administration</p>

          <div className="px-2 w-full space-y-1">
            {administrationItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link 
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                    isActive ? "bg-blue-50 text-blue-700 shadow-sm" : "text-gray-600 hover:bg-gray-100 hover:text-black"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? "text-blue-700" : ""}`} />
                  {item.name}
                </Link>
              )
            })}
          </div>
        </nav>
      </div>

      <div className="p-4 border-t border-gray-100 shrink-0">
        <button onClick={handleSignOut} className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-red-600 hover:bg-red-50 transition-colors w-full">
           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-log-out"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
           Sign Out
        </button>
      </div>
    </aside>
  );
}
