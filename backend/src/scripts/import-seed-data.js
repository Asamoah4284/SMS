/**
 * Import school data from CSV files in backend/seed-data/
 *
 * Run: npm run db:import
 *
 * See seed-data/README.md for column definitions.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { readCsv, parseBool } = require('../utils/csv');
const { generateStudentId, getPrefix, renumberClassStudentIds, formatStudentId, classLevelToCode, sortNameKey } = require('../utils/studentId');
const { ensureStudentPortal, DEFAULT_STUDENT_PIN } = require('../utils/studentPortal');

const prisma = new PrismaClient();
const DATA_DIR = path.join(__dirname, '../../seed-data');

function normalisePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) return '0' + digits.slice(3);
  return digits.length === 10 ? digits : raw.trim();
}

function parseGender(raw) {
  const g = String(raw || '').trim().toUpperCase();
  if (g === 'MALE' || g === 'FEMALE') return g;
  const fallback = String(process.env.DEFAULT_STUDENT_GENDER || 'FEMALE').toUpperCase();
  return fallback === 'MALE' ? 'MALE' : 'FEMALE';
}

function parseOptionalDate(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function defaultParentName(row) {
  const name = String(row.parent_name || '').trim();
  return name || 'Guardian (update in dashboard)';
}

async function importSchool() {
  const rows = readCsv(path.join(DATA_DIR, 'school.csv'));
  if (!rows?.length) {
    console.log('  ⚠ school.csv missing — using defaults');
    return { idPrefix: getPrefix() };
  }
  const row = rows[0];
  const idPrefix = (row.id_prefix || getPrefix()).toUpperCase();
  process.env.SCHOOL_ID_PREFIX = idPrefix;
  console.log(`  ✓ School: ${row.school_name || 'Unnamed'} (ID prefix: ${idPrefix})`);
  return { idPrefix, row };
}

async function importTerms() {
  const rows = readCsv(path.join(DATA_DIR, 'terms.csv')) || [];
  const terms = {};
  for (const row of rows) {
    const key = `${row.term_name}-${row.year}`;
    const existing = await prisma.term.findFirst({
      where: { name: row.term_name, year: parseInt(row.year, 10) },
    });
    const data = {
      name: row.term_name,
      year: parseInt(row.year, 10),
      startDate: new Date(row.start_date),
      endDate: new Date(row.end_date),
      isCurrent: parseBool(row.is_current),
    };
    if (existing) {
      const updated = await prisma.term.update({ where: { id: existing.id }, data });
      terms[key] = updated;
    } else {
      const created = await prisma.term.create({ data });
      terms[key] = created;
    }
    console.log(`  ✓ Term: ${row.term_name} ${row.year}`);
  }
  if (rows.length) {
    await prisma.term.updateMany({ data: { isCurrent: false } });
    for (const row of rows) {
      if (!parseBool(row.is_current)) continue;
      const t = terms[`${row.term_name}-${row.year}`];
      if (t) await prisma.term.update({ where: { id: t.id }, data: { isCurrent: true } });
    }
  }
  return terms;
}

async function importClasses() {
  const rows = readCsv(path.join(DATA_DIR, 'classes.csv')) || [];
  const classes = {};
  for (const row of rows) {
    const classNumber = parseInt(row.class_number, 10);
    const level = String(row.level || '').trim().toUpperCase();
    if (!level) {
      throw new Error(`classes.csv: missing level for "${row.class_name}"`);
    }
    const data = {
      name: row.class_name,
      classNumber,
      level,
      section: row.section || null,
    };
    const existing = await prisma.class.findFirst({
      where: { OR: [{ classNumber }, { name: row.class_name }] },
    });
    const record = existing
      ? await prisma.class.update({ where: { id: existing.id }, data })
      : await prisma.class.create({ data });
    classes[row.class_name] = record;
    console.log(`  ✓ Class: ${row.class_name} (#${classNumber})`);
  }
  return classes;
}

async function importSubjects() {
  const rows = readCsv(path.join(DATA_DIR, 'subjects.csv')) || [];
  const subjects = {};
  for (const row of rows) {
    const existing = await prisma.subject.findFirst({
      where: { OR: [{ name: row.subject_name }, { code: row.subject_code }] },
    });
    const record = existing
      ? await prisma.subject.update({
          where: { id: existing.id },
          data: { name: row.subject_name, code: row.subject_code },
        })
      : await prisma.subject.create({
          data: { name: row.subject_name, code: row.subject_code },
        });
    subjects[row.subject_code] = record;
    console.log(`  ✓ Subject: ${row.subject_name}`);
  }
  return subjects;
}

async function importAdmin() {
  const rows = readCsv(path.join(DATA_DIR, 'admin.csv')) || [];
  if (!rows.length) throw new Error('admin.csv is required');
  const row = rows[0];
  const password = row.default_password || 'ChangeMe2026!';
  const hash = await bcrypt.hash(password, 10);

  let user = await prisma.user.findUnique({ where: { phone: row.phone } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        phone: row.phone,
        email: row.email || null,
        firstName: row.first_name,
        lastName: row.last_name,
        password: hash,
        role: 'ADMIN',
        mustChangePassword: true,
      },
    });
    console.log(`  ✓ Admin created: ${row.first_name} ${row.last_name} (${row.phone})`);
  } else {
    console.log(`  ✓ Admin exists: ${user.firstName} ${user.lastName}`);
  }
  return { user, defaultPassword: password };
}

async function importTeachers(classes) {
  const rows = readCsv(path.join(DATA_DIR, 'teachers.csv'));
  if (!rows?.length) {
    console.log('  — teachers.csv empty or missing (skipped)');
    return [];
  }
  const teachers = [];
  const defaultPw = process.env.TEACHER_DEFAULT_PASSWORD || 'teacher@dase';
  const hash = await bcrypt.hash(defaultPw, 10);

  for (const row of rows) {
    let user = await prisma.user.findUnique({ where: { phone: row.phone } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          phone: row.phone,
          email: row.email || null,
          firstName: row.first_name,
          lastName: row.last_name,
          password: hash,
          role: 'TEACHER',
        },
      });
    }

    let teacher = await prisma.teacher.findUnique({ where: { userId: user.id } });
    if (!teacher) {
      teacher = await prisma.teacher.create({
        data: {
          userId: user.id,
          staffId: row.staff_id,
          qualification: row.qualification || null,
        },
      });
    }

    const cls = classes[row.class_name];
    if (cls) {
      await prisma.class.update({
        where: { id: cls.id },
        data: { classTeacherId: teacher.id },
      });
    }

    teachers.push(teacher);
    console.log(`  ✓ Teacher: ${row.first_name} ${row.last_name}`);
  }
  return teachers;
}

async function importStudents(classes) {
  const rows = readCsv(path.join(DATA_DIR, 'students.csv')) || [];
  let created = 0;
  let skipped = 0;
  const prefix = getPrefix();

  const byClass = {};
  for (const row of rows) {
    const key = row.class_name;
    if (!byClass[key]) byClass[key] = [];
    byClass[key].push(row);
  }

  for (const [className, classRows] of Object.entries(byClass)) {
    const cls = classes[className];
    if (!cls) {
      for (const row of classRows) {
        console.warn(`  ⚠ Student ${row.first_name} ${row.last_name}: class "${className}" not found`);
      }
      continue;
    }

    const sorted = [...classRows].sort((a, b) =>
      sortNameKey({ firstName: a.first_name, lastName: a.last_name }).localeCompare(
        sortNameKey({ firstName: b.first_name, lastName: b.last_name })
      )
    );

    const classCode = classLevelToCode(cls.level, cls.name);

    for (let i = 0; i < sorted.length; i++) {
      const row = sorted[i];
      const registerSeq = i + 1;
      const studentId = formatStudentId(prefix, classCode, registerSeq);

      const existing = await prisma.student.findFirst({
        where: {
          firstName: row.first_name,
          lastName: row.last_name,
          classId: cls.id,
        },
      });
      if (existing) {
        await ensureStudentPortal(prisma, existing, { mustChangePin: false });
        skipped++;
        continue;
      }

      const normPhone = normalisePhone(row.parent_phone);
      const gender = parseGender(row.gender);
      const parentName = defaultParentName(row);
      const address = String(row.address || '').trim() || null;

      const student = await prisma.student.create({
        data: {
          studentId,
          firstName: row.first_name,
          lastName: row.last_name,
          gender,
          dateOfBirth: parseOptionalDate(row.date_of_birth),
          address,
          classId: cls.id,
          parentName,
          parentPhone: normPhone,
        },
      });

      await ensureStudentPortal(prisma, student, { mustChangePin: false });
      created++;
      console.log(`  ✓ Student: ${studentId} — ${row.first_name} ${row.last_name}`);
    }

    const { updated } = await renumberClassStudentIds(prisma, cls.id, prefix);
    if (updated > 0) {
      console.log(`  ↻ ${className}: aligned ${updated} register number(s) by name`);
    }
  }

  return { created, skipped };
}

async function main() {
  console.log('\n📥 Importing school data from seed-data/*.csv\n');

  const school = await importSchool();
  console.log('\n📅 Terms');
  await importTerms();
  console.log('\n🏫 Classes');
  const classes = await importClasses();
  console.log('\n📚 Subjects');
  await importSubjects();
  console.log('\n👑 Administrator');
  const { defaultPassword: adminPw } = await importAdmin();
  console.log('\n👩‍🏫 Teachers');
  await importTeachers(classes);
  console.log('\n🧒 Students');
  const { created, skipped } = await importStudents(classes);

  console.log('\n✅ Import complete\n');
  console.log('── Login ──');
  console.log(`  Admin:   phone from admin.csv / ${adminPw}`);
  console.log('           (you will be asked to change password on first login)');
  console.log(`  Student: Student ID from import (e.g. ${school.idPrefix}-Y1-001) / PIN ${DEFAULT_STUDENT_PIN}`);
  console.log('           Portal: http://localhost:3000/student/login');
  console.log('');
}

main()
  .catch((err) => {
    console.error('\n❌ Import failed:', err.message || err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
