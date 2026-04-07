/**
 * prisma/seed.js
 * Eagle's Nest International School — Comprehensive Demo Seed
 *
 * Run:  npm run db:seed   OR   node prisma/seed.js
 *
 * Seeds:
 *   ✓ 3 Academic Terms (Term 1 completed, Term 2 current, Term 3 upcoming)
 *   ✓ 13 Class levels (Nursery 1 → JHS 3)
 *   ✓ 11 Subjects
 *   ✓ 1 Admin / Headmaster
 *   ✓ 15 Teachers with class assignments
 *   ✓ 252 Students with authentic Ghanaian names
 *   ✓ 132 Parent portal accounts (Basic 4 – JHS 3)
 *   ✓ Subject-Teacher assignments per class
 *   ✓ Full weekly Timetable for every class
 *   ✓ Term 2 student attendance (~61 school days)
 *   ✓ Term 2 teacher attendance with check-in/out times
 *   ✓ Term 1 Results for Basic 1 – JHS 3
 *   ✓ Term 1 Assessments (Class Tests + Exams) per class
 *   ✓ Term 1 Assessment Scores
 *   ✓ Term 1 Term Remarks (teacher + headmaster comments)
 *   ✓ Fee Structures per class level (Term 1 & 2)
 *   ✓ Fee Payments with mixed statuses
 *   ✓ 8 School Announcements
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// ════════════════════════════════════════════════════════════════
// CREDENTIALS  (change before production!)
// ════════════════════════════════════════════════════════════════
const ADMIN_PW   = 'admin@eagles2026';
const TEACHER_PW = 'teacher@eagles';
const PARENT_PW  = 'parent@eagles';

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════

/** Deterministic pseudo-random float in [0, 1) based on integer seed */
function rand(seed) {
  return ((seed * 2654435761) >>> 0) / 4294967296;
}

/** Each student has a stable talent score [0.35 – 1.0]; skewed high for a good school */
function talent(globalIdx) {
  return 0.35 + rand(globalIdx * 9973 + 1337) * 0.65;
}

/**
 * Returns { classScore, examScore, totalScore } for a student × subject combination.
 * classScore and examScore are each out of 50 (total out of 100).
 */
function generateScores(globalIdx, subjectIdx, termIdx = 0) {
  const base = talent(globalIdx);
  const subMod = (rand(subjectIdx * 997 + globalIdx * 31 + termIdx * 7) - 0.5) * 0.18;
  const perf   = Math.max(0.2, Math.min(1.0, base + subMod));

  const cn = (rand(globalIdx * 41  + subjectIdx * 13) - 0.5) * 0.1;
  const en = (rand(globalIdx * 67  + subjectIdx * 29) - 0.5) * 0.1;

  const classScore = Math.round(Math.max(10, Math.min(50, perf * 50 + cn * 50)));
  const examScore  = Math.round(Math.max(10, Math.min(50, perf * 50 + en * 50)));
  return { classScore, examScore, totalScore: classScore + examScore };
}

function getGrade(total) {
  if (total >= 80) return 'A1';
  if (total >= 70) return 'B2';
  if (total >= 60) return 'B3';
  if (total >= 55) return 'C4';
  if (total >= 50) return 'C5';
  if (total >= 45) return 'C6';
  if (total >= 40) return 'D7';
  if (total >= 35) return 'E8';
  return 'F9';
}

function gradeRemarks(g) {
  const m = { A1:'Excellent', B2:'Very Good', B3:'Good', C4:'Credit', C5:'Credit', C6:'Credit', D7:'Pass', E8:'Pass', F9:'Fail' };
  return m[g] || 'Pass';
}

function teacherRemark(avg) {
  if (avg >= 80) return "An outstanding student who consistently excels. Keep up the excellent work!";
  if (avg >= 70) return "A hardworking and dedicated student. With continued effort, great things await!";
  if (avg >= 60) return "Shows good progress. Some topics need more attention and regular revision.";
  if (avg >= 50) return "Satisfactory performance, but must work harder to reach full potential.";
  return "Needs to improve study habits and seek extra help in areas of difficulty.";
}

function headRemark(avg) {
  if (avg >= 75) return "Commendable performance. Eagle's Nest is proud of this student!";
  if (avg >= 60) return "Good effort this term. Keep working hard and results will improve further.";
  return "We encourage this student to take studies more seriously. Parental support is vital.";
}

/** Generate Mon–Fri school days between two date strings, excluding listed holiday strings */
function schoolDays(start, end, holidays = []) {
  const days = [];
  for (let d = new Date(start); d <= new Date(end); d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const iso = d.toISOString().slice(0, 10);
    if (!holidays.includes(iso)) days.push(new Date(d));
  }
  return days;
}

const TERM1_DAYS = schoolDays('2025-09-08', '2025-12-13', ['2025-09-21','2025-10-01','2025-10-06','2025-12-25']);
const TERM2_DAYS = schoolDays('2026-01-12', '2026-04-07', ['2026-03-06','2026-04-03','2026-04-06']);

// ════════════════════════════════════════════════════════════════
// STATIC DATA
// ════════════════════════════════════════════════════════════════

const TERMS_DATA = [
  { name: 'First Term',  year: 2025, startDate: new Date('2025-09-08'), endDate: new Date('2025-12-13'), isCurrent: false },
  { name: 'Second Term', year: 2026, startDate: new Date('2026-01-12'), endDate: new Date('2026-04-11'), isCurrent: true  },
  { name: 'Third Term',  year: 2026, startDate: new Date('2026-05-05'), endDate: new Date('2026-07-25'), isCurrent: false },
];

const CLASSES_DATA = [
  { name: 'Nursery 1', level: 'NURSERY_1', section: null },
  { name: 'Nursery 2', level: 'NURSERY_2', section: null },
  { name: 'KG 1',      level: 'KG_1',      section: null },
  { name: 'KG 2',      level: 'KG_2',      section: null },
  { name: 'Class 1',   level: 'BASIC_1',   section: null },
  { name: 'Class 2',   level: 'BASIC_2',   section: null },
  { name: 'Class 3',   level: 'BASIC_3',   section: null },
  { name: 'Class 4',   level: 'BASIC_4',   section: null },
  { name: 'Class 5',   level: 'BASIC_5',   section: null },
  { name: 'Class 6',   level: 'BASIC_6',   section: null },
  { name: 'JHS 1',     level: 'JHS_1',     section: null },
  { name: 'JHS 2',     level: 'JHS_2',     section: null },
  { name: 'JHS 3',     level: 'JHS_3',     section: null },
];

const SUBJECTS_DATA = [
  { name: 'Mathematics',                        code: 'MATH' },
  { name: 'English Language',                   code: 'ENG'  },
  { name: 'Integrated Science',                 code: 'SCI'  },
  { name: 'Social Studies',                     code: 'SOC'  },
  { name: 'Religious & Moral Education',        code: 'RME'  },
  { name: 'Creative Arts & Design',             code: 'ART'  },
  { name: 'Information & Communications Tech',  code: 'ICT'  },
  { name: 'Physical Education',                 code: 'PE'   },
  { name: 'French',                             code: 'FR'   },
  { name: 'Ghanaian Language',                  code: 'GL'   },
  { name: 'Pre-Technical Skills',               code: 'PTS'  },
];

// Which subjects each class level offers
const CLASS_SUBJECTS = {
  NURSERY_1: ['ENG','MATH','GL','ART','PE'],
  NURSERY_2: ['ENG','MATH','GL','ART','PE'],
  KG_1:      ['ENG','MATH','GL','ART','PE','RME'],
  KG_2:      ['ENG','MATH','GL','ART','PE','RME'],
  BASIC_1:   ['MATH','ENG','SCI','SOC','RME','ART','ICT','FR','GL'],
  BASIC_2:   ['MATH','ENG','SCI','SOC','RME','ART','ICT','FR','GL'],
  BASIC_3:   ['MATH','ENG','SCI','SOC','RME','ART','ICT','FR','GL'],
  BASIC_4:   ['MATH','ENG','SCI','SOC','RME','ART','ICT','FR','GL'],
  BASIC_5:   ['MATH','ENG','SCI','SOC','RME','ART','ICT','FR','GL'],
  BASIC_6:   ['MATH','ENG','SCI','SOC','RME','ART','ICT','FR','GL'],
  JHS_1:     ['MATH','ENG','SCI','SOC','RME','ART','ICT','FR','GL','PTS'],
  JHS_2:     ['MATH','ENG','SCI','SOC','RME','ART','ICT','FR','GL','PTS'],
  JHS_3:     ['MATH','ENG','SCI','SOC','RME','ART','ICT','FR','GL','PTS'],
};

// ── Admin / Headmaster ────────────────────────────────────────
const ADMIN_DATA = {
  firstName: 'Emmanuel', lastName: 'Asante',
  phone: '0244100001', email: 'e.asante@eaglesnest.edu.gh',
  qualification: 'M.Ed Educational Administration', staffId: 'EN-A-001',
};

// ── Teachers (index 0–12 = class teachers for CLASSES_DATA[0–12]) ──────────
const TEACHERS_DATA = [
  { firstName: 'Grace',     lastName: 'Mensah',   phone: '0244100002', qualification: 'B.Ed Early Childhood Education',   staffId: 'GM-T-002' }, // Nursery 1
  { firstName: 'Ruth',      lastName: 'Amoah',    phone: '0244100003', qualification: 'B.Ed Early Childhood Education',   staffId: 'RA-T-003' }, // Nursery 2
  { firstName: 'Daniel',    lastName: 'Boateng',  phone: '0244100004', qualification: 'B.Ed Primary Education',           staffId: 'DB-T-004' }, // KG 1
  { firstName: 'Priscilla', lastName: 'Agyeman',  phone: '0244100005', qualification: 'B.Ed Primary Education',           staffId: 'PA-T-005' }, // KG 2
  { firstName: 'Samuel',    lastName: 'Owusu',    phone: '0244100006', qualification: 'B.Ed Primary Education',           staffId: 'SO-T-006' }, // Class 1
  { firstName: 'Abigail',   lastName: 'Asare',    phone: '0244100007', qualification: 'B.Ed Primary Education',           staffId: 'AA-T-007' }, // Class 2
  { firstName: 'Michael',   lastName: 'Adjei',    phone: '0244100008', qualification: 'B.Ed Primary Education',           staffId: 'MA-T-008' }, // Class 3
  { firstName: 'Esther',    lastName: 'Frimpong', phone: '0244100009', qualification: 'B.Ed Mathematics',                 staffId: 'EF-T-009' }, // Class 4
  { firstName: 'Kwabena',   lastName: 'Darko',    phone: '0244100010', qualification: 'B.Ed Mathematics & Science',       staffId: 'KD-T-010' }, // Class 5
  { firstName: 'Josephine', lastName: 'Osei',     phone: '0244100011', qualification: 'B.A English Language',             staffId: 'JO-T-011' }, // Class 6
  { firstName: 'Felix',     lastName: 'Antwi',    phone: '0244100012', qualification: 'B.Sc Integrated Science',          staffId: 'FA-T-012' }, // JHS 1
  { firstName: 'Vivian',    lastName: 'Asante',   phone: '0244100013', qualification: 'B.A Geography & English',          staffId: 'VA-T-013' }, // JHS 2
  { firstName: 'Patrick',   lastName: 'Nyarko',   phone: '0244100014', qualification: 'B.Sc Mathematics',                 staffId: 'PN-T-014' }, // JHS 3
  { firstName: 'Comfort',   lastName: 'Appiah',   phone: '0244100015', qualification: 'B.A French & Linguistics',         staffId: 'CA-T-015' }, // French/RME specialist
  { firstName: 'Benjamin',  lastName: 'Tetteh',   phone: '0244100016', qualification: 'B.Sc Computer Science',            staffId: 'BT-T-016' }, // ICT/PE specialist
];

/**
 * subject-teacher assignments per class level.
 * Each entry: { classLevel, subjectCode, teacherStaffId }
 */
