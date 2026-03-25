/**
 * Design system constants for use in TypeScript/JSX.
 * Colors and design tokens live in globals.css (@theme block).
 * This file provides: icon mappings, route metadata, and shared className utilities.
 * School branding (name, logo) reads from environment variables.
 */

import {
  Users,
  GraduationCap,
  BookOpen,
  CalendarCheck,
  FileText,
  CreditCard,
  Megaphone,
  ShieldCheck,
  BarChart3,
  Settings,
  Home,
  UserPlus,
  ClipboardList,
  Receipt,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  type LucideIcon,
} from 'lucide-react';

// ─── School Branding (from .env) ──────────────────────────────────────────────

export const schoolConfig = {
  name: process.env.NEXT_PUBLIC_SCHOOL_NAME || 'EduTrack SMS',
  logo: process.env.NEXT_PUBLIC_SCHOOL_LOGO || '/logo.png',
  motto: process.env.NEXT_PUBLIC_SCHOOL_MOTTO || 'Excellence in Education',
  address: process.env.NEXT_PUBLIC_SCHOOL_ADDRESS || '',
  phone: process.env.NEXT_PUBLIC_SCHOOL_PHONE || '',
  email: process.env.NEXT_PUBLIC_SCHOOL_EMAIL || '',
} as const;

// ─── Route map ────────────────────────────────────────────────────────────────

export const routes = {
  dashboard: '/overview',
  students: '/students',
  teachers: '/teachers',
  classes: '/classes',
  attendance: '/attendance',
  results: '/results',
  fees: '/fees',
  announcements: '/announcements',
  permissions: '/permissions',
  reports: '/reports',
  settings: '/settings',
  login: '/login',
  invite: '/invite',
  forgotPassword: '/forgot-password',
  parentPortal: '/portal',
} as const;

// ─── Icon map (concept → icon) ────────────────────────────────────────────────

export const icons: Record<string, LucideIcon> = {
  dashboard:     BarChart3,
  students:      Users,
  teachers:      GraduationCap,
  classes:       BookOpen,
  attendance:    CalendarCheck,
  results:       FileText,
  fees:          CreditCard,
  announcements: Megaphone,
  permissions:   ShieldCheck,
  reports:       BarChart3,
  settings:      Settings,
  home:          Home,
  addUser:       UserPlus,
  classList:     ClipboardList,
  receipt:       Receipt,
  pending:       Clock,
  approved:      CheckCircle2,
  rejected:      XCircle,
  error:         AlertCircle,
  warning:       AlertTriangle,
  info:          Info,
};

// ─── Status badge styles ──────────────────────────────────────────────────────

export const statusStyles = {
  // Attendance
  PRESENT: 'bg-success-50 text-success-700 border-success-100',
  ABSENT:  'bg-danger-50 text-danger-700 border-danger-100',
  LATE:    'bg-warning-50 text-warning-700 border-warning-100',
  EXCUSED: 'bg-info-50 text-info-700 border-info-100',

  // Fee payment
  FULLY_PAID: 'bg-success-50 text-success-700 border-success-100',
  HALF_PAID:  'bg-warning-50 text-warning-700 border-warning-100',
  PARTIAL:    'bg-info-50 text-info-700 border-info-100',
  UNPAID:     'bg-danger-50 text-danger-700 border-danger-100',

  // Permission requests
  PENDING:  'bg-warning-50 text-warning-700 border-warning-100',
  APPROVED: 'bg-success-50 text-success-700 border-success-100',
  REJECTED: 'bg-danger-50 text-danger-700 border-danger-100',
} as const;

// ─── Class level display names ────────────────────────────────────────────────

export const classLevelLabels: Record<string, string> = {
  NURSERY_1: 'Nursery 1',
  NURSERY_2: 'Nursery 2',
  KG_1:      'KG 1',
  KG_2:      'KG 2',
  BASIC_1:   'Basic 1',
  BASIC_2:   'Basic 2',
  BASIC_3:   'Basic 3',
  BASIC_4:   'Basic 4',
  BASIC_5:   'Basic 5',
  BASIC_6:   'Basic 6',
  JHS_1:     'JHS 1',
  JHS_2:     'JHS 2',
  JHS_3:     'JHS 3',
};

// ─── GES Grade scale ──────────────────────────────────────────────────────────

export const gradeScale = [
  { min: 80, max: 100, grade: 'A1', label: 'Excellent',  color: 'text-success-700' },
  { min: 70, max: 79,  grade: 'B2', label: 'Very Good',  color: 'text-success-600' },
  { min: 60, max: 69,  grade: 'B3', label: 'Good',       color: 'text-primary-600' },
  { min: 50, max: 59,  grade: 'C4', label: 'Credit',     color: 'text-primary-500' },
  { min: 45, max: 49,  grade: 'C5', label: 'Credit',     color: 'text-warning-600' },
  { min: 40, max: 44,  grade: 'C6', label: 'Credit',     color: 'text-warning-600' },
  { min: 35, max: 39,  grade: 'D7', label: 'Pass',       color: 'text-warning-700' },
  { min: 30, max: 34,  grade: 'E8', label: 'Pass',       color: 'text-danger-500'  },
  { min: 0,  max: 29,  grade: 'F9', label: 'Fail',       color: 'text-danger-700'  },
] as const;

export function getGrade(total: number) {
  return gradeScale.find((g) => total >= g.min && total <= g.max) ?? gradeScale[gradeScale.length - 1];
}

// ─── Shared className utilities ───────────────────────────────────────────────

/** Card container */
export const card = 'bg-white border border-gray-200 rounded-2xl shadow-[var(--shadow-card)]';

/** Input field */
export const input =
  'w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all';

/** Label */
export const label = 'block text-sm font-semibold text-gray-700 mb-1.5';

/** Primary button */
export const btnPrimary =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white font-semibold text-sm rounded-lg hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed';

/** Secondary button */
export const btnSecondary =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-gray-700 font-semibold text-sm rounded-lg border border-gray-200 hover:bg-gray-50 focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed';

/** Danger button */
export const btnDanger =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-danger-600 text-white font-semibold text-sm rounded-lg hover:bg-danger-700 focus:ring-2 focus:ring-danger-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed';

/** Status badge */
export const badge = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border';
