import {
  Users,
  GraduationCap,
  Banknote,
  CalendarCheck,
  Megaphone,
  Plus,
  ArrowRight,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  Check,
  Clock,
  CalendarDays,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { DropdownMenu } from "@/components/ui";
import OverviewRoleGate from "./OverviewRoleGate";

export const metadata = { title: `${process.env.NEXT_PUBLIC_APP_NAME || 'DEACONS SMS'} — Overview` };

type OverviewStats = {
  students: { total: number; active: number; inactive: number; addedThisMonth: number };
  attendanceToday: { rate: number; present: number; absent: number; excused: number; totalMarked: number };
  attendanceWeekly: {
    days: {
      date: string;
      label: string;
      presentRate: number;
      absentRate: number;
      present: number;
      absent: number;
      totalMarked: number;
    }[];
    weekOverWeekChange: number | null;
  };
  fees: {
    collectedThisMonth: number;
    pendingCount: number;
    collectionRate: number;
    recentPayments: {
      studentName: string;
      date: string;
      amount: number;
      status: 'Paid' | 'Pending';
    }[];
  };
  staff: { total: number; active: number; inactive: number };
  upcomingEvents: {
    id: string;
    title: string;
    date: string;
    type: 'assessment' | 'exam' | 'term';
    subtitle: string;
  }[];
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

const EVENT_STYLES: Record<
  OverviewStats['upcomingEvents'][number]['type'],
  { icon: LucideIcon; iconClass: string; iconBg: string }
> = {
  assessment: {
    icon: ClipboardCheck,
    iconClass: 'text-purple-700',
    iconBg: 'bg-purple-50 border-purple-100',
  },
  exam: {
    icon: ClipboardCheck,
    iconClass: 'text-purple-700',
    iconBg: 'bg-purple-50 border-purple-100',
  },
  term: {
    icon: CalendarDays,
    iconClass: 'text-emerald-700',
    iconBg: 'bg-emerald-50 border-emerald-100',
  },
};

function formatInt(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatGhs(value: number): string {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 0,
  }).format(value);
}

async function getOverviewStats(token?: string): Promise<OverviewStats | null> {
  if (!token) return null;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";
  const res = await fetch(`${baseUrl}/reports/overview`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as OverviewStats;
}

export default async function DashboardPage() {
  const token = (await cookies()).get("accessToken")?.value;
  const stats = await getOverviewStats(token);

  const studentsValue = stats ? `${formatInt(stats.students.total)}` : "—";
  const attendanceValue = stats ? `${stats.attendanceToday.rate}% Present` : "—";
  const feesValue = stats ? formatGhs(stats.fees.collectedThisMonth) : "—";
  const feesCollectionRate = stats?.fees.collectionRate ?? 0;
  const recentPayments = stats?.fees.recentPayments ?? [];
  const upcomingEvents = stats?.upcomingEvents ?? [];
  const attendanceDays = stats?.attendanceWeekly.days ?? [];
  const weekOverWeekChange = stats?.attendanceWeekly.weekOverWeekChange ?? null;
  const staffValue = stats ? `${formatInt(stats.staff.total)}` : "—";

  return (
    <OverviewRoleGate>
    <div className="p-6 max-w-[1600px] w-full mx-auto animate-in fade-in duration-500 h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">
            Welcome Back.
          </h2>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            Here&apos;s a summary of what&apos;s happening at your school today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/announcements"
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-3.5 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm focus:ring-2 focus:ring-gray-200 outline-none"
          >
            <Megaphone className="w-4 h-4 text-gray-500" />
            Announcement
          </Link>
          <Link
            href="/students/new"
            className="flex items-center gap-2 bg-black text-white px-3.5 py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors shadow-sm focus:ring-2 focus:ring-black outline-none"
          >
            <Plus className="w-4 h-4 text-gray-300" />
            Add Student
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 w-full">
        <KpiCard
          title="Students"
          icon={Users}
          iconClassName="text-blue-600"
          iconBgClassName="bg-blue-50 border-blue-100"
          sparklineColor="#2563eb"
          value={studentsValue}
          subtitle="Students"
          badge={stats ? `+ ${formatInt(stats.students.addedThisMonth)} this month` : undefined}
        />
        <KpiCard
          title="Attendance Today"
          icon={CalendarCheck}
          iconClassName="text-green-600"
          iconBgClassName="bg-green-50 border-green-100"
          sparklineColor="#059669"
          value={attendanceValue}
          subtitle={
            stats ? `${formatInt(stats.attendanceToday.present)} Present` : "—"
          }
          footer={
            stats ? (
              <span className="text-xs font-semibold text-gray-500">
                <span className="font-bold text-red-500">
                  {formatInt(stats.attendanceToday.absent)}
                </span>{" "}
                Absent
              </span>
            ) : undefined
          }
        />
        <KpiCard
          title="Fees Collected"
          icon={Banknote}
          iconClassName="text-amber-600"
          iconBgClassName="bg-amber-50 border-amber-100"
          sparklineColor="#d97706"
          value={feesValue}
          subtitle="Fees Collected"
          progress={
            stats
              ? {
                  value: feesCollectionRate,
                  label: `${feesCollectionRate}% collected`,
                }
              : undefined
          }
        />
        <KpiCard
          title="Teachers / Staff"
          icon={GraduationCap}
          iconClassName="text-purple-600"
          iconBgClassName="bg-purple-50 border-purple-100"
          sparklineColor="#7c3aed"
          value={staffValue}
          subtitle="Staff Members"
          footer={
            stats ? (
              <span className="text-xs font-semibold text-gray-500">
                Active:{" "}
                <span className="text-gray-900 font-bold">
                  {formatInt(stats.staff.active)}
                </span>
                {stats.staff.inactive > 0 ? (
                  <>
                    {" "}
                    • Inactive:{" "}
                    <span className="text-gray-900 font-bold">
                      {formatInt(stats.staff.inactive)}
                    </span>
                  </>
                ) : null}
              </span>
            ) : undefined
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full pb-6">
        <div className="bg-white border border-gray-200 shadow-sm shadow-gray-200/50 rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">Attendance Overview</h3>
            <DropdownMenu
              iconOnly
              triggerLabel="Attendance actions"
              triggerIcon={<MoreHorizontal className="w-5 h-5" />}
              buttonClassName="p-2 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors"
              items={[
                { label: 'Open Attendance', href: '/attendance' },
                { label: 'View Results', href: '/results' },
                { label: 'Open Timetable', href: '/timetable' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4 items-stretch">
            <div className="bg-gradient-to-b from-blue-50/60 to-transparent rounded-xl border border-gray-100 p-4">
              <MiniLineChart days={attendanceDays} />
              <div className="mt-3 flex items-center justify-center gap-3">
                {weekOverWeekChange !== null ? (
                  <div
                    className={[
                      "px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 border",
                      weekOverWeekChange >= 0
                        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                        : "bg-red-50 text-red-700 border-red-100",
                    ].join(" ")}
                  >
                    {weekOverWeekChange >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    {weekOverWeekChange >= 0 ? "+" : ""}
                    {weekOverWeekChange}%
                    <span className={weekOverWeekChange >= 0 ? "font-medium text-emerald-600" : "font-medium text-red-600"}>
                      since last week
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Not enough attendance data for weekly trend.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 p-4 flex flex-col justify-between">
              <div>
                <p className="text-3xl font-extrabold tracking-tight text-emerald-600">
                  {stats ? `${stats.attendanceToday.rate}%` : "—"}
                </p>
                <p className="text-sm font-semibold text-gray-700 mt-0.5">
                  Present
                </p>
              </div>
              <div className="mt-4 space-y-1">
                <p className="text-xs font-semibold text-gray-500">
                  {stats ? `${formatInt(stats.attendanceToday.present)} Present` : "—"}
                </p>
                <p className="text-xs font-semibold text-gray-500">
                  {stats ? (
                    <>
                      <span className="text-red-500 font-bold">
                        {formatInt(stats.attendanceToday.absent)}
                      </span>{" "}
                      Absent
                    </>
                  ) : (
                    "—"
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm shadow-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">Fees Summary</h3>
            <DropdownMenu
              iconOnly
              triggerLabel="Fees actions"
              triggerIcon={<MoreHorizontal className="w-5 h-5" />}
              buttonClassName="p-2 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors"
              items={[
                { label: 'Open Fees', href: '/fees' },
                { label: 'View Pending Fees', href: '/fees' },
                { label: 'Fee Reports', href: '/results' },
              ]}
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-lg font-extrabold tracking-tight text-gray-900">
                {feesValue}
              </p>
              <p className="text-sm font-semibold text-gray-500 leading-tight">
                Collected
              </p>

              <div className="mt-3">
                <div className="h-0.5 w-full bg-gray-200 rounded-none overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-none"
                    style={{
                      width: `${stats ? feesCollectionRate : 0}%`,
                    }}
                  />
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold">
                  <span className="text-emerald-700">
                    {stats ? `${feesCollectionRate}% collected` : "—"}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span className="text-gray-500">
                    {stats ? `${formatInt(stats.fees.pendingCount)} pending` : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-900">Recent Fee Payments</p>
              <Link href="/fees" className="text-[11px] font-semibold text-blue-600 hover:text-blue-700">
                View all
              </Link>
            </div>

            <div className="grid grid-cols-[1.4fr_0.8fr_0.6fr] gap-3 px-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <span>Name</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Status</span>
            </div>

            <div className="space-y-2">
              {recentPayments.length === 0 ? (
                <p className="text-xs text-gray-500 px-1 py-3">No fee payments recorded yet.</p>
              ) : (
                recentPayments.map((p) => (
                <div
                  key={`${p.studentName}-${p.date}-${p.amount}`}
                  className="grid grid-cols-[1.4fr_0.8fr_0.6fr] gap-3 items-center rounded-xl px-1 py-2 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-[11px] font-bold text-gray-700 shrink-0">
                      {p.studentName.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">
                        {p.studentName}
                      </p>
                      <p className="text-[11px] font-medium text-gray-500 truncate">
                        {formatDate(p.date)}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs font-bold text-gray-900 text-right">
                    {formatGhs(p.amount)}
                  </p>

                  <div className="flex justify-end">
                    <span
                      className={[
                        "inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-full",
                        p.status === "Paid"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700",
                      ].join(" ")}
                    >
                      {p.status === "Paid" ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Clock className="w-3.5 h-3.5" />
                      )}
                      {p.status}
                    </span>
                  </div>
                </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm shadow-gray-200/50 rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">Upcoming Events</h3>
            <Link href="/results" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
            {upcomingEvents.length === 0 ? (
              <p className="text-xs text-gray-500 px-4 py-6">No upcoming events scheduled.</p>
            ) : (
              upcomingEvents.map((e) => {
              const style = EVENT_STYLES[e.type];
              const Icon = style.icon;
              return (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-4 px-4 py-3 bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={[
                        "w-9 h-9 rounded-xl border flex items-center justify-center shrink-0",
                        style.iconBg,
                      ].join(" ")}
                    >
                      <Icon className={["w-4.5 h-4.5", style.iconClass].join(" ")} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-gray-900 truncate">
                        {e.title}
                      </p>
                      <p className="text-[11px] font-medium text-gray-500 truncate">
                        {e.subtitle}
                      </p>
                    </div>
                  </div>

                  <p className="text-[11px] font-semibold text-gray-500 shrink-0">
                    {formatDateTime(e.date)}
                  </p>
                </div>
              );
              })
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm shadow-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">Quick Notes</h3>
            <DropdownMenu
              iconOnly
              triggerLabel="Quick notes actions"
              triggerIcon={<MoreHorizontal className="w-5 h-5" />}
              buttonClassName="p-2 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors"
              items={[
                { label: 'Create Announcement', href: '/announcements' },
                { label: 'Open Timetable', href: '/timetable' },
                { label: 'Dashboard Settings', href: '/settings' },
              ]}
            />
          </div>
          <p className="text-xs font-semibold text-gray-500">
            This panel is a placeholder (same style as your reference dashboard). We can hook it to announcements, reminders, or approvals.
          </p>
        </div>
      </div>
    </div>
    </OverviewRoleGate>
  );
}

function KpiCard({
  title,
  icon: Icon,
  iconClassName,
  iconBgClassName,
  sparklineColor,
  value,
  subtitle,
  badge,
  progress,
  footer,
}: {
  title: string;
  icon: LucideIcon;
  iconClassName: string;
  iconBgClassName: string;
  sparklineColor: string;
  value: string;
  subtitle: string;
  badge?: string;
  progress?: { value: number; label: string };
  footer?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm shadow-gray-200/50 p-4 flex items-center justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className={["w-10 h-10 rounded-xl border flex items-center justify-center shrink-0", iconBgClassName].join(" ")}>
          <Icon className={["w-5 h-5", iconClassName].join(" ")} />
        </div>
        <div className="min-w-0">
          <p className="text-base font-extrabold text-gray-900 truncate leading-tight">
            {value}
          </p>
          <p className="text-sm font-medium text-gray-500">{subtitle}</p>
          {badge ? (
            <span className="inline-flex mt-2 items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded-full text-[11px] font-bold">
              {badge}
            </span>
          ) : null}
          {footer ? <div className="mt-2">{footer}</div> : null}
          {progress ? (
            <div className="mt-2">
              <div className="h-1 w-28 bg-gray-100 rounded-none overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-none" style={{ width: `${progress.value}%` }} />
              </div>
              <p className="mt-1 text-[11px] font-semibold text-gray-500">{progress.label}</p>
            </div>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-2">
        <MiniSparkline color={sparklineColor} />
        <ArrowRight className="w-4 h-4 text-gray-300" />
      </div>
      <span className="sr-only">{title}</span>
    </div>
  );
}

function MiniSparkline({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 64 22"
      className="w-16 h-6 opacity-90"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2 15 C 10 6, 18 18, 26 10 C 33 3, 42 16, 50 8 C 56 4, 60 9, 62 6"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MiniLineChart({
  days,
}: {
  days: OverviewStats["attendanceWeekly"]["days"];
}) {
  const chartTop = 35;
  const chartHeight = 105;
  const xStart = 10;
  const xEnd = 510;

  const rateToY = (rate: number) => chartTop + chartHeight - (rate / 100) * chartHeight;

  const buildSmoothPath = (values: number[]) => {
    if (values.length === 0) return "";
    const step = values.length > 1 ? (xEnd - xStart) / (values.length - 1) : 0;
    const points = values.map((v, i) => ({
      x: xStart + i * step,
      y: rateToY(v),
    }));
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i += 1) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return d;
  };

  const presentRates = days.map((d) => d.presentRate);
  const absentRates = days.map((d) => d.absentRate);
  const presentPath = buildSmoothPath(presentRates);
  const absentPath = buildSmoothPath(absentRates);
  const hasData = days.some((d) => d.totalMarked > 0);

  const markerPoints = days.map((d, i) => {
    const step = days.length > 1 ? (xEnd - xStart) / (days.length - 1) : 0;
    return {
      x: xStart + i * step,
      y: rateToY(d.presentRate),
      show: d.totalMarked > 0,
    };
  });

  return (
    <svg viewBox="0 0 520 170" className="w-full h-[170px]">
      <defs>
        <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lineFill2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </linearGradient>
      </defs>

      <g stroke="#e5e7eb" strokeWidth="1">
        <line x1="0" y1="140" x2="520" y2="140" />
        <line x1="0" y1="95" x2="520" y2="95" />
        <line x1="0" y1="50" x2="520" y2="50" />
      </g>

      {!hasData ? (
        <text x="260" y="90" textAnchor="middle" fill="#9ca3af" fontSize="12" fontWeight="600">
          No attendance marked this week
        </text>
      ) : (
        <>
          {presentPath && (
            <>
              <path d={presentPath} fill="none" stroke="#3b82f6" strokeWidth="3" />
              <path d={`${presentPath} L ${xEnd} 170 L ${xStart} 170 Z`} fill="url(#lineFill)" />
            </>
          )}
          {absentPath && (
            <>
              <path d={absentPath} fill="none" stroke="#10b981" strokeWidth="3" />
              <path d={`${absentPath} L ${xEnd} 170 L ${xStart} 170 Z`} fill="url(#lineFill2)" />
            </>
          )}
          <g fill="#ffffff" stroke="#3b82f6" strokeWidth="3">
            {markerPoints
              .filter((p) => p.show)
              .map((p) => (
                <circle key={`${p.x}-${p.y}`} cx={p.x} cy={p.y} r="6" />
              ))}
          </g>
        </>
      )}

      <g fill="#6b7280" fontSize="12" fontWeight="600">
        {days.map((d, i) => {
          const step = days.length > 1 ? (xEnd - xStart) / (days.length - 1) : 0;
          const x = xStart + i * step;
          return (
            <text key={d.date} x={x} y="165" textAnchor="middle">
              {d.label}
            </text>
          );
        })}
      </g>
    </svg>
  );
}