const SUBJECT_TEACHER_MAP = [
  // ── Nursery 1 (Grace) ──
  ...['ENG','MATH','GL','ART','PE'].map(c => ({ classLevel:'NURSERY_1', subjectCode:c, staffId:'GM-T-002' })),
  // ── Nursery 2 (Ruth) ──
  ...['ENG','MATH','GL','ART','PE'].map(c => ({ classLevel:'NURSERY_2', subjectCode:c, staffId:'RA-T-003' })),
  // ── KG 1 (Daniel) ──
  ...['ENG','MATH','GL','ART','PE','RME'].map(c => ({ classLevel:'KG_1', subjectCode:c, staffId:'DB-T-004' })),
  // ── KG 2 (Priscilla) ──
  ...['ENG','MATH','GL','ART','PE','RME'].map(c => ({ classLevel:'KG_2', subjectCode:c, staffId:'PA-T-005' })),
  // ── Class 1 (Samuel + specialists) ──
  ...['MATH','ENG','SCI','SOC','RME','GL','ART'].map(c => ({ classLevel:'BASIC_1', subjectCode:c, staffId:'SO-T-006' })),
  { classLevel:'BASIC_1', subjectCode:'FR',  staffId:'CA-T-015' },
  { classLevel:'BASIC_1', subjectCode:'ICT', staffId:'BT-T-016' },
  // ── Class 2 (Abigail + specialists) ──
  ...['MATH','ENG','SCI','SOC','RME','GL','ART'].map(c => ({ classLevel:'BASIC_2', subjectCode:c, staffId:'AA-T-007' })),
  { classLevel:'BASIC_2', subjectCode:'FR',  staffId:'CA-T-015' },
  { classLevel:'BASIC_2', subjectCode:'ICT', staffId:'BT-T-016' },
  // ── Class 3 (Michael + specialists) ──
  ...['MATH','ENG','SCI','SOC','RME','GL','ART'].map(c => ({ classLevel:'BASIC_3', subjectCode:c, staffId:'MA-T-008' })),
  { classLevel:'BASIC_3', subjectCode:'FR',  staffId:'CA-T-015' },
  { classLevel:'BASIC_3', subjectCode:'ICT', staffId:'BT-T-016' },
  // ── Class 4 (Esther + Josephine + specialists) ──
  ...['MATH','SCI','GL','ART'].map(c => ({ classLevel:'BASIC_4', subjectCode:c, staffId:'EF-T-009' })),
  ...['ENG','SOC','RME'].map(c => ({ classLevel:'BASIC_4', subjectCode:c, staffId:'JO-T-011' })),
  { classLevel:'BASIC_4', subjectCode:'FR',  staffId:'CA-T-015' },
  { classLevel:'BASIC_4', subjectCode:'ICT', staffId:'BT-T-016' },
  // ── Class 5 (Kwabena + Josephine + specialists) ──
  ...['MATH','SCI','GL','ART'].map(c => ({ classLevel:'BASIC_5', subjectCode:c, staffId:'KD-T-010' })),
  ...['ENG','SOC','RME'].map(c => ({ classLevel:'BASIC_5', subjectCode:c, staffId:'JO-T-011' })),
  { classLevel:'BASIC_5', subjectCode:'FR',  staffId:'CA-T-015' },
  { classLevel:'BASIC_5', subjectCode:'ICT', staffId:'BT-T-016' },
  // ── Class 6 (Josephine + Kwabena + specialists) ──
  ...['ENG','SOC','RME','GL','ART'].map(c => ({ classLevel:'BASIC_6', subjectCode:c, staffId:'JO-T-011' })),
  ...['MATH','SCI'].map(c => ({ classLevel:'BASIC_6', subjectCode:c, staffId:'KD-T-010' })),
  { classLevel:'BASIC_6', subjectCode:'FR',  staffId:'CA-T-015' },
  { classLevel:'BASIC_6', subjectCode:'ICT', staffId:'BT-T-016' },
  // ── JHS 1 (Felix class teacher + specialists) ──
  ...['ENG','GL','PTS'].map(c => ({ classLevel:'JHS_1', subjectCode:c, staffId:'FA-T-012' })),
  { classLevel:'JHS_1', subjectCode:'MATH', staffId:'PN-T-014' },
  { classLevel:'JHS_1', subjectCode:'SCI',  staffId:'FA-T-012' },
  { classLevel:'JHS_1', subjectCode:'SOC',  staffId:'VA-T-013' },
  { classLevel:'JHS_1', subjectCode:'ART',  staffId:'BT-T-016' },
  { classLevel:'JHS_1', subjectCode:'ICT',  staffId:'BT-T-016' },
  { classLevel:'JHS_1', subjectCode:'FR',   staffId:'CA-T-015' },
  { classLevel:'JHS_1', subjectCode:'RME',  staffId:'CA-T-015' },
  // ── JHS 2 (Vivian class teacher + specialists) ──
  ...['ENG','SOC','GL','PTS'].map(c => ({ classLevel:'JHS_2', subjectCode:c, staffId:'VA-T-013' })),
  { classLevel:'JHS_2', subjectCode:'MATH', staffId:'PN-T-014' },
  { classLevel:'JHS_2', subjectCode:'SCI',  staffId:'FA-T-012' },
  { classLevel:'JHS_2', subjectCode:'ART',  staffId:'BT-T-016' },
  { classLevel:'JHS_2', subjectCode:'ICT',  staffId:'BT-T-016' },
  { classLevel:'JHS_2', subjectCode:'FR',   staffId:'CA-T-015' },
  { classLevel:'JHS_2', subjectCode:'RME',  staffId:'CA-T-015' },
  // ── JHS 3 (Patrick class teacher + specialists) ──
  ...['MATH','ENG','PTS'].map(c => ({ classLevel:'JHS_3', subjectCode:c, staffId:'PN-T-014' })),
  { classLevel:'JHS_3', subjectCode:'SCI',  staffId:'FA-T-012' },
  { classLevel:'JHS_3', subjectCode:'SOC',  staffId:'VA-T-013' },
  { classLevel:'JHS_3', subjectCode:'GL',   staffId:'VA-T-013' },
  { classLevel:'JHS_3', subjectCode:'ART',  staffId:'BT-T-016' },
  { classLevel:'JHS_3', subjectCode:'ICT',  staffId:'BT-T-016' },
  { classLevel:'JHS_3', subjectCode:'FR',   staffId:'CA-T-015' },
  { classLevel:'JHS_3', subjectCode:'RME',  staffId:'CA-T-015' },
];

