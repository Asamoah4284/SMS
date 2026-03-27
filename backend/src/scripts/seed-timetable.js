/**
 * Seed script: Create timetable entries from subject-teacher assignments.
 * Run: node src/scripts/seed-timetable.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const SLOTS = [
  { startTime: '08:00', endTime: '08:40' },
  { startTime: '08:50', endTime: '09:30' },
  { startTime: '09:40', endTime: '10:20' },
  { startTime: '10:40', endTime: '11:20' },
  { startTime: '11:30', endTime: '12:10' },
  { startTime: '12:20', endTime: '13:00' },
];

async function main() {
  console.log('Seeding timetable...');

  const classes = await prisma.class.findMany({ orderBy: { name: 'asc' } });

  for (const cls of classes) {
    const assignments = await prisma.subjectTeacher.findMany({
      where: { classId: cls.id },
      include: { subject: true },
      orderBy: { subject: { name: 'asc' } },
    });

    if (assignments.length === 0) {
      console.log(`Skipped ${cls.name}: no subject-teacher assignments`);
      continue;
    }

    let cursor = 0;

    for (let day = 1; day <= 5; day += 1) {
      for (let slotIndex = 0; slotIndex < SLOTS.length; slotIndex += 1) {
        const slot = SLOTS[slotIndex];
        const assignment = assignments[cursor % assignments.length];
        cursor += 1;

        try {
          await prisma.timetable.upsert({
            where: {
              classId_dayOfWeek_startTime: {
                classId: cls.id,
                dayOfWeek: day,
                startTime: slot.startTime,
              },
            },
            update: {
              subjectId: assignment.subjectId,
              endTime: slot.endTime,
            },
            create: {
              classId: cls.id,
              subjectId: assignment.subjectId,
              dayOfWeek: day,
              startTime: slot.startTime,
              endTime: slot.endTime,
            },
          });
        } catch (error) {
          console.error(
            `✗ Failed timetable for ${cls.name} ${DAY_LABELS[day - 1]} ${slot.startTime}:`,
            error.message
          );
        }
      }
    }

    console.log(`✓ Timetable seeded for ${cls.name}`);
  }

  console.log('Timetable seed completed.');
}

main()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
