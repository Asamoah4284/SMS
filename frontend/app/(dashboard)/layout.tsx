'use client';

import Sidebar from './Sidebar';
import { useState } from 'react';
import { Bell, Menu } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans relative">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="flex-1 flex flex-col h-screen min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 h-16 md:h-20 flex items-center justify-between px-4 md:px-8 shrink-0 z-10 w-full relative">
          <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
            <button
              type="button"
              aria-label="Open sidebar"
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex items-center gap-6">
            <button className="relative text-gray-500 hover:text-gray-700 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
            </button>
            <div className="h-8 w-px bg-gray-200 hidden sm:block"></div>
            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="flex flex-col text-right">
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