// ── Students by class ─────────────────────────────────────────
const STUDENTS_BY_CLASS = {
  'Nursery 1': [
    { firstName:'Nana',      lastName:'Acheampong', gender:'MALE',   dob:'2022-03-15', address:'East Legon, Accra',           parentName:'Mr. Kofi Acheampong',   parentPhone:'0201001001' },
    { firstName:'Akua',      lastName:'Mensah',     gender:'FEMALE', dob:'2022-05-20', address:'Haatso, Accra',               parentName:'Mrs. Ama Mensah',        parentPhone:'0201001002' },
    { firstName:'Bright',    lastName:'Boateng',    gender:'MALE',   dob:'2021-11-08', address:'Adenta, Accra',               parentName:'Mr. Yaw Boateng',        parentPhone:'0201001003' },
    { firstName:'Ama',       lastName:'Asante',     gender:'FEMALE', dob:'2022-01-30', address:'Spintex Road, Accra',         parentName:'Dr. Emmanuel Asante',    parentPhone:'0201001004' },
    { firstName:'Yaw',       lastName:'Frimpong',   gender:'MALE',   dob:'2021-09-12', address:'Dome, Accra',                 parentName:'Mr. Samuel Frimpong',    parentPhone:'0201001005' },
    { firstName:'Akosua',    lastName:'Owusu',      gender:'FEMALE', dob:'2022-07-04', address:'Madina, Accra',               parentName:'Mrs. Efua Owusu',        parentPhone:'0201001006' },
    { firstName:'Emmanuel',  lastName:'Darko',      gender:'MALE',   dob:'2021-12-25', address:'Lapaz, Accra',                parentName:'Mr. Kwame Darko',        parentPhone:'0201001007' },
    { firstName:'Efua',      lastName:'Antwi',      gender:'FEMALE', dob:'2022-04-18', address:'Achimota, Accra',             parentName:'Mrs. Abena Antwi',       parentPhone:'0201001008' },
    { firstName:'Kofi',      lastName:'Appiah',     gender:'MALE',   dob:'2021-08-22', address:'Tema Community 5',            parentName:'Mr. Kojo Appiah',        parentPhone:'0201001009' },
    { firstName:'Adwoa',     lastName:'Tetteh',     gender:'FEMALE', dob:'2022-02-14', address:'East Legon, Accra',           parentName:'Mrs. Akosua Tetteh',     parentPhone:'0201001010' },
    { firstName:'Kwame',     lastName:'Amoah',      gender:'MALE',   dob:'2022-06-10', address:'Tesano, Accra',               parentName:'Mr. Daniel Amoah',       parentPhone:'0201001011' },
    { firstName:'Abena',     lastName:'Nyarko',     gender:'FEMALE', dob:'2021-10-05', address:'Airport Residential, Accra',  parentName:'Mrs. Yaa Nyarko',        parentPhone:'0201001012' },
    { firstName:'Samuel',    lastName:'Osei',       gender:'MALE',   dob:'2022-08-28', address:'Spintex Road, Accra',         parentName:'Mr. Kweku Osei',         parentPhone:'0201001013' },
    { firstName:'Afua',      lastName:'Adjei',      gender:'FEMALE', dob:'2021-07-15', address:'Dome, Accra',                 parentName:'Mr. Eric Adjei',         parentPhone:'0201001014' },
  ],
  'Nursery 2': [
    { firstName:'Kweku',     lastName:'Asare',      gender:'MALE',   dob:'2020-11-20', address:'East Legon, Accra',           parentName:'Mr. Yaw Asare',          parentPhone:'0201001015' },
    { firstName:'Yaa',       lastName:'Mensah',     gender:'FEMALE', dob:'2021-02-08', address:'Haatso, Accra',               parentName:'Mrs. Akua Mensah',       parentPhone:'0201001016' },
    { firstName:'Prince',    lastName:'Boateng',    gender:'MALE',   dob:'2020-09-15', address:'Adenta, Accra',               parentName:'Mr. Yaw Boateng',        parentPhone:'0201001003' }, // sibling of Bright
    { firstName:'Afia',      lastName:'Asante',     gender:'FEMALE', dob:'2021-04-22', address:'Spintex Road, Accra',         parentName:'Dr. Emmanuel Asante',    parentPhone:'0201001004' }, // sibling
    { firstName:'Kojo',      lastName:'Frimpong',   gender:'MALE',   dob:'2020-07-30', address:'Dome, Accra',                 parentName:'Mr. Samuel Frimpong',    parentPhone:'0201001005' }, // sibling
    { firstName:'Maame',     lastName:'Owusu',      gender:'FEMALE', dob:'2021-01-10', address:'Madina, Accra',               parentName:'Mrs. Efua Owusu',        parentPhone:'0201001006' }, // sibling
    { firstName:'Justice',   lastName:'Darko',      gender:'MALE',   dob:'2020-12-18', address:'Lapaz, Accra',                parentName:'Mr. Kwame Darko',        parentPhone:'0201001007' }, // sibling
    { firstName:'Nhyira',    lastName:'Antwi',      gender:'FEMALE', dob:'2021-03-25', address:'Achimota, Accra',             parentName:'Mrs. Abena Antwi',       parentPhone:'0201001008' }, // sibling
    { firstName:'Kwabena',   lastName:'Appiah',     gender:'MALE',   dob:'2020-08-05', address:'Tema Community 12',           parentName:'Mr. Kojo Appiah',        parentPhone:'0201001009' }, // sibling
    { firstName:'Akua',      lastName:'Tetteh',     gender:'FEMALE', dob:'2021-06-14', address:'East Legon, Accra',           parentName:'Mrs. Akosua Tetteh',     parentPhone:'0201001010' }, // sibling
    { firstName:'Kelvin',    lastName:'Amoah',      gender:'MALE',   dob:'2020-10-28', address:'Tesano, Accra',               parentName:'Mr. Daniel Amoah',       parentPhone:'0201001011' }, // sibling
    { firstName:'Serwa',     lastName:'Nyarko',     gender:'FEMALE', dob:'2020-05-30', address:'Airport Residential, Accra',  parentName:'Mrs. Yaa Nyarko',        parentPhone:'0201001012' }, // sibling
    { firstName:'Isaac',     lastName:'Osei',       gender:'MALE',   dob:'2021-08-02', address:'Spintex Road, Accra',         parentName:'Mr. Kweku Osei',         parentPhone:'0201001013' }, // sibling
    { firstName:'Ama',       lastName:'Adjei',      gender:'FEMALE', dob:'2020-06-20', address:'Dome, Accra',                 parentName:'Mr. Eric Adjei',         parentPhone:'0201001014' }, // sibling
  ],
  'KG 1': [
    { firstName:'Daniel',    lastName:'Acheampong', gender:'MALE',   dob:'2019-09-15', address:'East Legon, Accra',           parentName:'Mrs. Abena Acheampong',  parentPhone:'0201001017' },
    { firstName:'Akosua',    lastName:'Mensah',     gender:'FEMALE', dob:'2019-11-28', address:'Haatso, Accra',               parentName:'Mr. Kwesi Mensah',       parentPhone:'0201001018' },
    { firstName:'Marcus',    lastName:'Boateng',    gender:'MALE',   dob:'2020-02-10', address:'Adenta, Accra',               parentName:'Mrs. Esi Boateng',       parentPhone:'0201001019' },
    { firstName:'Adwoa',     lastName:'Asante',     gender:'FEMALE', dob:'2019-07-05', address:'Spintex Road, Accra',         parentName:'Mr. Kwadwo Asante',      parentPhone:'0201001020' },
    { firstName:'Kwesi',     lastName:'Frimpong',   gender:'MALE',   dob:'2020-01-20', address:'Dome, Accra',                 parentName:'Mrs. Adwoa Frimpong',    parentPhone:'0201001021' },
    { firstName:'Serwaa',    lastName:'Owusu',      gender:'FEMALE', dob:'2019-10-12', address:'Madina, Accra',               parentName:'Mr. Kofi Owusu',         parentPhone:'0201001022' },
    { firstName:'Nathan',    lastName:'Darko',      gender:'MALE',   dob:'2019-08-30', address:'Lapaz, Accra',                parentName:'Mrs. Akua Darko',        parentPhone:'0201001023' },
    { firstName:'Abena',     lastName:'Antwi',      gender:'FEMALE', dob:'2020-03-18', address:'Achimota, Accra',             parentName:'Mr. Felix Antwi',        parentPhone:'0201001024' },
    { firstName:'Joshua',    lastName:'Appiah',     gender:'MALE',   dob:'2019-06-25', address:'Tema Community 7',            parentName:'Mrs. Comfort Appiah',    parentPhone:'0201001025' },
    { firstName:'Afua',      lastName:'Tetteh',     gender:'FEMALE', dob:'2019-12-08', address:'East Legon, Accra',           parentName:'Mr. Benjamin Tetteh',    parentPhone:'0201001026' },
    { firstName:'Yaw',       lastName:'Amoah',      gender:'MALE',   dob:'2020-04-15', address:'Tesano, Accra',               parentName:'Mrs. Grace Amoah',       parentPhone:'0201001027' },
    { firstName:'Ama',       lastName:'Nyarko',     gender:'FEMALE', dob:'2019-05-22', address:'Airport Residential, Accra',  parentName:'Mr. Patrick Nyarko',     parentPhone:'0201001028' },
    { firstName:'Benjamin',  lastName:'Osei',       gender:'MALE',   dob:'2019-04-01', address:'Spintex Road, Accra',         parentName:'Mrs. Josephine Osei',    parentPhone:'0201001029' },
    { firstName:'Maame',     lastName:'Adjei',      gender:'FEMALE', dob:'2020-05-10', address:'Dome, Accra',                 parentName:'Mr. Michael Adjei',      parentPhone:'0201001030' },
    { firstName:'Elijah',    lastName:'Asamoah',    gender:'MALE',   dob:'2019-03-14', address:'Kasoa, Central Region',       parentName:'Mrs. Priscilla Asamoah', parentPhone:'0201001031' },
    { firstName:'Akua',      lastName:'Prempeh',    gender:'FEMALE', dob:'2020-06-30', address:'Haatso, Accra',               parentName:'Mr. Samuel Prempeh',     parentPhone:'0201001032' },
  ],
  'KG 2': [
    { firstName:'David',     lastName:'Acheampong', gender:'MALE',   dob:'2018-09-20', address:'East Legon, Accra',           parentName:'Mrs. Abena Acheampong',  parentPhone:'0201001017' }, // sibling of Daniel
    { firstName:'Efua',      lastName:'Mensah',     gender:'FEMALE', dob:'2018-11-14', address:'Haatso, Accra',               parentName:'Mr. Kwesi Mensah',       parentPhone:'0201001018' }, // sibling
    { firstName:'Emmanuel',  lastName:'Boateng',    gender:'MALE',   dob:'2019-01-08', address:'Adenta, Accra',               parentName:'Mrs. Esi Boateng',       parentPhone:'0201001019' }, // sibling
    { firstName:'Nhyira',    lastName:'Asante',     gender:'FEMALE', dob:'2018-07-25', address:'Spintex Road, Accra',         parentName:'Mr. Kwadwo Asante',      parentPhone:'0201001020' }, // sibling
    { firstName:'Kofi',      lastName:'Frimpong',   gender:'MALE',   dob:'2018-12-30', address:'Dome, Accra',                 parentName:'Mrs. Adwoa Frimpong',    parentPhone:'0201001021' }, // sibling
    { firstName:'Abena',     lastName:'Owusu',      gender:'FEMALE', dob:'2018-10-05', address:'Madina, Accra',               parentName:'Mr. Kofi Owusu',         parentPhone:'0201001022' }, // sibling
    { firstName:'Eric',      lastName:'Darko',      gender:'MALE',   dob:'2019-03-22', address:'Lapaz, Accra',                parentName:'Mrs. Akua Darko',        parentPhone:'0201001023' }, // sibling
    { firstName:'Adwoa',     lastName:'Antwi',      gender:'FEMALE', dob:'2018-06-18', address:'Achimota, Accra',             parentName:'Mr. Felix Antwi',        parentPhone:'0201001024' }, // sibling
    { firstName:'Paul',      lastName:'Appiah',     gender:'MALE',   dob:'2019-02-12', address:'Tema Community 9',            parentName:'Mrs. Comfort Appiah',    parentPhone:'0201001025' }, // sibling
    { firstName:'Akosua',    lastName:'Tetteh',     gender:'FEMALE', dob:'2018-08-28', address:'East Legon, Accra',           parentName:'Mr. Benjamin Tetteh',    parentPhone:'0201001026' }, // sibling
    { firstName:'Kwame',     lastName:'Amoah',      gender:'MALE',   dob:'2018-05-15', address:'Tesano, Accra',               parentName:'Mrs. Grace Amoah',       parentPhone:'0201001027' }, // sibling
    { firstName:'Yaa',       lastName:'Nyarko',     gender:'FEMALE', dob:'2019-04-10', address:'Airport Residential, Accra',  parentName:'Mr. Patrick Nyarko',     parentPhone:'0201001028' }, // sibling
    { firstName:'Stephen',   lastName:'Osei',       gender:'MALE',   dob:'2018-03-05', address:'Spintex Road, Accra',         parentName:'Mrs. Josephine Osei',    parentPhone:'0201001029' }, // sibling
    { firstName:'Afua',      lastName:'Adjei',      gender:'FEMALE', dob:'2019-05-20', address:'Dome, Accra',                 parentName:'Mr. Michael Adjei',      parentPhone:'0201001030' }, // sibling
    { firstName:'Daniel',    lastName:'Kumi',       gender:'MALE',   dob:'2018-02-28', address:'Kasoa, Central Region',       parentName:'Mr. Joseph Kumi',        parentPhone:'0201001033' },
    { firstName:'Ama',       lastName:'Bediako',    gender:'FEMALE', dob:'2018-04-15', address:'Haatso, Accra',               parentName:'Mrs. Serwa Bediako',     parentPhone:'0201001034' },
  ],
  'Class 1': [
    { firstName:'Andrews',   lastName:'Mensah',     gender:'MALE',   dob:'2017-08-15', address:'East Legon, Accra',           parentName:'Mr. Kwadwo Mensah',      parentPhone:'0201001035' },
    { firstName:'Akua',      lastName:'Boateng',    gender:'FEMALE', dob:'2017-10-22', address:'Haatso, Accra',               parentName:'Mrs. Ama Boateng',       parentPhone:'0201001036' },
    { firstName:'Kwadwo',    lastName:'Asante',     gender:'MALE',   dob:'2018-01-05', address:'Adenta, Accra',               parentName:'Mr. Yaw Asante',         parentPhone:'0201001037' },
    { firstName:'Serwa',     lastName:'Frimpong',   gender:'FEMALE', dob:'2017-06-30', address:'Spintex Road, Accra',         parentName:'Mrs. Efua Frimpong',     parentPhone:'0201001038' },
    { firstName:'Prince',    lastName:'Owusu',      gender:'MALE',   dob:'2017-11-18', address:'Dome, Accra',                 parentName:'Mr. Daniel Owusu',       parentPhone:'0201001039' },
    { firstName:'Yaa',       lastName:'Darko',      gender:'FEMALE', dob:'2018-03-12', address:'Madina, Accra',               parentName:'Mrs. Abena Darko',       parentPhone:'0201001040' },
    { firstName:'Kojo',      lastName:'Antwi',      gender:'MALE',   dob:'2017-09-25', address:'Lapaz, Accra',                parentName:'Mr. Eric Antwi',         parentPhone:'0201001041' },
    { firstName:'Ama',       lastName:'Appiah',     gender:'FEMALE', dob:'2018-02-08', address:'Achimota, Accra',             parentName:'Mrs. Ruth Appiah',       parentPhone:'0201001042' },
    { firstName:'Isaac',     lastName:'Tetteh',     gender:'MALE',   dob:'2017-07-20', address:'Tema Community 3',            parentName:'Mr. Samuel Tetteh',      parentPhone:'0201001043' },
    { firstName:'Adwoa',     lastName:'Amoah',      gender:'FEMALE', dob:'2017-12-28', address:'East Legon, Accra',           parentName:'Mr. Kwabena Amoah',      parentPhone:'0201001044' },
    { firstName:'Kwabena',   lastName:'Nyarko',     gender:'MALE',   dob:'2018-04-15', address:'Tesano, Accra',               parentName:'Mrs. Akosua Nyarko',     parentPhone:'0201001045' },
    { firstName:'Efua',      lastName:'Osei',       gender:'FEMALE', dob:'2017-05-10', address:'Airport Residential, Accra',  parentName:'Dr. Kofi Osei',          parentPhone:'0201001046' },
    { firstName:'Emmanuel',  lastName:'Adjei',      gender:'MALE',   dob:'2017-03-02', address:'Spintex Road, Accra',         parentName:'Mrs. Adwoa Adjei',       parentPhone:'0201001047' },
    { firstName:'Akosua',    lastName:'Acheampong', gender:'FEMALE', dob:'2018-05-25', address:'Dome, Accra',                 parentName:'Mr. Francis Acheampong', parentPhone:'0201001048' },
    { firstName:'Bright',    lastName:'Kumi',       gender:'MALE',   dob:'2017-02-18', address:'Kasoa, Central Region',       parentName:'Mr. Joseph Kumi',        parentPhone:'0201001033' }, // sibling
    { firstName:'Abena',     lastName:'Bediako',    gender:'FEMALE', dob:'2017-04-05', address:'Haatso, Accra',               parentName:'Mrs. Serwa Bediako',     parentPhone:'0201001034' }, // sibling
    { firstName:'Michael',   lastName:'Prempeh',    gender:'MALE',   dob:'2018-06-12', address:'East Legon, Accra',           parentName:'Mrs. Akua Prempeh',      parentPhone:'0201001049' },
    { firstName:'Nhyira',    lastName:'Laryea',     gender:'FEMALE', dob:'2017-01-20', address:'Labadi, Accra',               parentName:'Mr. Kweku Laryea',       parentPhone:'0201001050' },
    { firstName:'George',    lastName:'Asamoah',    gender:'MALE',   dob:'2017-08-08', address:'Tema, Greater Accra',         parentName:'Mrs. Grace Asamoah',     parentPhone:'0201001051' },
    { firstName:'Maame',     lastName:'Opoku',      gender:'FEMALE', dob:'2018-07-30', address:'Adenta, Accra',               parentName:'Mr. Kwame Opoku',        parentPhone:'0201001052' },
  ],
  'Class 2': [
    { firstName:'Kweku',     lastName:'Mensah',     gender:'MALE',   dob:'2016-08-10', address:'East Legon, Accra',           parentName:'Mr. Kwadwo Mensah',      parentPhone:'0201001035' }, // sibling
    { firstName:'Ama',       lastName:'Boateng',    gender:'FEMALE', dob:'2016-10-15', address:'Haatso, Accra',               parentName:'Mrs. Ama Boateng',       parentPhone:'0201001036' }, // sibling
    { firstName:'Kofi',      lastName:'Asante',     gender:'MALE',   dob:'2017-01-22', address:'Adenta, Accra',               parentName:'Mr. Yaw Asante',         parentPhone:'0201001037' }, // sibling
    { firstName:'Adwoa',     lastName:'Frimpong',   gender:'FEMALE', dob:'2016-06-12', address:'Spintex Road, Accra',         parentName:'Mrs. Efua Frimpong',     parentPhone:'0201001038' }, // sibling
    { firstName:'Yaw',       lastName:'Owusu',      gender:'MALE',   dob:'2016-11-28', address:'Dome, Accra',                 parentName:'Mr. Daniel Owusu',       parentPhone:'0201001039' }, // sibling
    { firstName:'Akosua',    lastName:'Darko',      gender:'FEMALE', dob:'2017-03-05', address:'Madina, Accra',               parentName:'Mrs. Abena Darko',       parentPhone:'0201001040' }, // sibling
    { firstName:'Kwesi',     lastName:'Antwi',      gender:'MALE',   dob:'2016-09-18', address:'Lapaz, Accra',                parentName:'Mr. Eric Antwi',         parentPhone:'0201001041' }, // sibling
    { firstName:'Abena',     lastName:'Appiah',     gender:'FEMALE', dob:'2017-02-20', address:'Achimota, Accra',             parentName:'Mrs. Ruth Appiah',       parentPhone:'0201001042' }, // sibling
    { firstName:'Samuel',    lastName:'Tetteh',     gender:'MALE',   dob:'2016-07-08', address:'Tema Community 6',            parentName:'Mr. Samuel Tetteh',      parentPhone:'0201001043' }, // sibling
    { firstName:'Efua',      lastName:'Amoah',      gender:'FEMALE', dob:'2016-12-10', address:'East Legon, Accra',           parentName:'Mr. Kwabena Amoah',      parentPhone:'0201001044' }, // sibling
    { firstName:'Daniel',    lastName:'Nyarko',     gender:'MALE',   dob:'2017-04-25', address:'Tesano, Accra',               parentName:'Mrs. Akosua Nyarko',     parentPhone:'0201001045' }, // sibling
    { firstName:'Yaa',       lastName:'Osei',       gender:'FEMALE', dob:'2016-05-30', address:'Airport Residential, Accra',  parentName:'Dr. Kofi Osei',          parentPhone:'0201001046' }, // sibling
    { firstName:'Justice',   lastName:'Adjei',      gender:'MALE',   dob:'2016-03-15', address:'Spintex Road, Accra',         parentName:'Mrs. Adwoa Adjei',       parentPhone:'0201001047' }, // sibling
    { firstName:'Akua',      lastName:'Acheampong', gender:'FEMALE', dob:'2017-05-18', address:'Dome, Accra',                 parentName:'Mr. Francis Acheampong', parentPhone:'0201001048' }, // sibling
    { firstName:'Paul',      lastName:'Kumi',       gender:'MALE',   dob:'2016-02-05', address:'Kasoa, Central Region',       parentName:'Mr. Joseph Kumi',        parentPhone:'0201001033' }, // sibling
    { firstName:'Maame',     lastName:'Bediako',    gender:'FEMALE', dob:'2016-04-22', address:'Haatso, Accra',               parentName:'Mrs. Serwa Bediako',     parentPhone:'0201001034' }, // sibling
    { firstName:'Eric',      lastName:'Prempeh',    gender:'MALE',   dob:'2017-06-08', address:'East Legon, Accra',           parentName:'Mrs. Akua Prempeh',      parentPhone:'0201001049' }, // sibling
    { firstName:'Serwa',     lastName:'Laryea',     gender:'FEMALE', dob:'2016-01-30', address:'Labadi, Accra',               parentName:'Mr. Kweku Laryea',       parentPhone:'0201001050' }, // sibling
    { firstName:'Nathan',    lastName:'Asamoah',    gender:'MALE',   dob:'2016-09-05', address:'Tema, Greater Accra',         parentName:'Mrs. Grace Asamoah',     parentPhone:'0201001051' }, // sibling
    { firstName:'Nhyira',    lastName:'Opoku',      gender:'FEMALE', dob:'2017-07-15', address:'Adenta, Accra',               parentName:'Mr. Kwame Opoku',        parentPhone:'0201001052' }, // sibling
  ],
  'Class 3': [
    { firstName:'Kwadwo',    lastName:'Mensah',     gender:'MALE',   dob:'2015-08-05', address:'East Legon, Accra',           parentName:'Mr. Kwadwo Mensah',      parentPhone:'0201001035' }, // sibling
    { firstName:'Akua',      lastName:'Boateng',    gender:'FEMALE', dob:'2015-10-18', address:'Haatso, Accra',               parentName:'Mrs. Ama Boateng',       parentPhone:'0201001036' }, // sibling
    { firstName:'Kofi',      lastName:'Asante',     gender:'MALE',   dob:'2016-02-12', address:'Adenta, Accra',               parentName:'Mr. Yaw Asante',         parentPhone:'0201001037' }, // sibling
    { firstName:'Ama',       lastName:'Frimpong',   gender:'FEMALE', dob:'2015-06-25', address:'Spintex Road, Accra',         parentName:'Mrs. Efua Frimpong',     parentPhone:'0201001038' }, // sibling
    { firstName:'Kwabena',   lastName:'Owusu',      gender:'MALE',   dob:'2015-11-10', address:'Dome, Accra',                 parentName:'Mr. Daniel Owusu',       parentPhone:'0201001039' }, // sibling
    { firstName:'Adwoa',     lastName:'Darko',      gender:'FEMALE', dob:'2016-03-28', address:'Madina, Accra',               parentName:'Mrs. Abena Darko',       parentPhone:'0201001040' }, // sibling
    { firstName:'Kojo',      lastName:'Antwi',      gender:'MALE',   dob:'2015-09-14', address:'Lapaz, Accra',                parentName:'Mr. Eric Antwi',         parentPhone:'0201001041' }, // sibling
    { firstName:'Yaa',       lastName:'Appiah',     gender:'FEMALE', dob:'2016-01-20', address:'Achimota, Accra',             parentName:'Mrs. Ruth Appiah',       parentPhone:'0201001042' }, // sibling
    { firstName:'Stephen',   lastName:'Tetteh',     gender:'MALE',   dob:'2015-07-30', address:'Tema Community 8',            parentName:'Mr. Samuel Tetteh',      parentPhone:'0201001043' }, // sibling
    { firstName:'Abena',     lastName:'Amoah',      gender:'FEMALE', dob:'2015-12-15', address:'East Legon, Accra',           parentName:'Mr. Kwabena Amoah',      parentPhone:'0201001044' }, // sibling
    { firstName:'Emmanuel',  lastName:'Nyarko',     gender:'MALE',   dob:'2016-04-05', address:'Tesano, Accra',               parentName:'Mrs. Akosua Nyarko',     parentPhone:'0201001045' }, // sibling
    { firstName:'Efua',      lastName:'Osei',       gender:'FEMALE', dob:'2015-05-20', address:'Airport Residential, Accra',  parentName:'Dr. Kofi Osei',          parentPhone:'0201001046' }, // sibling
    { firstName:'Joshua',    lastName:'Adjei',      gender:'MALE',   dob:'2015-03-08', address:'Spintex Road, Accra',         parentName:'Mrs. Adwoa Adjei',       parentPhone:'0201001047' }, // sibling
    { firstName:'Akosua',    lastName:'Acheampong', gender:'FEMALE', dob:'2016-05-25', address:'Dome, Accra',                 parentName:'Mr. Francis Acheampong', parentPhone:'0201001048' }, // sibling
    { firstName:'Michael',   lastName:'Kumi',       gender:'MALE',   dob:'2015-02-15', address:'Kasoa, Central Region',       parentName:'Mr. Joseph Kumi',        parentPhone:'0201001033' }, // sibling
    { firstName:'Serwa',     lastName:'Bediako',    gender:'FEMALE', dob:'2015-04-10', address:'Haatso, Accra',               parentName:'Mrs. Serwa Bediako',     parentPhone:'0201001034' }, // sibling
    { firstName:'David',     lastName:'Prempeh',    gender:'MALE',   dob:'2016-06-18', address:'East Legon, Accra',           parentName:'Mrs. Akua Prempeh',      parentPhone:'0201001049' }, // sibling
    { firstName:'Nhyira',    lastName:'Laryea',     gender:'FEMALE', dob:'2015-01-25', address:'Labadi, Accra',               parentName:'Mr. Kweku Laryea',       parentPhone:'0201001050' }, // sibling
    { firstName:'Andrews',   lastName:'Asamoah',    gender:'MALE',   dob:'2015-08-22', address:'Tema, Greater Accra',         parentName:'Mrs. Grace Asamoah',     parentPhone:'0201001051' }, // sibling
    { firstName:'Maame',     lastName:'Opoku',      gender:'FEMALE', dob:'2016-07-30', address:'Adenta, Accra',               parentName:'Mr. Kwame Opoku',        parentPhone:'0201001052' }, // sibling
  ],
  'Class 4': [
    { firstName:'Kweku',     lastName:'Mensah',     gender:'MALE',   dob:'2014-09-12', address:'East Legon, Accra',           parentName:'Mr. Kwadwo Mensah',      parentPhone:'0201001035' },
    { firstName:'Akosua',    lastName:'Boateng',    gender:'FEMALE', dob:'2014-11-25', address:'Haatso, Accra',               parentName:'Mrs. Ama Boateng',       parentPhone:'0201001036' },
    { firstName:'Yaw',       lastName:'Asante',     gender:'MALE',   dob:'2015-02-18', address:'Adenta, Accra',               parentName:'Mr. Yaw Asante',         parentPhone:'0201001037' },
    { firstName:'Afia',      lastName:'Frimpong',   gender:'FEMALE', dob:'2014-07-08', address:'Spintex Road, Accra',         parentName:'Mrs. Efua Frimpong',     parentPhone:'0201001038' },
    { firstName:'Kofi',      lastName:'Owusu',      gender:'MALE',   dob:'2014-12-20', address:'Dome, Accra',                 parentName:'Mr. Daniel Owusu',       parentPhone:'0201001039' },
    { firstName:'Adwoa',     lastName:'Darko',      gender:'FEMALE', dob:'2015-04-15', address:'Madina, Accra',               parentName:'Mrs. Abena Darko',       parentPhone:'0201001040' },
    { firstName:'Kwadwo',    lastName:'Antwi',      gender:'MALE',   dob:'2014-10-05', address:'Lapaz, Accra',                parentName:'Mr. Eric Antwi',         parentPhone:'0201001041' },
    { firstName:'Ama',       lastName:'Appiah',     gender:'FEMALE', dob:'2015-01-28', address:'Achimota, Accra',             parentName:'Mrs. Ruth Appiah',       parentPhone:'0201001042' },
    { firstName:'Justice',   lastName:'Tetteh',     gender:'MALE',   dob:'2014-08-15', address:'Tema Community 2',            parentName:'Mr. Samuel Tetteh',      parentPhone:'0201001043' },
    { firstName:'Abena',     lastName:'Amoah',      gender:'FEMALE', dob:'2015-01-05', address:'East Legon, Accra',           parentName:'Mr. Kwabena Amoah',      parentPhone:'0201001044' },
    { firstName:'Kwabena',   lastName:'Nyarko',     gender:'MALE',   dob:'2015-05-20', address:'Tesano, Accra',               parentName:'Mrs. Akosua Nyarko',     parentPhone:'0201001045' },
    { firstName:'Serwa',     lastName:'Osei',       gender:'FEMALE', dob:'2014-06-10', address:'Airport Residential, Accra',  parentName:'Dr. Kofi Osei',          parentPhone:'0201001046' },
    { firstName:'Eric',      lastName:'Adjei',      gender:'MALE',   dob:'2014-04-02', address:'Spintex Road, Accra',         parentName:'Mrs. Adwoa Adjei',       parentPhone:'0201001047' },
    { firstName:'Yaa',       lastName:'Acheampong', gender:'FEMALE', dob:'2015-06-22', address:'Dome, Accra',                 parentName:'Mr. Francis Acheampong', parentPhone:'0201001048' },
    { firstName:'Daniel',    lastName:'Kumi',       gender:'MALE',   dob:'2014-03-18', address:'Kasoa, Central Region',       parentName:'Mr. Joseph Kumi',        parentPhone:'0201001033' },
    { firstName:'Nhyira',    lastName:'Bediako',    gender:'FEMALE', dob:'2014-05-05', address:'Haatso, Accra',               parentName:'Mrs. Serwa Bediako',     parentPhone:'0201001034' },
    { firstName:'Samuel',    lastName:'Prempeh',    gender:'MALE',   dob:'2015-07-12', address:'East Legon, Accra',           parentName:'Mrs. Akua Prempeh',      parentPhone:'0201001049' },
    { firstName:'Efua',      lastName:'Laryea',     gender:'FEMALE', dob:'2014-02-15', address:'Labadi, Accra',               parentName:'Mr. Kweku Laryea',       parentPhone:'0201001050' },
    { firstName:'Paul',      lastName:'Asamoah',    gender:'MALE',   dob:'2014-10-28', address:'Tema, Greater Accra',         parentName:'Mrs. Grace Asamoah',     parentPhone:'0201001051' },
    { firstName:'Maame',     lastName:'Opoku',      gender:'FEMALE', dob:'2015-08-20', address:'Adenta, Accra',               parentName:'Mr. Kwame Opoku',        parentPhone:'0201001052' },
    { firstName:'Prince',    lastName:'Addai',      gender:'MALE',   dob:'2014-01-10', address:'Suame, Kumasi',               parentName:'Mrs. Abena Addai',       parentPhone:'0201001053' },
    { firstName:'Akua',      lastName:'Takyi',      gender:'FEMALE', dob:'2015-03-25', address:'Takoradi, Western Region',    parentName:'Mr. Kofi Takyi',         parentPhone:'0201001054' },
  ],
  'Class 5': [
    { firstName:'Kwesi',     lastName:'Mensah',     gender:'MALE',   dob:'2013-09-08', address:'East Legon, Accra',           parentName:'Mr. Kwadwo Mensah',      parentPhone:'0201001035' },
    { firstName:'Ama',       lastName:'Boateng',    gender:'FEMALE', dob:'2013-11-20', address:'Haatso, Accra',               parentName:'Mrs. Ama Boateng',       parentPhone:'0201001036' },
    { firstName:'Kojo',      lastName:'Asante',     gender:'MALE',   dob:'2014-02-14', address:'Adenta, Accra',               parentName:'Mr. Yaw Asante',         parentPhone:'0201001037' },
    { firstName:'Akua',      lastName:'Frimpong',   gender:'FEMALE', dob:'2013-07-02', address:'Spintex Road, Accra',         parentName:'Mrs. Efua Frimpong',     parentPhone:'0201001038' },
    { firstName:'Kwame',     lastName:'Owusu',      gender:'MALE',   dob:'2013-12-18', address:'Dome, Accra',                 parentName:'Mr. Daniel Owusu',       parentPhone:'0201001039' },
    { firstName:'Efua',      lastName:'Darko',      gender:'FEMALE', dob:'2014-04-08', address:'Madina, Accra',               parentName:'Mrs. Abena Darko',       parentPhone:'0201001040' },
    { firstName:'Emmanuel',  lastName:'Antwi',      gender:'MALE',   dob:'2013-10-25', address:'Lapaz, Accra',                parentName:'Mr. Eric Antwi',         parentPhone:'0201001041' },
    { firstName:'Adwoa',     lastName:'Appiah',     gender:'FEMALE', dob:'2014-01-15', address:'Achimota, Accra',             parentName:'Mrs. Ruth Appiah',       parentPhone:'0201001042' },
    { firstName:'Michael',   lastName:'Tetteh',     gender:'MALE',   dob:'2013-08-10', address:'Tema Community 10',           parentName:'Mr. Samuel Tetteh',      parentPhone:'0201001043' },
    { firstName:'Yaa',       lastName:'Amoah',      gender:'FEMALE', dob:'2013-12-28', address:'East Legon, Accra',           parentName:'Mr. Kwabena Amoah',      parentPhone:'0201001044' },
    { firstName:'Kofi',      lastName:'Nyarko',     gender:'MALE',   dob:'2014-05-15', address:'Tesano, Accra',               parentName:'Mrs. Akosua Nyarko',     parentPhone:'0201001045' },
    { firstName:'Abena',     lastName:'Osei',       gender:'FEMALE', dob:'2013-06-05', address:'Airport Residential, Accra',  parentName:'Dr. Kofi Osei',          parentPhone:'0201001046' },
    { firstName:'Yaw',       lastName:'Adjei',      gender:'MALE',   dob:'2013-04-20', address:'Spintex Road, Accra',         parentName:'Mrs. Adwoa Adjei',       parentPhone:'0201001047' },
    { firstName:'Akosua',    lastName:'Acheampong', gender:'FEMALE', dob:'2014-06-18', address:'Dome, Accra',                 parentName:'Mr. Francis Acheampong', parentPhone:'0201001048' },
    { firstName:'Joshua',    lastName:'Kumi',       gender:'MALE',   dob:'2013-03-10', address:'Kasoa, Central Region',       parentName:'Mr. Joseph Kumi',        parentPhone:'0201001033' },
    { firstName:'Serwa',     lastName:'Bediako',    gender:'FEMALE', dob:'2013-05-25', address:'Haatso, Accra',               parentName:'Mrs. Serwa Bediako',     parentPhone:'0201001034' },
    { firstName:'Andrews',   lastName:'Prempeh',    gender:'MALE',   dob:'2014-07-05', address:'East Legon, Accra',           parentName:'Mrs. Akua Prempeh',      parentPhone:'0201001049' },
    { firstName:'Afia',      lastName:'Laryea',     gender:'FEMALE', dob:'2013-02-12', address:'Labadi, Accra',               parentName:'Mr. Kweku Laryea',       parentPhone:'0201001050' },
    { firstName:'David',     lastName:'Asamoah',    gender:'MALE',   dob:'2013-10-20', address:'Tema, Greater Accra',         parentName:'Mrs. Grace Asamoah',     parentPhone:'0201001051' },
    { firstName:'Nhyira',    lastName:'Opoku',      gender:'FEMALE', dob:'2014-08-28', address:'Adenta, Accra',               parentName:'Mr. Kwame Opoku',        parentPhone:'0201001052' },
    { firstName:'Stephen',   lastName:'Addai',      gender:'MALE',   dob:'2013-01-05', address:'Suame, Kumasi',               parentName:'Mrs. Abena Addai',       parentPhone:'0201001053' },
    { firstName:'Maame',     lastName:'Takyi',      gender:'FEMALE', dob:'2014-03-22', address:'Takoradi, Western Region',    parentName:'Mr. Kofi Takyi',         parentPhone:'0201001054' },
  ],
  'Class 6': [
    { firstName:'Kwadwo',    lastName:'Mensah',     gender:'MALE',   dob:'2012-09-05', address:'East Legon, Accra',           parentName:'Mr. Kwadwo Mensah',      parentPhone:'0201001035' },
    { firstName:'Akosua',    lastName:'Boateng',    gender:'FEMALE', dob:'2012-11-18', address:'Haatso, Accra',               parentName:'Mrs. Ama Boateng',       parentPhone:'0201001036' },
    { firstName:'Kofi',      lastName:'Asante',     gender:'MALE',   dob:'2013-02-10', address:'Adenta, Accra',               parentName:'Mr. Yaw Asante',         parentPhone:'0201001037' },
    { firstName:'Ama',       lastName:'Frimpong',   gender:'FEMALE', dob:'2012-07-22', address:'Spintex Road, Accra',         parentName:'Mrs. Efua Frimpong',     parentPhone:'0201001038' },
    { firstName:'Kwabena',   lastName:'Owusu',      gender:'MALE',   dob:'2012-12-14', address:'Dome, Accra',                 parentName:'Mr. Daniel Owusu',       parentPhone:'0201001039' },
    { firstName:'Abena',     lastName:'Darko',      gender:'FEMALE', dob:'2013-04-02', address:'Madina, Accra',               parentName:'Mrs. Abena Darko',       parentPhone:'0201001040' },
    { firstName:'Yaw',       lastName:'Antwi',      gender:'MALE',   dob:'2012-10-20', address:'Lapaz, Accra',                parentName:'Mr. Eric Antwi',         parentPhone:'0201001041' },
    { firstName:'Efua',      lastName:'Appiah',     gender:'FEMALE', dob:'2013-01-08', address:'Achimota, Accra',             parentName:'Mrs. Ruth Appiah',       parentPhone:'0201001042' },
    { firstName:'Samuel',    lastName:'Tetteh',     gender:'MALE',   dob:'2012-08-25', address:'Tema Community 1',            parentName:'Mr. Samuel Tetteh',      parentPhone:'0201001043' },
    { firstName:'Adwoa',     lastName:'Amoah',      gender:'FEMALE', dob:'2012-12-30', address:'East Legon, Accra',           parentName:'Mr. Kwabena Amoah',      parentPhone:'0201001044' },
    { firstName:'Emmanuel',  lastName:'Nyarko',     gender:'MALE',   dob:'2013-05-12', address:'Tesano, Accra',               parentName:'Mrs. Akosua Nyarko',     parentPhone:'0201001045' },
    { firstName:'Yaa',       lastName:'Osei',       gender:'FEMALE', dob:'2012-06-18', address:'Airport Residential, Accra',  parentName:'Dr. Kofi Osei',          parentPhone:'0201001046' },
    { firstName:'Daniel',    lastName:'Adjei',      gender:'MALE',   dob:'2012-04-08', address:'Spintex Road, Accra',         parentName:'Mrs. Adwoa Adjei',       parentPhone:'0201001047' },
    { firstName:'Serwa',     lastName:'Acheampong', gender:'FEMALE', dob:'2013-06-25', address:'Dome, Accra',                 parentName:'Mr. Francis Acheampong', parentPhone:'0201001048' },
    { firstName:'Justice',   lastName:'Kumi',       gender:'MALE',   dob:'2012-03-20', address:'Kasoa, Central Region',       parentName:'Mr. Joseph Kumi',        parentPhone:'0201001033' },
    { firstName:'Nhyira',    lastName:'Bediako',    gender:'FEMALE', dob:'2012-05-05', address:'Haatso, Accra',               parentName:'Mrs. Serwa Bediako',     parentPhone:'0201001034' },
    { firstName:'Eric',      lastName:'Prempeh',    gender:'MALE',   dob:'2013-07-18', address:'East Legon, Accra',           parentName:'Mrs. Akua Prempeh',      parentPhone:'0201001049' },
    { firstName:'Afia',      lastName:'Laryea',     gender:'FEMALE', dob:'2012-02-28', address:'Labadi, Accra',               parentName:'Mr. Kweku Laryea',       parentPhone:'0201001050' },
    { firstName:'Michael',   lastName:'Asamoah',    gender:'MALE',   dob:'2012-10-10', address:'Tema, Greater Accra',         parentName:'Mrs. Grace Asamoah',     parentPhone:'0201001051' },
    { firstName:'Maame',     lastName:'Opoku',      gender:'FEMALE', dob:'2013-09-05', address:'Adenta, Accra',               parentName:'Mr. Kwame Opoku',        parentPhone:'0201001052' },
    { firstName:'Prince',    lastName:'Addai',      gender:'MALE',   dob:'2012-01-15', address:'Suame, Kumasi',               parentName:'Mrs. Abena Addai',       parentPhone:'0201001053' },
    { firstName:'Akua',      lastName:'Takyi',      gender:'FEMALE', dob:'2013-03-30', address:'Takoradi, Western Region',    parentName:'Mr. Kofi Takyi',         parentPhone:'0201001054' },
  ],
  'JHS 1': [
    { firstName:'Kwesi',     lastName:'Mensah',     gender:'MALE',   dob:'2011-08-22', address:'East Legon, Accra',           parentName:'Mr. Kwadwo Mensah',      parentPhone:'0201001035' },
    { firstName:'Akua',      lastName:'Boateng',    gender:'FEMALE', dob:'2011-10-15', address:'Haatso, Accra',               parentName:'Mrs. Ama Boateng',       parentPhone:'0201001036' },
    { firstName:'Kweku',     lastName:'Asante',     gender:'MALE',   dob:'2012-01-08', address:'Adenta, Accra',               parentName:'Mr. Yaw Asante',         parentPhone:'0201001037' },
    { firstName:'Yaa',       lastName:'Frimpong',   gender:'FEMALE', dob:'2011-06-28', address:'Spintex Road, Accra',         parentName:'Mrs. Efua Frimpong',     parentPhone:'0201001038' },
    { firstName:'Kojo',      lastName:'Owusu',      gender:'MALE',   dob:'2011-11-20', address:'Dome, Accra',                 parentName:'Mr. Daniel Owusu',       parentPhone:'0201001039' },
    { firstName:'Ama',       lastName:'Darko',      gender:'FEMALE', dob:'2012-03-18', address:'Madina, Accra',               parentName:'Mrs. Abena Darko',       parentPhone:'0201001040' },
    { firstName:'Kwame',     lastName:'Antwi',      gender:'MALE',   dob:'2011-09-10', address:'Lapaz, Accra',                parentName:'Mr. Eric Antwi',         parentPhone:'0201001041' },
    { firstName:'Abena',     lastName:'Appiah',     gender:'FEMALE', dob:'2012-02-25', address:'Achimota, Accra',             parentName:'Mrs. Ruth Appiah',       parentPhone:'0201001042' },
    { firstName:'Kofi',      lastName:'Tetteh',     gender:'MALE',   dob:'2011-07-15', address:'Tema Community 4',            parentName:'Mr. Samuel Tetteh',      parentPhone:'0201001043' },
    { firstName:'Efua',      lastName:'Amoah',      gender:'FEMALE', dob:'2011-12-08', address:'East Legon, Accra',           parentName:'Mr. Kwabena Amoah',      parentPhone:'0201001044' },
    { firstName:'Yaw',       lastName:'Nyarko',     gender:'MALE',   dob:'2012-04-22', address:'Tesano, Accra',               parentName:'Mrs. Akosua Nyarko',     parentPhone:'0201001045' },
    { firstName:'Akosua',    lastName:'Osei',       gender:'FEMALE', dob:'2011-05-30', address:'Airport Residential, Accra',  parentName:'Dr. Kofi Osei',          parentPhone:'0201001046' },
    { firstName:'Emmanuel',  lastName:'Adjei',      gender:'MALE',   dob:'2011-04-05', address:'Spintex Road, Accra',         parentName:'Mrs. Adwoa Adjei',       parentPhone:'0201001047' },
    { firstName:'Adwoa',     lastName:'Acheampong', gender:'FEMALE', dob:'2012-05-18', address:'Dome, Accra',                 parentName:'Mr. Francis Acheampong', parentPhone:'0201001048' },
    { firstName:'Samuel',    lastName:'Kumi',       gender:'MALE',   dob:'2011-03-12', address:'Kasoa, Central Region',       parentName:'Mr. Joseph Kumi',        parentPhone:'0201001033' },
    { firstName:'Serwa',     lastName:'Bediako',    gender:'FEMALE', dob:'2011-05-05', address:'Haatso, Accra',               parentName:'Mrs. Serwa Bediako',     parentPhone:'0201001034' },
    { firstName:'Michael',   lastName:'Prempeh',    gender:'MALE',   dob:'2012-06-28', address:'East Legon, Accra',           parentName:'Mrs. Akua Prempeh',      parentPhone:'0201001049' },
    { firstName:'Nhyira',    lastName:'Laryea',     gender:'FEMALE', dob:'2011-02-10', address:'Labadi, Accra',               parentName:'Mr. Kweku Laryea',       parentPhone:'0201001050' },
    { firstName:'Daniel',    lastName:'Asamoah',    gender:'MALE',   dob:'2011-09-28', address:'Tema, Greater Accra',         parentName:'Mrs. Grace Asamoah',     parentPhone:'0201001051' },
    { firstName:'Maame',     lastName:'Opoku',      gender:'FEMALE', dob:'2012-07-20', address:'Adenta, Accra',               parentName:'Mr. Kwame Opoku',        parentPhone:'0201001052' },
    { firstName:'Andrews',   lastName:'Addai',      gender:'MALE',   dob:'2011-01-18', address:'Suame, Kumasi',               parentName:'Mrs. Abena Addai',       parentPhone:'0201001053' },
    { firstName:'Afia',      lastName:'Takyi',      gender:'FEMALE', dob:'2012-03-08', address:'Takoradi, Western Region',    parentName:'Mr. Kofi Takyi',         parentPhone:'0201001054' },
  ],
  'JHS 2': [
    { firstName:'Kwadwo',    lastName:'Mensah',     gender:'MALE',   dob:'2010-09-05', address:'East Legon, Accra',           parentName:'Mr. Kwadwo Mensah',      parentPhone:'0201001035' },
    { firstName:'Ama',       lastName:'Boateng',    gender:'FEMALE', dob:'2010-11-20', address:'Haatso, Accra',               parentName:'Mrs. Ama Boateng',       parentPhone:'0201001036' },
    { firstName:'Kwabena',   lastName:'Asante',     gender:'MALE',   dob:'2011-02-14', address:'Adenta, Accra',               parentName:'Mr. Yaw Asante',         parentPhone:'0201001037' },
    { firstName:'Akua',      lastName:'Frimpong',   gender:'FEMALE', dob:'2010-07-08', address:'Spintex Road, Accra',         parentName:'Mrs. Efua Frimpong',     parentPhone:'0201001038' },
    { firstName:'Yaw',       lastName:'Owusu',      gender:'MALE',   dob:'2010-12-22', address:'Dome, Accra',                 parentName:'Mr. Daniel Owusu',       parentPhone:'0201001039' },
    { firstName:'Adwoa',     lastName:'Darko',      gender:'FEMALE', dob:'2011-04-10', address:'Madina, Accra',               parentName:'Mrs. Abena Darko',       parentPhone:'0201001040' },
    { firstName:'Kofi',      lastName:'Antwi',      gender:'MALE',   dob:'2010-10-28', address:'Lapaz, Accra',                parentName:'Mr. Eric Antwi',         parentPhone:'0201001041' },
    { firstName:'Efua',      lastName:'Appiah',     gender:'FEMALE', dob:'2011-01-15', address:'Achimota, Accra',             parentName:'Mrs. Ruth Appiah',       parentPhone:'0201001042' },
    { firstName:'Justice',   lastName:'Tetteh',     gender:'MALE',   dob:'2010-08-18', address:'Tema Community 11',           parentName:'Mr. Samuel Tetteh',      parentPhone:'0201001043' },
    { firstName:'Yaa',       lastName:'Amoah',      gender:'FEMALE', dob:'2010-12-30', address:'East Legon, Accra',           parentName:'Mr. Kwabena Amoah',      parentPhone:'0201001044' },
    { firstName:'Kwesi',     lastName:'Nyarko',     gender:'MALE',   dob:'2011-05-08', address:'Tesano, Accra',               parentName:'Mrs. Akosua Nyarko',     parentPhone:'0201001045' },
    { firstName:'Abena',     lastName:'Osei',       gender:'FEMALE', dob:'2010-06-25', address:'Airport Residential, Accra',  parentName:'Dr. Kofi Osei',          parentPhone:'0201001046' },
    { firstName:'Eric',      lastName:'Adjei',      gender:'MALE',   dob:'2010-04-12', address:'Spintex Road, Accra',         parentName:'Mrs. Adwoa Adjei',       parentPhone:'0201001047' },
    { firstName:'Akosua',    lastName:'Acheampong', gender:'FEMALE', dob:'2011-06-28', address:'Dome, Accra',                 parentName:'Mr. Francis Acheampong', parentPhone:'0201001048' },
    { firstName:'Kojo',      lastName:'Kumi',       gender:'MALE',   dob:'2010-03-20', address:'Kasoa, Central Region',       parentName:'Mr. Joseph Kumi',        parentPhone:'0201001033' },
    { firstName:'Serwa',     lastName:'Bediako',    gender:'FEMALE', dob:'2010-05-15', address:'Haatso, Accra',               parentName:'Mrs. Serwa Bediako',     parentPhone:'0201001034' },
    { firstName:'Paul',      lastName:'Prempeh',    gender:'MALE',   dob:'2011-07-05', address:'East Legon, Accra',           parentName:'Mrs. Akua Prempeh',      parentPhone:'0201001049' },
    { firstName:'Nhyira',    lastName:'Laryea',     gender:'FEMALE', dob:'2010-02-08', address:'Labadi, Accra',               parentName:'Mr. Kweku Laryea',       parentPhone:'0201001050' },
    { firstName:'Emmanuel',  lastName:'Asamoah',    gender:'MALE',   dob:'2010-10-18', address:'Tema, Greater Accra',         parentName:'Mrs. Grace Asamoah',     parentPhone:'0201001051' },
    { firstName:'Maame',     lastName:'Opoku',      gender:'FEMALE', dob:'2011-08-25', address:'Adenta, Accra',               parentName:'Mr. Kwame Opoku',        parentPhone:'0201001052' },
    { firstName:'Stephen',   lastName:'Addai',      gender:'MALE',   dob:'2010-01-28', address:'Suame, Kumasi',               parentName:'Mrs. Abena Addai',       parentPhone:'0201001053' },
    { firstName:'Afia',      lastName:'Takyi',      gender:'FEMALE', dob:'2011-03-20', address:'Takoradi, Western Region',    parentName:'Mr. Kofi Takyi',         parentPhone:'0201001054' },
  ],
  'JHS 3': [
    { firstName:'Kweku',     lastName:'Mensah',     gender:'MALE',   dob:'2009-08-15', address:'East Legon, Accra',           parentName:'Mr. Kwadwo Mensah',      parentPhone:'0201001035' },
    { firstName:'Akosua',    lastName:'Boateng',    gender:'FEMALE', dob:'2009-10-28', address:'Haatso, Accra',               parentName:'Mrs. Ama Boateng',       parentPhone:'0201001036' },
    { firstName:'Kofi',      lastName:'Asante',     gender:'MALE',   dob:'2010-02-05', address:'Adenta, Accra',               parentName:'Mr. Yaw Asante',         parentPhone:'0201001037' },
    { firstName:'Ama',       lastName:'Frimpong',   gender:'FEMALE', dob:'2009-06-18', address:'Spintex Road, Accra',         parentName:'Mrs. Efua Frimpong',     parentPhone:'0201001038' },
    { firstName:'Kwadwo',    lastName:'Owusu',      gender:'MALE',   dob:'2009-11-10', address:'Dome, Accra',                 parentName:'Mr. Daniel Owusu',       parentPhone:'0201001039' },
    { firstName:'Yaa',       lastName:'Darko',      gender:'FEMALE', dob:'2010-03-25', address:'Madina, Accra',               parentName:'Mrs. Abena Darko',       parentPhone:'0201001040' },
    { firstName:'Kwabena',   lastName:'Antwi',      gender:'MALE',   dob:'2009-09-20', address:'Lapaz, Accra',                parentName:'Mr. Eric Antwi',         parentPhone:'0201001041' },
    { firstName:'Efua',      lastName:'Appiah',     gender:'FEMALE', dob:'2010-01-12', address:'Achimota, Accra',             parentName:'Mrs. Ruth Appiah',       parentPhone:'0201001042' },
    { firstName:'Yaw',       lastName:'Tetteh',     gender:'MALE',   dob:'2009-07-28', address:'Tema Community 14',           parentName:'Mr. Samuel Tetteh',      parentPhone:'0201001043' },
    { firstName:'Abena',     lastName:'Amoah',      gender:'FEMALE', dob:'2009-12-18', address:'East Legon, Accra',           parentName:'Mr. Kwabena Amoah',      parentPhone:'0201001044' },
    { firstName:'Emmanuel',  lastName:'Nyarko',     gender:'MALE',   dob:'2010-05-02', address:'Tesano, Accra',               parentName:'Mrs. Akosua Nyarko',     parentPhone:'0201001045' },
    { firstName:'Akua',      lastName:'Osei',       gender:'FEMALE', dob:'2009-06-10', address:'Airport Residential, Accra',  parentName:'Dr. Kofi Osei',          parentPhone:'0201001046' },
    { firstName:'Daniel',    lastName:'Adjei',      gender:'MALE',   dob:'2009-04-25', address:'Spintex Road, Accra',         parentName:'Mrs. Adwoa Adjei',       parentPhone:'0201001047' },
    { firstName:'Adwoa',     lastName:'Acheampong', gender:'FEMALE', dob:'2010-06-15', address:'Dome, Accra',                 parentName:'Mr. Francis Acheampong', parentPhone:'0201001048' },
    { firstName:'Justice',   lastName:'Kumi',       gender:'MALE',   dob:'2009-03-08', address:'Kasoa, Central Region',       parentName:'Mr. Joseph Kumi',        parentPhone:'0201001033' },
    { firstName:'Nhyira',    lastName:'Bediako',    gender:'FEMALE', dob:'2009-05-20', address:'Haatso, Accra',               parentName:'Mrs. Serwa Bediako',     parentPhone:'0201001034' },
    { firstName:'Samuel',    lastName:'Prempeh',    gender:'MALE',   dob:'2010-07-18', address:'East Legon, Accra',           parentName:'Mrs. Akua Prempeh',      parentPhone:'0201001049' },
    { firstName:'Serwa',     lastName:'Laryea',     gender:'FEMALE', dob:'2009-02-22', address:'Labadi, Accra',               parentName:'Mr. Kweku Laryea',       parentPhone:'0201001050' },
    { firstName:'Michael',   lastName:'Asamoah',    gender:'MALE',   dob:'2009-10-05', address:'Tema, Greater Accra',         parentName:'Mrs. Grace Asamoah',     parentPhone:'0201001051' },
    { firstName:'Maame',     lastName:'Opoku',      gender:'FEMALE', dob:'2010-08-30', address:'Adenta, Accra',               parentName:'Mr. Kwame Opoku',        parentPhone:'0201001052' },
    { firstName:'Andrews',   lastName:'Addai',      gender:'MALE',   dob:'2009-01-12', address:'Suame, Kumasi',               parentName:'Mrs. Abena Addai',       parentPhone:'0201001053' },
    { firstName:'Afia',      lastName:'Takyi',      gender:'FEMALE', dob:'2010-04-05', address:'Takoradi, Western Region',    parentName:'Mr. Kofi Takyi',         parentPhone:'0201001054' },
  ],
};

