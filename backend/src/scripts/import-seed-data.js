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
const { generateStudentId, getPrefix } = require('../utils/studentId');
const { ensureStudentPortal, DEFAULT_STUDENT_PIN } = require('../utils/studentPortal');

const prisma = new PrismaClient();
const DATA_DIR = path.join(__dirname, '../../seed-data');

function normalisePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) return '0' + digits.slice(3);
  return digits.length === 10 ? digits : raw.trim();
}

async function importSchool() {
  const rows = readCsv(path.join(DATA_DIR, 'school.csv'));
  if (!rows?.length) {
    console.log('  ⚠ school.csv missing — using defaults');
    return { idPrefix: getPrefix() };
  }
  const row = rows[0];
  const idPrefix = (row.id_prefix || ID_PREFIX).toUpperCase();
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
    const data = {
      name: row.class_name,
      classNumber,
      level: row.level,
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

  for (const row of rows) {
    const cls = classes[row.class_name];
    if (!cls) {
      console.warn(`  ⚠ Student ${row.first_name} ${row.last_name}: class "${row.class_name}" not found`);
      continue;
    }

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

    const studentId = await generateStudentId(prisma, cls.id);
    const normPhone = normalisePhone(row.parent_phone);

    const student = await prisma.student.create({
      data: {
        studentId,
        firstName: row.first_name,
        lastName: row.last_name,
        gender: String(row.gender).toUpperCase(),
        dateOfBirth: row.date_of_birth ? new Date(row.date_of_birth) : null,
        address: row.address || null,
        classId: cls.id,
        parentName: row.parent_name || null,
        parentPhone: normPhone,
      },
    });

    await ensureStudentPortal(prisma, student, { mustChangePin: false });
    created++;
    console.log(`  ✓ Student: ${studentId} — ${row.first_name} ${row.last_name}`);
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
  console.log(`  Student: Student ID from import (e.g. ${school.idPrefix}-7-001) / PIN ${DEFAULT_STUDENT_PIN}`);
  console.log('           Portal: http://localhost:3000/student/login');
  console.log('');
}

main()
  .catch((err) => {
    console.error('\n❌ Import failed:', err.message || err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
