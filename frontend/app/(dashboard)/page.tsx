export const metadata = { title: 'Dashboard — EduTrack SMS' };

export default function DashboardPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

      {/* TODO: Stats cards — total students, attendance rate, fees collected, teachers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Students" value="—" />
        <StatCard label="Attendance Today" value="—" />
        <StatCard label="Fees Collected" value="—" />
        <StatCard label="Teachers" value="—" />
      </div>

      {/* TODO: Recent announcements, pending permissions, low attendance alerts */}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}