// Timetable time slots (matches existing seed-timetable.js)
const TIMETABLE_SLOTS = [
  { startTime: '08:00', endTime: '08:40' },
  { startTime: '08:50', endTime: '09:30' },
  { startTime: '09:40', endTime: '10:20' },
  { startTime: '10:40', endTime: '11:20' },
  { startTime: '11:30', endTime: '12:10' },
  { startTime: '12:20', endTime: '13:00' },
];

// Fee amounts per class level (GHS, per term)
const FEE_AMOUNTS = {
  NURSERY_1: 1200, NURSERY_2: 1200,
  KG_1: 1500,     KG_2: 1500,
  BASIC_1: 1800,  BASIC_2: 1800,  BASIC_3: 1800,
  BASIC_4: 2000,  BASIC_5: 2000,  BASIC_6: 2000,
  JHS_1: 2500,    JHS_2: 2500,    JHS_3: 2500,
};

const ANNOUNCEMENTS_DATA = [
  {
    title: 'Welcome Back! Second Term 2026 Begins',
    body: "Eagle's Nest International School warmly welcomes all students, parents, and staff back for the Second Term of the 2025/2026 academic year. School resumed on Monday, 12th January 2026. We look forward to another productive and exciting term. God bless Eagle's Nest!",
    audience: 'ALL',
    createdAt: new Date('2026-01-12T08:00:00'),
  },
  {
    title: 'Second Term School Fees — Payment Deadline',
    body: "Dear Parents and Guardians, this is a reminder that Second Term school fees are due by Friday, 31st January 2026. Kindly ensure full payment is made before this date to avoid disruption to your ward's education. Payments can be made via cash, Mobile Money (MoMo), or bank transfer. Please contact the school office for our bank details.",
    audience: 'PARENTS',
    createdAt: new Date('2026-01-15T09:00:00'),
  },
  {
    title: 'First Term 2025 Results Now Available',
    body: "We are pleased to announce that First Term 2025 end-of-term results have been published and are now available on the parent portal. Parents and guardians can log in to view their ward's performance. Report cards will also be distributed on the first day of Second Term.",
    audience: 'PARENTS',
    createdAt: new Date('2025-12-14T10:00:00'),
  },
  {
    title: 'Staff Professional Development Workshop — February',
    body: "All teaching and non-teaching staff are reminded of the Professional Development Workshop scheduled for Saturday, 14th February 2026. The workshop will focus on 21st Century Teaching Methodologies and Technology Integration in the Classroom. Attendance is compulsory. Venue: School Hall. Time: 8:00 AM.",
    audience: 'TEACHERS',
    createdAt: new Date('2026-02-05T08:00:00'),
  },
  {
    title: "Sports Day 2026 — 'Faster, Higher, Stronger'",
    body: "Eagle's Nest Annual Sports Day is scheduled for Saturday, 28th February 2026 at the school sports field. All students are encouraged to participate in their respective house events. Parents are warmly invited to come cheer on their children. Gates open at 7:30 AM. Let's make this year's Sports Day the best yet!",
    audience: 'ALL',
    createdAt: new Date('2026-02-10T09:00:00'),
  },
  {
    title: "Ghana Independence Day — 69th Anniversary Celebration",
    body: "Eagle's Nest International School will mark Ghana's 69th Independence Day on Friday, 6th March 2026. There will be a special assembly, patriotic recitations, cultural displays, and a march-past. All students are expected to wear the Ghana national colours (red, gold, green). School will be closed on this day as it is a national holiday.",
    audience: 'ALL',
    createdAt: new Date('2026-03-03T08:00:00'),
  },
  {
    title: 'Mid-Term Examinations Schedule — Second Term 2026',
    body: "Mid-Term Examinations for the Second Term 2026 will be held from Monday, 9th March to Friday, 13th March 2026. Students are advised to revise all topics covered since the beginning of term. Examination timetables have been distributed to class teachers. Parents should ensure their wards are adequately prepared.",
    audience: 'ALL',
    createdAt: new Date('2026-02-28T09:00:00'),
  },
  {
    title: 'Easter Holiday Notice — School Closure',
    body: "Eagle's Nest International School will be closed from Thursday, 2nd April to Monday, 6th April 2026 for the Easter holidays. School resumes on Tuesday, 7th April 2026. We wish all our students, parents, and staff a blessed and peaceful Easter celebration. He is Risen!",
    audience: 'ALL',
    createdAt: new Date('2026-03-28T10:00:00'),
  },
];

