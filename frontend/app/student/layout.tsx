export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4f6fb] relative overflow-x-hidden">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.45]"
        aria-hidden
        style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 50% at 20% -10%, rgba(59, 130, 246, 0.18), transparent),
            radial-gradient(ellipse 60% 40% at 90% 10%, rgba(99, 102, 241, 0.12), transparent),
            radial-gradient(ellipse 50% 30% at 50% 100%, rgba(16, 185, 129, 0.08), transparent)
          `,
        }}
      />
      <div className="relative z-0">{children}</div>
    </div>
  );
}
