import Sidebar from "./Sidebar";
import Link from "next/link";
import { Bell, Search } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col h-screen min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 h-20 flex items-center justify-between px-8 shrink-0 z-10 w-full relative">
          <div className="flex items-center gap-4 w-96">
            {/* Search Bar Placeholder */}
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="pl-10 pr-4 py-2 w-full border-none bg-gray-100 rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-900 placeholder:text-gray-500"
                placeholder="Search students, classes..."
              />
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <button className="relative text-gray-500 hover:text-gray-700 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
            </button>
            <div className="h-8 w-px bg-gray-200 hidden sm:block"></div>
            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="flex flex-col text-right">
                <span className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">Admin User</span>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Super Admin</span>
              </div>
              <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-full shadow-sm flex items-center justify-center ring-2 ring-white border border-gray-100 text-white font-bold tracking-tight">
                AD
              </div>
            </div>
          </div>
        </header>

        {/* Content scrolling area */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 custom-scrollbar h-full w-full">
          <div className="min-h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

