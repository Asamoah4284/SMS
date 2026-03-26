/**
 * Seed script: Initialize students for one class or all classes (demo)
 * Run (single class): node src/scripts/seed-students.js <classId>
 * Run (all classes):  node src/scripts/seed-students.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SAMPLE_STUDENTS = [
  {
    firstName: 'Ama',
    lastName: 'Boateng',
    dateOfBirth: '2015-06-15',
    gender: 'FEMALE',
  },
  {
    firstName: 'Kwasi',
    lastName: 'Mensah',
    dateOfBirth: '2015-08-22',
    gender: 'MALE',
  },
  {
    firstName: 'Abena',
    lastName: 'Oppong',
    dateOfBirth: '2015-11-30',
    gender: 'FEMALE',
  },
  {
    firstName: 'Kofi',
    lastName: 'Asante',
    dateOfBirth: '2015-07-10',
    gender: 'MALE',
  },
  {
    firstName: 'Ekua',
    lastName: 'Darko',
    dateOfBirth: '2015-09-05',
    gender: 'FEMALE',
  },
  {
    firstName: 'Kojo',
    lastName: 'Nkrumah',
    dateOfBirth: '2015-05-16',
    gender: 'MALE',
  },
  {
    firstName: 'Afia',
    lastName: 'Owusu',
    dateOfBirth: '2015-04-21',
    gender: 'FEMALE',
  },
];

function addYears(dateStr, years) {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

async function getNextStudentNumber() {
  const year = new Date().getFullYear();
  const prefix = `STM-${year}-`;
  const last = await prisma.student.findFirst({
    where: { studentId: { startsWith: prefix } },
    orderBy: { studentId: 'desc' },
  });

  if (!last) return 1;
  const seq = parseInt(last.studentId.split('-')[2], 10);
  return Number.isNaN(seq) ? 1 : seq + 1;
}

function createStudentId(seq) {
  const year = new Date().getFullYear();
  return `STM-${year}-${String(seq).padStart(3, '0')}`;
}

async function seedForClass(classData, classIndex, nextSeqRef) {
  let createdCount = 0;
  console.log(`\nSeeding students for ${classData.name}...`);

  for (let i = 0; i < SAMPLE_STUDENTS.length; i += 1) {
    const template = SAMPLE_STUDENTS[i];

    // Shift DOB per class to avoid unrealistic same-age data across all levels.
    const dob = addYears(template.dateOfBirth, -(classIndex % 6));

    // Add suffix to keep names unique across classes.
    const firstName = `${template.firstName} ${classData.name}`;
    const lastName = template.lastName;

    const existing = await prisma.student.findFirst({
      where: { firstName, lastName, classId: classData.id },
    });

    if (existing) {
      console.log(`✓ ${firstName} ${lastName} already exists in ${classData.name}`);
      continue;
    }

    const studentId = createStudentId(nextSeqRef.value);
    nextSeqRef.value += 1;

    await prisma.student.create({
      data: {
        studentId,
        firstName,
        lastName,
        dateOfBirth: dob,
        gender: template.gender,
        classId: classData.id,
      },
    });

    createdCount += 1;
    console.log(`✓ Created: ${firstName} ${lastName} (${studentId})`);
  }

  return createdCount;
}

async function main() {
  const classId = process.argv[2];

  const targets = [];
  if (classId) {
    const singleClass = await prisma.class.findUnique({ where: { id: classId } });
    if (!singleClass) {
      console.error(`❌ Class with ID ${classId} not found`);
      process.exit(1);
    }
    targets.push(singleClass);
  } else {
    const classes = await prisma.class.findMany({ orderBy: { name: 'asc' } });
    if (classes.length === 0) {
      console.error('❌ No classes found. Run seed-classes first.');
      process.exit(1);
    }
    targets.push(...classes);
  }

  const seqRef = { value: await getNextStudentNumber() };
  let totalCreated = 0;

  for (let i = 0; i < targets.length; i += 1) {
    try {
      totalCreated += await seedForClass(targets[i], i, seqRef);
    } catch (error) {
      console.error(`✗ Failed seeding students for ${targets[i].name}:`, error.message);
    }
  }

  console.log(`\n🎉 Student seed completed. Newly created: ${totalCreated}`);
}

main()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
