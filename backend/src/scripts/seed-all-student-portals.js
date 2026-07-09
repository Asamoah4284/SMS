/**
 * Enable student portal for every student that doesn't have one yet.
 * Safe to re-run (idempotent).
 *
 * Run: npm run seed:student-portals
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { PrismaClient } = require('@prisma/client');
const { ensureStudentPortal, DEFAULT_STUDENT_PIN } = require('../utils/studentPortal');

const prisma = new PrismaClient();

async function main() {
  const students = await prisma.student.findMany({
    where: { isActive: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  let created = 0;
  let skipped = 0;

  for (const student of students) {
    const result = await ensureStudentPortal(prisma, student, {
      mustChangePin: false,
    });
    if (result.created) created++;
    else skipped++;
  }

  console.log(`\n✓ Student portals: ${created} created, ${skipped} already had access`);
  console.log(`  Default PIN for new accounts: ${DEFAULT_STUDENT_PIN}`);
  console.log(`  Login: /student/login with Student ID (e.g. ${students[0]?.studentId ?? 'STM-2026-001'})\n`);
}

main()
  .catch((err) => {
    console.error('❌', err.message || err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