// ════════════════════════════════════════════════════════════════
// SEEDER FUNCTIONS
// ════════════════════════════════════════════════════════════════

async function seedTerms() {
  console.log('\n📅 Seeding academic terms...');
  const terms = {};
  for (const t of TERMS_DATA) {
    const existing = await prisma.term.findFirst({ where: { name: t.name, year: t.year } });
    if (existing) {
      console.log(`  ✓ ${t.name} ${t.year} already exists`);
      terms[`${t.name}-${t.year}`] = existing;
      continue;
    }
    const created = await prisma.term.create({ data: t });
    console.log(`  ✓ Created: ${created.name} ${created.year}`);
    terms[`${t.name}-${t.year}`] = created;
  }
  return terms;
}

async function seedClasses() {
  console.log('\n🏫 Seeding classes...');
  const classes = {};
  for (const c of CLASSES_DATA) {
    const existing = await prisma.class.findFirst({ where: { level: c.level, section: c.section } });
    if (existing) {
      console.log(`  ✓ ${c.name} already exists`);
      classes[c.name] = existing;
      continue;
    }
    const created = await prisma.class.create({ data: c });
    console.log(`  ✓ Created: ${created.name}`);
    classes[c.name] = created;
  }
  return classes;
}

async function seedSubjects() {
  console.log('\n📚 Seeding subjects...');
  const subjects = {};
  for (const s of SUBJECTS_DATA) {
    const existing = await prisma.subject.findUnique({ where: { name: s.name } });
    if (existing) {
      subjects[s.code] = existing;
      continue;
    }
    const created = await prisma.subject.create({ data: s });
    console.log(`  ✓ Created: ${created.name}`);
    subjects[s.code] = created;
  }
  // Also map by code for any existing records
  const all = await prisma.subject.findMany();
  for (const s of all) subjects[s.code] = s;
  return subjects;
}

