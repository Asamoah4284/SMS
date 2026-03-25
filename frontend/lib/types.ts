// ─── Enums ───────────────────────────────────────────────────────────────────

export type Role = 'ADMIN' | 'TEACHER' | 'PARENT';
export type Gender = 'MALE' | 'FEMALE';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
export type PaymentStatus = 'FULLY_PAID' | 'HALF_PAID' | 'PARTIAL' | 'UNPAID';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type PermissionType =
  | 'SICK_LEAVE'
  | 'PERSONAL_LEAVE'
  | 'MATERNITY_LEAVE'
  | 'PATERNITY_LEAVE'
  | 'STUDY_LEAVE'
  | 'OTHER';

export type ClassLevel =
  | 'NURSERY_1' | 'NURSERY_2'
  | 'KG_1' | 'KG_2'
  | 'BASIC_1' | 'BASIC_2' | 'BASIC_3'
  | 'BASIC_4' | 'BASIC_5' | 'BASIC_6'
  | 'JHS_1' | 'JHS_2' | 'JHS_3';

// ─── Core types ───────────────────────────────────────────────────────────────

export interface SchoolConfig {
  name: string;
  motto?: string;
  address?: string;
  region?: string;
  district?: string;
  phone?: string;
  email?: string;
  logo?: string;
}

export interface User {
  id: string;
  phone: string;
  email?: string;
  firstName: string;
  lastName: string;
  role: Role;
  photo?: string;
  isActive: boolean;
}

export interface Teacher {
  id: string;
  staffId?: string;
  qualification?: string;
  user: User;
}

export interface Parent {
  id: string;
  user: User;
}

export interface Student {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender: Gender;
  photo?: string;
  address?: string;
  isActive: boolean;
  enrolledAt: string;
  classId?: string;
  class?: Class;
  parentId?: string;
  parent?: Parent;
}

export interface Class {
  id: string;
  name: string;
  level: ClassLevel;
  section?: string;
  classTeacher?: Teacher;
  studentCount?: number;
}

export interface Subject {
  id: string;
  name: string;
  code?: string;
}

export interface SubjectTeacher {
  id: string;
  teacher: Teacher;
  subject: Subject;
  class: Class;
}

export interface Term {
  id: string;
  name: string;
  year: number;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface Attendance {
  id: string;
  date: string;
  status: AttendanceStatus;
  note?: string;
  studentId: string;
  termId: string;
}

export interface TeacherAttendance {
  id: string;
  date: string;
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
  teacherId: string;
  termId: string;
}

export interface Result {
  id: string;
  classScore?: number;
  examScore?: number;
  totalScore?: number;
  grade?: string;
  position?: number;
  remarks?: string;
  isPromoted?: boolean;
  studentId: string;
  student?: Student;
  subjectId: string;
  subject?: Subject;
  termId: string;
}

export interface FeeStructure {
  id: string;
  name: string;
  amount: number;
  classLevel?: ClassLevel;
  termId?: string;
}

export interface FeePayment {
  id: string;
  amountPaid: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  receiptNumber?: string;
  paidAt?: string;
  studentId: string;
  student?: Student;
  feeStructureId: string;
  termId: string;
}

export interface PermissionRequest {
  id: string;
  type: PermissionType;
  reason: string;
  startDate: string;
  endDate: string;
  status: RequestStatus;
  adminNote?: string;
  userId: string;
  user?: User;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: 'ALL' | 'TEACHERS' | 'PARENTS' | 'SPECIFIC_CLASS';
  classId?: string;
  createdAt: string;
}

export interface Timetable {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classId: string;
  class?: Class;
  subjectId: string;
  subject?: Subject;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  accessToken: string;
  user: User;
}
