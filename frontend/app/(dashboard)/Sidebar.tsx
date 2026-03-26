"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import {
  Home,
  Users,
  GraduationCap,
  BookOpen,
  CalendarCheck,
  FileText,
  CreditCard,
  UserRound,
  ClipboardList,
  Award,
  Library,
  ChevronRight,
  LogOut,
} from "lucide-react";

type NavChild = {
  name: string;
  href: string;
};

type NavItem = {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  children?: NavChild[];
};

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

  const navItems = useMemo<NavItem[]>(
    () => [
      { name: "Dashboard", href: "/overview", icon: Home },
      {
        name: "Students",
        icon: GraduationCap,
        children: [
          { name: "Add New Student", href: "/students/new" },
          { name: "Student List", href: "/students" },
          { name: "Suspend Student", href: "/students/suspend" },
          { name: "Student Categories", href: "/students/categories" },
        ],
      },
      {
        name: "Teachers",
        icon: Users,
        children: [
          { name: "Add New Teacher", href: "/teachers/new" },
          { name: "Teacher List", href: "/teachers" },
        ],
      },
      { name: "Guardian", href: "/parents", icon: UserRound },
      {
        name: "Classes",
        icon: BookOpen,
        children: [
          { name: "New Class", href: "/classes/new" },
          { name: "Class List", href: "/classes" },
        ],
      },
      { name: "Examinations", href: "/results", icon: FileText },
      { name: "Fees Collection", href: "/fees", icon: CreditCard },
      { name: "Attendance", href: "/attendance", icon: CalendarCheck },
      // Placeholder routes can be added later when pages exist.
      { name: "Leaves", href: "/leaves", icon: ClipboardList },
      { name: "Certificate", href: "/certificate", icon: Award },
      { name: "Library", href: "/library", icon: Library },
    ],
    []
  );

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Auto-open the section that matches the current route.
    setOpenSections((prev) => {
      const next = { ...prev };
      for (const item of navItems) {
        if (!item.children || item.children.length === 0) continue;
        const isInSection = item.children.some(
          (c) => pathname === c.href || pathname.startsWith(`${c.href}/`)
        );
        if (isInSection) next[item.name] = true;
      }
      return next;
    });
  }, [navItems, pathname]);

  return (
    <aside className="w-72 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col h-full shadow-sm relative z-10">
      {/* Brand area */}
      <div className="p-5 border-b border-gray-100 flex items-center shrink-0">
        <Link href="/" className="flex items-center gap-3 outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 transition-opacity hover:opacity-80">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-base tracking-tight">E</span>
          </div>
          <h1 className="font-bold text-lg tracking-tight text-gray-900">
            EduTrack <span className="text-blue-600">SMS</span>
          </h1>
        </Link>
      </div>

      {/* Navigation scroll area */}
      <div className="flex-1 py-5 overflow-y-auto w-full custom-scrollbar">
        <nav className="flex flex-col px-4 w-full">
          <ul className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const hasChildren = Boolean(item.children?.length);
              const isChildActive = item.children?.some(
                (c) => pathname === c.href || pathname.startsWith(`${c.href}/`)
              );
              const isSelfActive = item.href
                ? pathname === item.href || pathname.startsWith(`${item.href}/`)
                : false;
              const isActive = Boolean(isSelfActive || isChildActive);
              const isOpen = Boolean(openSections[item.name]);

              return (
                <li key={item.href ?? item.name}>
                  {hasChildren ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenSections((prev) => ({
                            ...prev,
                            [item.name]: !prev[item.name],
                          }))
                        }
                        className={[
                          "group flex w-full items-center justify-between rounded-xl px-4 py-2.5 transition-colors",
                          isOpen || isActive
                            ? "bg-teal-50 text-teal-900 border border-teal-100"
                            : "text-gray-700 hover:bg-gray-50",
                        ].join(" ")}
                      >
                        <span className="flex items-center gap-4 min-w-0">
                          <Icon
                            className={[
                              "h-4.5 w-4.5 shrink-0",
                              isOpen || isActive
                                ? "text-teal-700"
                                : "text-gray-600 group-hover:text-gray-800",
                            ].join(" ")}
                          />
                          <span className="text-sm font-medium truncate">
                            {item.name}
                          </span>
                        </span>

                        <ChevronRight
                          className={[
                            "h-4.5 w-4.5 shrink-0 transition-transform",
                            isOpen || isActive
                              ? "rotate-90 text-teal-700"
                              : "text-gray-400 group-hover:text-gray-600",
                          ].join(" ")}
                        />
                      </button>

                      {isOpen && (
                        <div className="mt-1 ml-6 pl-4 border-l border-teal-100">
                          <ul className="space-y-1 py-1">
                            {item.children!.map((child) => {
                              const childActive =
                                pathname === child.href ||
                                pathname.startsWith(`${child.href}/`);

                              return (
                                <li key={child.href}>
                                  <Link
                                    href={child.href}
                                    className={[
                                      "group flex items-center gap-3 rounded-lg py-2 pr-2 text-sm",
                                      childActive
                                        ? "text-gray-900 font-semibold"
                                        : "text-gray-600 hover:text-gray-900",
                                    ].join(" ")}
                                  >
                                    <span
                                      className={[
                                        "h-2 w-2 rounded-full shrink-0",
                                        childActive
                                          ? "bg-teal-600"
                                          : "bg-gray-300 group-hover:bg-gray-400",
                                      ].join(" ")}
                                    />
                                    <span className="truncate">{child.name}</span>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={item.href ?? "#"}
                      className={[
                        "group flex items-center rounded-xl px-4 py-2.5 transition-colors",
                        isActive ? "text-gray-900 bg-gray-50" : "text-gray-700 hover:bg-gray-50",
                      ].join(" ")}
                    >
                      <span className="flex items-center gap-4 min-w-0">
                        <Icon className="h-4.5 w-4.5 text-gray-600 group-hover:text-gray-800 shrink-0" />
                        <span className="text-sm font-medium truncate">{item.name}</span>
                      </span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div className="p-4 border-t border-gray-100 shrink-0">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-red-600 hover:bg-red-50 transition-colors w-full text-sm"
        >
          <span className="flex items-center gap-4">
            <LogOut className="h-4.5 w-4.5" />
            Sign Out
          </span>
        </button>
      </div>
    </aside>
  );
}