async function seedAdmin(passwordHash) {
  console.log('\n👑 Seeding admin / headmaster...');
  let user = await prisma.user.findUnique({ where: { phone: ADMIN_DATA.phone } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        phone:     ADMIN_DATA.phone,
        email:     ADMIN_DATA.email,
        password:  passwordHash,
        firstName: ADMIN_DATA.firstName,
        lastName:  ADMIN_DATA.lastName,
        role:      'ADMIN',
      },
    });
    console.log(`  ✓ Admin user created: ${user.firstName} ${user.lastName}`);
  } else {
    console.log(`  ✓ Admin user exists: ${user.firstName} ${user.lastName}`);
  }
  let teacher = await prisma.teacher.findUnique({ where: { userId: user.id } });
  if (!teacher) {
    teacher = await prisma.teacher.create({
      data: { userId: user.id, staffId: ADMIN_DATA.staffId, qualification: ADMIN_DATA.qualification },
    });
    console.log(`  ✓ Admin teacher record created (${teacher.staffId})`);
  }
  return teacher;
}

async function seedTeachers(passwordHash, classes) {
  console.log('\n👩‍🏫 Seeding teachers...');
  const teachers = [];
  for (let i = 0; i < TEACHERS_DATA.length; i++) {
    const row = TEACHERS_DATA[i];
    let user = await prisma.user.findUnique({ where: { phone: row.phone } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          phone:     row.phone,
          password:  passwordHash,
          firstName: row.firstName,
          lastName:  row.lastName,
          role:      'TEACHER',
        },
      });
    }
    let teacher = await prisma.teacher.findUnique({ where: { userId: user.id } });
    if (!teacher) {
      teacher = await prisma.teacher.create({
        data: { userId: user.id, staffId: row.staffId, qualification: row.qualification },
      });
      console.log(`  ✓ Created teacher: ${row.firstName} ${row.lastName} (${row.staffId})`);
    } else {
      console.log(`  ✓ Teacher exists: ${row.firstName} ${row.lastName}`);
    }
    teachers.push(teacher);

    // Assign as class teacher (teachers 0–12 are class teachers)
    if (i < 13) {
      const cls = Object.values(classes)[i];
      if (cls && !cls.classTeacherId) {
        await prisma.class.update({ where: { id: cls.id }, data: { classTeacherId: teacher.id } });
        // Update our local reference too
        Object.values(classes)[i].classTeacherId = teacher.id;
        console.log(`    → Assigned as class teacher for ${cls.name}`);
      }
    }
  }
  return teachers;
}

