export default function ParentPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="font-bold text-lg">EduTrack — Parent Portal</h1>
          {/* TODO: user menu / logout */}
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
