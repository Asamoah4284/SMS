/**
 * Move the "Mathematics" online exam from Class 1 to Class 4.
 * Run: node src/scripts/move-math-exam-to-class4.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const class4 = await prisma.class.findFirst({ where: { name: 'Class 4' } });
  if (!class4) throw new Error('Class 4 not found');

  const exam = await prisma.onlineExam.findFirst({
    where: { title: 'Mathematics' },
    include: { class: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  if (!exam) throw new Error('No exam titled "Mathematics" found');

  if (exam.classId === class4.id) {
    console.log(`Exam "${exam.title}" is already assigned to Class 4.`);
    return;
  }

  const updated = await prisma.onlineExam.update({
    where: { id: exam.id },
    data: { classId: class4.id },
    include: {
      class: { select: { name: true } },
      subject: { select: { name: true } },
    },
  });

  console.log(`Updated "${updated.title}" from ${exam.class.name} → ${updated.class.name}`);
  console.log(`Subject: ${updated.subject.name} · Status: ${updated.status}`);
}

main()
  .catch((e) => {
    console.error('❌', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