async function seedSubjectTeachers(teachers, classes, subjects) {
  console.log('\n📌 Seeding subject-teacher assignments...');
  const teacherByStaffId = {};
  for (const t of teachers) {
    const row = TEACHERS_DATA.find(r => r.staffId === t.staffId) || {};
    teacherByStaffId[t.staffId] = t;
  }
  // Also add admin
  const adminTeacher = await prisma.teacher.findUnique({ where: { staffId: ADMIN_DATA.staffId } });
  if (adminTeacher) teacherByStaffId[ADMIN_DATA.staffId] = adminTeacher;

  const classByLevel = {};
  for (const cls of Object.values(classes)) classByLevel[cls.level] = cls;

  let created = 0;
  for (const row of SUBJECT_TEACHER_MAP) {
    const cls     = classByLevel[row.classLevel];
    const subject = subjects[row.subjectCode];
    const teacher = teacherByStaffId[row.staffId];
    if (!cls || !subject || !teacher) continue;

    try {
      await prisma.subjectTeacher.upsert({
        where: { teacherId_subjectId_classId: { teacherId: teacher.id, subjectId: subject.id, classId: cls.id } },
        update: {},
        create: { teacherId: teacher.id, subjectId: subject.id, classId: cls.id },
      });
      created++;
    } catch (e) {
      // skip duplicates silently
    }
  }
  console.log(`  ✓ ${created} subject-teacher assignments processed`);
}

async function seedTimetable(classes, subjects) {
  console.log('\n📋 Seeding timetable...');
  let total = 0;
  for (const cls of Object.values(classes)) {
    const assignments = await prisma.subjectTeacher.findMany({
      where: { classId: cls.id },
      include: { subject: true },
      orderBy: { subject: { code: 'asc' } },
    });
    if (assignments.length === 0) continue;

    let cursor = 0;
    for (let day = 1; day <= 5; day++) {
      for (const slot of TIMETABLE_SLOTS) {
        const assignment = assignments[cursor % assignments.length];
        cursor++;
        try {
          await prisma.timetable.upsert({
            where: { classId_dayOfWeek_startTime: { classId: cls.id, dayOfWeek: day, startTime: slot.startTime } },
            update: { subjectId: assignment.subjectId, endTime: slot.endTime },
            create: { classId: cls.id, subjectId: assignment.subjectId, dayOfWeek: day, startTime: slot.startTime, endTime: slot.endTime },
          });
          total++;
        } catch (e) { /* skip */ }
      }
    }
  }
  console.log(`  ✓ ${total} timetable entries seeded`);
}

async function seedStudents(classes) {
  console.log('\n🧒 Seeding students...');
  const year  = 2026;
  let seqRef  = { value: 1 };

  // Find next available student ID
  const last = await prisma.student.findFirst({
    where: { studentId: { startsWith: `STM-${year}-` } },
    orderBy: { studentId: 'desc' },
  });
  if (last) {
    const seq = parseInt(last.studentId.split('-')[2], 10);
    seqRef.value = Number.isNaN(seq) ? 1 : seq + 1;
  }

  const allStudents = {}; // className → student[]
  let globalIdx = 0;

  for (const [className, studentList] of Object.entries(STUDENTS_BY_CLASS)) {
    const cls = classes[className];
    if (!cls) { console.warn(`  ⚠ Class "${className}" not found`); continue; }

    const created = [];
    for (const s of studentList) {
      const existing = await prisma.student.findFirst({
        where: { firstName: s.firstName, lastName: s.lastName, classId: cls.id },
      });
      if (existing) {
        created.push({ ...existing, _globalIdx: globalIdx++ });
        continue;
      }

      const studentId = `STM-${year}-${String(seqRef.value).padStart(3, '0')}`;
      seqRef.value++;

      const student = await prisma.student.create({
        data: {
          studentId,
          firstName:   s.firstName,
          lastName:    s.lastName,
          dateOfBirth: new Date(s.dob),
          gender:      s.gender,
          address:     s.address,
          parentName:  s.parentName,
          parentPhone: s.parentPhone,
          classId:     cls.id,
          isActive:    true,
        },
      });
      created.push({ ...student, _globalIdx: globalIdx++ });
    }
    allStudents[className] = created;
    console.log(`  ✓ ${className}: ${created.length} students`);
  }
  return allStudents;
}

async function seedParents(allStudents, classes, passwordHash) {
  console.log('\n👨‍👩‍👧 Seeding parent accounts...');
  // Create accounts for students in Class 4 – JHS 3
  const targetClasses = ['Class 4','Class 5','Class 6','JHS 1','JHS 2','JHS 3'];
  const phoneToParent = {}; // phone → parent record (for siblings)
  let created = 0;

  for (const className of targetClasses) {
    const students = allStudents[className] || [];
    const cls = classes[className];
    if (!cls) continue;

    for (const student of students) {
      // Use the parentPhone stored on the student
      const rawStudent = await prisma.student.findUnique({ where: { id: student.id } });
      if (!rawStudent || !rawStudent.parentPhone) continue;

      const phone = rawStudent.parentPhone;

      if (phoneToParent[phone]) {
        // Parent already created — link this student to existing parent
        const parent = phoneToParent[phone];
        if (!rawStudent.parentId) {
          await prisma.student.update({
            where: { id: student.id },
            data: { parentId: parent.id },
          });
        }
        continue;
      }

      let user = await prisma.user.findUnique({ where: { phone } });
      if (!user) {
        const nameParts = (rawStudent.parentName || '').replace(/^(Mr\.|Mrs\.|Dr\.)\s+/, '').split(' ');
        const firstName = nameParts[0] || 'Parent';
        const lastName  = nameParts.slice(1).join(' ') || rawStudent.lastName;
        user = await prisma.user.create({
          data: {
            phone,
            password:  passwordHash,
            firstName,
            lastName,
            role:      'PARENT',
          },
        });
        created++;
      }

      let parent = await prisma.parent.findUnique({ where: { userId: user.id } });
      if (!parent) {
        parent = await prisma.parent.create({ data: { userId: user.id } });
      }
      phoneToParent[phone] = parent;

      if (!rawStudent.parentId) {
        await prisma.student.update({
          where: { id: student.id },
          data: { parentId: parent.id },
        });
      }
    }
  }
  console.log(`  ✓ ${created} parent accounts created`);
}

async function seedAttendance(allStudents, term2) {
  console.log(`\n📊 Seeding Term 2 student attendance (${TERM2_DAYS.length} school days)...`);

  const STATUSES = ['PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','ABSENT','ABSENT','LATE','EXCUSED'];
  let total = 0;

  for (const [className, students] of Object.entries(allStudents)) {
    for (let si = 0; si < students.length; si++) {
      const student = students[si];
      const records = [];

      for (let di = 0; di < TERM2_DAYS.length; di++) {
        const day = TERM2_DAYS[di];
        // Deterministic status based on student + day index
        const statusIdx = Math.floor(rand(student._globalIdx * 10007 + di * 31) * STATUSES.length);
        const status = STATUSES[statusIdx];
        records.push({
          studentId: student.id,
          date:      day,
          status,
          termId:    term2.id,
        });
      }

      // Insert in batches, skipping duplicates
      await prisma.attendance.createMany({ data: records, skipDuplicates: true });
      total += records.length;
    }
    process.stdout.write(`  ✓ ${className} attendance done\n`);
  }
  console.log(`  ✓ ${total} attendance records seeded`);
}

async function seedTeacherAttendance(teachers, term2) {
  console.log(`\n🧑‍🏫 Seeding teacher attendance (${TERM2_DAYS.length} days)...`);
  const allTeachers = await prisma.teacher.findMany();
  const records = [];

  for (const teacher of allTeachers) {
    for (let di = 0; di < TERM2_DAYS.length; di++) {
      const day = TERM2_DAYS[di];
      const r = rand(teacher.id.charCodeAt(0) * 999 + di * 37);
      let status;
      if (r < 0.85)       status = 'PRESENT';
      else if (r < 0.93)  status = 'ABSENT';
      else                status = 'LATE';

      let checkIn  = null;
      let checkOut = null;
      if (status === 'PRESENT') {
        const minOff = Math.floor(rand(teacher.id.charCodeAt(1) * 7 + di) * 15);
        const hIn = new Date(day);
        hIn.setHours(7, 30 + minOff, 0, 0);
        const hOut = new Date(day);
        hOut.setHours(14, 0 + Math.floor(rand(di * 3) * 30), 0, 0);
        checkIn  = hIn;
        checkOut = hOut;
      } else if (status === 'LATE') {
        const hIn = new Date(day);
        hIn.setHours(8, 15 + Math.floor(rand(di * 5) * 30), 0, 0);
        checkIn = hIn;
      }

      records.push({ teacherId: teacher.id, date: day, status, checkIn, checkOut, termId: term2.id });
    }
  }

  await prisma.teacherAttendance.createMany({ data: records, skipDuplicates: true });
  console.log(`  ✓ ${records.length} teacher attendance records seeded`);
}

