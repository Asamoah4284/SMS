export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar — TODO: Sidebar component */}
      <aside className="w-64 bg-white shadow-sm flex-shrink-0">
        <div className="p-4 border-b">
          <h1 className="font-bold text-lg">EduTrack SMS</h1>
        </div>
        {/* Navigation links */}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar — TODO: TopBar component */}
        <header className="bg-white shadow-sm h-16 flex items-center px-6 flex-shrink-0">
          {/* School name, user menu */}
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
