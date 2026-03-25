/**
 * Seed script: Initialize students for a class (demo)
 * Run: npx node src/scripts/seed-students.js <classId>
 * 
 * Creates sample students for testing
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SAMPLE_STUDENTS = [
  {
    studentId: 'STM-2025-001',
    firstName: 'Ama',
    lastName: 'Boateng',
    dateOfBirth: '2015-06-15',
    gender: 'FEMALE',
  },
  {
    studentId: 'STM-2025-002',
    firstName: 'Kwasi',
    lastName: 'Mensah',
    dateOfBirth: '2015-08-22',
    gender: 'MALE',
  },
  {
    studentId: 'STM-2025-003',
    firstName: 'Abena',
    lastName: 'Oppong',
    dateOfBirth: '2015-11-30',
    gender: 'FEMALE',
  },
  {
    studentId: 'STM-2025-004',
    firstName: 'Kofi',
    lastName: 'Asante',
    dateOfBirth: '2015-07-10',
    gender: 'MALE',
  },
  {
    studentId: 'STM-2025-005',
    firstName: 'Ekua',
    lastName: 'Darko',
    dateOfBirth: '2015-09-05',
    gender: 'FEMALE',
  },
];

async function main() {
  const classId = process.argv[2];

  if (!classId) {
    console.error('❌ Usage: npx node src/scripts/seed-students.js <classId>');
    process.exit(1);
  }

  // Verify class exists
  const classData = await prisma.class.findUnique({ where: { id: classId } });

  if (!classData) {
    console.error(`❌ Class with ID ${classId} not found`);
    process.exit(1);
  }

  console.log(`🌱 Adding sample students to ${classData.name}...`);

  for (const studentData of SAMPLE_STUDENTS) {
    try {
      // Check if student already exists
      const existing = await prisma.student.findFirst({
        where: {
          firstName: studentData.firstName,
          lastName: studentData.lastName,
          classId,
        },
      });

      if (existing) {
        console.log(`✓ ${studentData.firstName} ${studentData.lastName} already exists`);
        continue;
      }

      const created = await prisma.student.create({
        data: {
          ...studentData,
          classId,
        },
      });

      console.log(
        `✓ Created: ${created.firstName} ${created.lastName} (${created.studentId})`
      );
    } catch (error) {
      console.error(
        `✗ Failed to create ${studentData.firstName}:`,
        error.message
      );
    }
  }

  console.log(`🎉 Student seed completed for ${classData.name}!`);
}

main()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
