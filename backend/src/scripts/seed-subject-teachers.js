/**
 * Seed script: Assign subjects to teachers per class.
 * Run: node src/scripts/seed-subject-teachers.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CORE_SUBJECTS = ['Mathematics', 'English Language', 'Integrated Science', 'Social Studies'];
const ELECTIVES = ['RME', 'Creative Arts', 'ICT'];

async function main() {
  console.log('Seeding subject-teacher assignments...');

  const [classes, teachers, subjects] = await Promise.all([
    prisma.class.findMany({ orderBy: { name: 'asc' } }),
    prisma.teacher.findMany({ include: { classTeacherOf: true }, orderBy: { staffId: 'asc' } }),
    prisma.subject.findMany(),
  ]);

  if (classes.length === 0) {
    console.log('No classes found. Run seed-classes first.');
    return;
  }
  if (teachers.length === 0) {
    console.log('No teachers found. Run seed-teachers first.');
    return;
  }
  if (subjects.length === 0) {
    console.log('No subjects found. Run seed-subjects first.');
    return;
  }

  const subjectByName = new Map(subjects.map((s) => [s.name, s]));

  for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {
    const cls = classes[classIndex];

    const classTeacher = teachers.find((t) => t.id === cls.classTeacherId) || teachers[classIndex % teachers.length];
    const secondaryTeacher = teachers[(classIndex + 1) % teachers.length];

    const subjectNames = [...CORE_SUBJECTS, ...ELECTIVES];

    for (let i = 0; i < subjectNames.length; i += 1) {
      const name = subjectNames[i];
      const subject = subjectByName.get(name);
      if (!subject) continue;

      const teacherForSubject = i < CORE_SUBJECTS.length ? classTeacher : secondaryTeacher;

      try {
        await prisma.subjectTeacher.upsert({
          where: {
            teacherId_subjectId_classId: {
              teacherId: teacherForSubject.id,
              subjectId: subject.id,
              classId: cls.id,
            },
          },
          update: {},
          create: {
            teacherId: teacherForSubject.id,
            subjectId: subject.id,
            classId: cls.id,
          },
        });

        console.log(`✓ ${cls.name}: ${name} -> ${teacherForSubject.staffId}`);
      } catch (error) {
        console.error(`✗ Failed assignment (${cls.name}, ${name}):`, error.message);
      }
    }
  }

  console.log('Subject-teacher seed completed.');
}

main()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