async function seedTerm1Results(allStudents, classes, subjects, term1) {
  console.log('\n📝 Seeding Term 1 results (Basic 1 – JHS 3)...');
  const classesWithResults = [
    'Class 1','Class 2','Class 3','Class 4','Class 5','Class 6',
    'JHS 1','JHS 2','JHS 3',
  ];
  let total = 0;

  for (const className of classesWithResults) {
    const students = allStudents[className] || [];
    const cls      = classes[className];
    if (!cls) continue;

    const subjectCodes = CLASS_SUBJECTS[cls.level] || [];
    const resultRecords = [];

    for (let si = 0; si < students.length; si++) {
      const student = students[si];
      for (let subIdx = 0; subIdx < subjectCodes.length; subIdx++) {
        const subject = subjects[subjectCodes[subIdx]];
        if (!subject) continue;

        const { classScore, examScore, totalScore } = generateScores(student._globalIdx, subIdx, 0);
        const grade   = getGrade(totalScore);
        const remarks = gradeRemarks(grade);

        resultRecords.push({
          studentId:  student.id,
          subjectId:  subject.id,
          termId:     term1.id,
          classScore,
          examScore,
          totalScore,
          grade,
          remarks,
          isPromoted: totalScore >= 50,
        });
      }
    }

    await prisma.result.createMany({ data: resultRecords, skipDuplicates: true });
    total += resultRecords.length;
    console.log(`  ✓ ${className}: ${resultRecords.length} results`);
  }
  console.log(`  ✓ ${total} result records seeded`);
}

async function seedTerm1Assessments(allStudents, classes, subjects, term1, adminTeacher) {
  console.log('\n📋 Seeding Term 1 assessments & scores...');
  const classesForAssessments = [
    'Class 4','Class 5','Class 6','JHS 1','JHS 2','JHS 3',
  ];

  const assessmentTemplates = [
    { name: 'Class Test 1',         type: 'TEST', totalMark: 30, weekOffset: 3  },
    { name: 'Class Test 2',         type: 'TEST', totalMark: 30, weekOffset: 7  },
    { name: 'End-of-Term Exam',     type: 'EXAM', totalMark: 50, weekOffset: 14 },
  ];

  let assessmentCount = 0;
  let scoreCount = 0;

  for (const className of classesForAssessments) {
    const cls      = classes[className];
    const students = allStudents[className] || [];
    if (!cls || students.length === 0) continue;

    const subjectCodes = CLASS_SUBJECTS[cls.level] || [];

    // Use MATH and ENG for demo assessments (to keep data manageable)
    const demoSubjectCodes = ['MATH','ENG','SCI'].filter(c => subjectCodes.includes(c));

    for (const subjectCode of demoSubjectCodes) {
      const subject = subjects[subjectCode];
      if (!subject) continue;

      for (let ti = 0; ti < assessmentTemplates.length; ti++) {
        const tmpl = assessmentTemplates[ti];
        const assessDate = new Date('2025-09-08');
        assessDate.setDate(assessDate.getDate() + tmpl.weekOffset * 7);

        const assessmentName = `${tmpl.name} — ${subject.name}`;
        let assessment = await prisma.assessment.findFirst({
          where: { name: assessmentName, classId: cls.id, termId: term1.id },
        });

        if (!assessment) {
          assessment = await prisma.assessment.create({
            data: {
              name:        assessmentName,
              type:        tmpl.type,
              totalMark:   tmpl.totalMark,
              date:        assessDate,
              classId:     cls.id,
              subjectId:   subject.id,
              termId:      term1.id,
              createdById: adminTeacher.userId,
            },
          });
          assessmentCount++;
        }

        // Scores for each student
        const scoreRecords = students.map((student, si) => {
          const talentVal = talent(student._globalIdx);
          const rawScore  = Math.round(talentVal * tmpl.totalMark * (0.8 + rand(student._globalIdx * 7 + ti) * 0.2));
          return {
            assessmentId: assessment.id,
            studentId:    student.id,
            score:        Math.min(rawScore, tmpl.totalMark),
          };
        });

        await prisma.assessmentScore.createMany({ data: scoreRecords, skipDuplicates: true });
        scoreCount += scoreRecords.length;
      }
    }
    console.log(`  ✓ ${className} assessments done`);
  }
  console.log(`  ✓ ${assessmentCount} assessments, ${scoreCount} scores seeded`);
}

async function seedTermRemarks(allStudents, classes, subjects, term1) {
  console.log('\n💬 Seeding Term 1 remarks...');
  const classesForRemarks = ['Class 4','Class 5','Class 6','JHS 1','JHS 2','JHS 3'];
  let total = 0;

  for (const className of classesForRemarks) {
    const cls      = classes[className];
    const students = allStudents[className] || [];
    if (!cls) continue;

    for (const student of students) {
      const existing = await prisma.termRemarks.findFirst({
        where: { studentId: student.id, termId: term1.id },
      });
      if (existing) continue;

      const avg = 55 + talent(student._globalIdx) * 35;
      await prisma.termRemarks.create({
        data: {
          studentId:         student.id,
          termId:            term1.id,
          classId:           cls.id,
          teacherRemarks:    teacherRemark(avg),
          headmasterRemarks: headRemark(avg),
          nextTermBegins:    new Date('2026-01-12'),
        },
      });
      total++;
    }
  }
  console.log(`  ✓ ${total} term remarks seeded`);
}

async function seedFeeStructures(terms, classes) {
  console.log('\n💰 Seeding fee structures...');
  const term1 = terms['First Term-2025'];
  const term2 = terms['Second Term-2026'];
  const feeStructures = {}; // `${level}-${termKey}` → feeStructure

  for (const [termKey, term] of [['t1', term1], ['t2', term2]]) {
    for (const cls of Object.values(classes)) {
      const amount = FEE_AMOUNTS[cls.level] || 2000;
      const name   = `${cls.name} Fees`;
      const key    = `${cls.level}-${termKey}`;

      const existing = await prisma.feeStructure.findFirst({
        where: { name, termId: term.id, classLevel: cls.level },
      });
      if (existing) {
        feeStructures[key] = existing;
        continue;
      }
      const fs = await prisma.feeStructure.create({
        data: { name, amount, termId: term.id, classLevel: cls.level },
      });
      feeStructures[key] = fs;
    }
  }
  console.log(`  ✓ ${Object.keys(feeStructures).length} fee structures created`);
  return feeStructures;
}

async function seedFeePayments(allStudents, classes, feeStructures, terms) {
  console.log('\n💳 Seeding fee payments...');
  const term1 = terms['First Term-2025'];
  const term2 = terms['Second Term-2026'];
  const METHODS  = ['cash','momo','momo','bank'];
  const STATUSES_T1 = ['FULLY_PAID','FULLY_PAID','FULLY_PAID','FULLY_PAID','HALF_PAID','HALF_PAID','PARTIAL']; // Term 1: mostly paid
  const STATUSES_T2 = ['FULLY_PAID','FULLY_PAID','HALF_PAID','PARTIAL','PARTIAL','UNPAID'];                    // Term 2: more variance
  let total = 0;
  let rcpSeq = 1;

  for (const [className, students] of Object.entries(allStudents)) {
    const cls = classes[className];
    if (!cls) continue;

    const fsT1 = feeStructures[`${cls.level}-t1`];
    const fsT2 = feeStructures[`${cls.level}-t2`];

    for (let si = 0; si < students.length; si++) {
      const student = students[si];
      const r1 = rand(student._globalIdx * 3001 + 1);
      const r2 = rand(student._globalIdx * 5003 + 2);

      // Term 1 payment
      if (fsT1) {
        const status    = STATUSES_T1[Math.floor(r1 * STATUSES_T1.length)];
        const method    = METHODS[Math.floor(rand(student._globalIdx * 7 + 1) * METHODS.length)];
        const fullAmt   = fsT1.amount;
        const paidAmt   = status === 'FULLY_PAID' ? fullAmt
                        : status === 'HALF_PAID'  ? fullAmt / 2
                        : status === 'PARTIAL'    ? Math.round(fullAmt * 0.3)
                        : 0;

        const existing = await prisma.feePayment.findFirst({ where: { studentId: student.id, termId: term1.id } });
        if (!existing && paidAmt > 0) {
          await prisma.feePayment.create({
            data: {
              studentId:     student.id,
              feeStructureId: fsT1.id,
              termId:        term1.id,
              amountPaid:    paidAmt,
              paymentStatus: status,
              paymentMethod: method,
              receiptNumber: `RCP-2025-${String(rcpSeq++).padStart(4,'0')}`,
              paidAt:        new Date(`2025-09-${String(8 + Math.floor(r1*20)).padStart(2,'0')}T09:00:00`),
            },
          });
          total++;
        }
      }

      // Term 2 payment
      if (fsT2) {
        const status    = STATUSES_T2[Math.floor(r2 * STATUSES_T2.length)];
        const method    = METHODS[Math.floor(rand(student._globalIdx * 11 + 2) * METHODS.length)];
        const fullAmt   = fsT2.amount;
        const paidAmt   = status === 'FULLY_PAID' ? fullAmt
                        : status === 'HALF_PAID'  ? fullAmt / 2
                        : status === 'PARTIAL'    ? Math.round(fullAmt * 0.35)
                        : 0;

        const existing = await prisma.feePayment.findFirst({ where: { studentId: student.id, termId: term2.id } });
        if (!existing && paidAmt > 0) {
          await prisma.feePayment.create({
            data: {
              studentId:     student.id,
              feeStructureId: fsT2.id,
              termId:        term2.id,
              amountPaid:    paidAmt,
              paymentStatus: status,
              paymentMethod: method,
              receiptNumber: `RCP-2026-${String(rcpSeq++).padStart(4,'0')}`,
              paidAt:        new Date(`2026-01-${String(12 + Math.floor(r2*20)).padStart(2,'0')}T10:00:00`),
            },
          });
          total++;
        }
      }
    }
  }
  console.log(`  ✓ ${total} fee payment records seeded`);
}

async function seedAnnouncements() {
  console.log('\n📢 Seeding announcements...');
  let created = 0;
  for (const a of ANNOUNCEMENTS_DATA) {
    const existing = await prisma.announcement.findFirst({ where: { title: a.title } });
    if (existing) continue;
    await prisma.announcement.create({ data: a });
    created++;
  }
  console.log(`  ✓ ${created} announcements created`);
}

async function seedTerm2Assessments(allStudents, classes, subjects, term2, adminTeacher) {
  console.log('\n📋 Seeding Term 2 in-progress assessments (JHS classes)...');
  const classesForAssessments = ['JHS 1','JHS 2','JHS 3'];
  const template = { name: 'Class Test 1', type: 'TEST', totalMark: 30 };
  let assessmentCount = 0;
  let scoreCount = 0;

  for (const className of classesForAssessments) {
    const cls      = classes[className];
    const students = allStudents[className] || [];
    if (!cls || students.length === 0) continue;

    for (const subjectCode of ['MATH','ENG','SCI']) {
      const subject = subjects[subjectCode];
      if (!subject) continue;

      const assessDate = new Date('2026-02-03');
      const assessmentName = `${template.name} — ${subject.name}`;

      let assessment = await prisma.assessment.findFirst({
        where: { name: assessmentName, classId: cls.id, termId: term2.id },
      });
      if (!assessment) {
        assessment = await prisma.assessment.create({
          data: {
            name:        assessmentName,
            type:        template.type,
            totalMark:   template.totalMark,
            date:        assessDate,
            classId:     cls.id,
            subjectId:   subject.id,
            termId:      term2.id,
            createdById: adminTeacher.userId,
          },
        });
        assessmentCount++;
      }

      const scoreRecords = students.map((student) => ({
        assessmentId: assessment.id,
        studentId:    student.id,
        score:        Math.min(Math.round(talent(student._globalIdx) * template.totalMark), template.totalMark),
      }));
      await prisma.assessmentScore.createMany({ data: scoreRecords, skipDuplicates: true });
      scoreCount += scoreRecords.length;
    }
  }
  console.log(`  ✓ ${assessmentCount} Term 2 assessments, ${scoreCount} scores`);
}

// ════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════

async function main() {
  console.log("\n🦅 ════════════════════════════════════════════════════════");
  console.log("   Eagle's Nest International School — Database Seed");
  console.log("   🦅 ════════════════════════════════════════════════════\n");

  const [adminHash, teacherHash, parentHash] = await Promise.all([
    bcrypt.hash(ADMIN_PW,   10),
    bcrypt.hash(TEACHER_PW, 10),
    bcrypt.hash(PARENT_PW,  10),
  ]);

  const terms    = await seedTerms();
  const classes  = await seedClasses();
  const subjects = await seedSubjects();

  const adminTeacher = await seedAdmin(adminHash);
  const teachers     = await seedTeachers(teacherHash, classes);

  await seedSubjectTeachers(teachers, classes, subjects);
  await seedTimetable(classes, subjects);

  const allStudents = await seedStudents(classes);
  await seedParents(allStudents, classes, parentHash);

  const term1 = terms['First Term-2025'];
  const term2 = terms['Second Term-2026'];

  await seedAttendance(allStudents, term2);
  await seedTeacherAttendance(teachers, term2);
  await seedTerm1Results(allStudents, classes, subjects, term1);
  await seedTerm1Assessments(allStudents, classes, subjects, term1, adminTeacher);
  await seedTerm2Assessments(allStudents, classes, subjects, term2, adminTeacher);
  await seedTermRemarks(allStudents, classes, subjects, term1);

  const feeStructures = await seedFeeStructures(terms, classes);
  await seedFeePayments(allStudents, classes, feeStructures, terms);

  await seedAnnouncements();

  console.log('\n✅ ═══════════════════════════════════════════');
  console.log("   Seed complete! Eagle's Nest is ready.");
  console.log('   ═══════════════════════════════════════════\n');
  console.log('   Login credentials:');
  console.log(`   Admin:   0244100001 / ${ADMIN_PW}`);
  console.log(`   Teacher: 0244100002 / ${TEACHER_PW}  (any teacher phone)`);
  console.log(`   Parent:  0201001035 / ${PARENT_PW}   (any parent phone)`);
  console.log('');
}

main()
  .catch((err) => {
    console.error('\n❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
