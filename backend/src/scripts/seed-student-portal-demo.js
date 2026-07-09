/**
 * Seed demo data for testing the student portal + CBT exams.
 *
 * Run:  npm run seed:student-portal
 *
 * What it does:
 *   1. Ensures portal (PIN 1234) for the first 3 students in a class
 *   2. Creates a published sample online exam for that class
 *
 * Env (optional):
 *   DEMO_CLASS=Class 4   — class name (default: Class 4)
 *   DEMO_PIN=1234        — default PIN for new portal accounts
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { PrismaClient } = require('@prisma/client');
const { ensureStudentPortal } = require('../utils/studentPortal');

const prisma = new PrismaClient();

const DEMO_CLASS = process.env.DEMO_CLASS || 'Class 4';
const DEMO_PIN = process.env.DEMO_PIN || '1234';

const DEMO_QUESTIONS = [
  {
    type: 'MCQ_SINGLE',
    text: 'What is 12 + 8?',
    marks: 2,
    order: 1,
    options: [
      { text: '18', isCorrect: false },
      { text: '20', isCorrect: true },
      { text: '22', isCorrect: false },
      { text: '24', isCorrect: false },
    ],
  },
  {
    type: 'MCQ_SINGLE',
    text: 'How many sides does a triangle have?',
    marks: 2,
    order: 2,
    options: [
      { text: '2', isCorrect: false },
      { text: '3', isCorrect: true },
      { text: '4', isCorrect: false },
      { text: '5', isCorrect: false },
    ],
  },
  {
    type: 'TRUE_FALSE',
    text: '100 is greater than 50.',
    marks: 1,
    order: 3,
    options: [
      { text: 'True', isCorrect: true },
      { text: 'False', isCorrect: false },
    ],
  },
];

async function addDemoQuestions(examId) {
  let totalMarks = 0;
  for (const q of DEMO_QUESTIONS) {
    const question = await prisma.examQuestion.create({
      data: {
        examId,
        type: q.type,
        text: q.text,
        marks: q.marks,
        order: q.order,
      },
    });
    totalMarks += q.marks;
    await prisma.examOption.createMany({
      data: q.options.map((o) => ({
        questionId: question.id,
        text: o.text,
        isCorrect: o.isCorrect,
      })),
    });
  }
  await prisma.onlineExam.update({
    where: { id: examId },
    data: { totalMarks },
  });
}

async function ensureDemoExam({ classId, subjectId, termId, createdById }) {
  const existing = await prisma.onlineExam.findFirst({
    where: {
      classId,
      title: 'Demo CBT — Mathematics Quiz',
      status: 'PUBLISHED',
    },
  });
  if (existing) {
    const qCount = await prisma.examQuestion.count({ where: { examId: existing.id } });
    if (qCount === 0) {
      // Exam shell exists but has no questions — backfill demo questions
      await addDemoQuestions(existing.id);
      const updated = await prisma.onlineExam.findUnique({ where: { id: existing.id } });
      return { exam: updated, created: false, backfilled: true };
    }
    return { exam: existing, created: false };
  }

  const now = new Date();
  const endAt = new Date(now);
  endAt.setDate(endAt.getDate() + 14);

  const exam = await prisma.onlineExam.create({
    data: {
      title: 'Demo CBT — Mathematics Quiz',
      description: 'Sample exam for testing the student portal. Auto-graded multiple choice.',
      instructions: 'Answer all questions. You have 30 minutes.',
      durationMinutes: 30,
      startAt: now,
      endAt,
      status: 'PUBLISHED',
      classId,
      subjectId,
      termId,
      createdById,
      totalMarks: 0,
    },
  });

  await addDemoQuestions(exam.id);

  const updated = await prisma.onlineExam.findUnique({ where: { id: exam.id } });
  return { exam: updated, created: true };
}

async function main() {
  console.log('\n🎓 Student portal demo seed\n');

  const term = await prisma.term.findFirst({ where: { isCurrent: true } });
  if (!term) {
    throw new Error('No current term found. Run npm run db:seed first.');
  }

  const cls = await prisma.class.findFirst({ where: { name: DEMO_CLASS } });
  if (!cls) {
    const names = await prisma.class.findMany({ select: { name: true }, orderBy: { name: 'asc' } });
    throw new Error(
      `Class "${DEMO_CLASS}" not found. Available: ${names.map((c) => c.name).join(', ')}`
    );
  }

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) {
    throw new Error('No admin user found. Run npm run db:seed first.');
  }

  const subject =
    (await prisma.subject.findFirst({ where: { name: 'Mathematics' } })) ||
    (await prisma.subject.findFirst());

  if (!subject) {
    throw new Error('No subjects found. Run npm run db:seed first.');
  }

  const students = await prisma.student.findMany({
    where: { classId: cls.id, isActive: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    take: 3,
  });

  if (students.length === 0) {
    throw new Error(`No active students in ${DEMO_CLASS}.`);
  }

  console.log(`Class: ${cls.name}`);
  console.log(`Term:  ${term.name} ${term.year}\n`);

  const enabled = [];
  for (const s of students) {
    const result = await ensureStudentPortal(prisma, s, {
      pin: DEMO_PIN,
      mustChangePin: false,
    });
    enabled.push({
      studentId: s.studentId,
      name: `${s.firstName} ${s.lastName}`,
      status: result.created ? 'enabled now' : 'already enabled',
    });
  }

  const { exam, created } = await ensureDemoExam({
    classId: cls.id,
    subjectId: subject.id,
    termId: term.id,
    createdById: admin.id,
  });

  console.log('── Portal accounts (login at /student/login) ──');
  for (const e of enabled) {
    console.log(`  ${e.studentId}  ${e.name}  (${e.status})`);
  }
  console.log(`  PIN: ${DEMO_PIN}\n`);

  console.log('── Demo exam ──');
  console.log(`  "${exam.title}" — ${created ? 'created' : 'already exists'}`);
  console.log(`  Status: PUBLISHED · Subject: ${subject.name}\n`);

  console.log('── How to test ──');
  console.log('  1. Staff: http://localhost:3000/online-exams (view results after student submits)');
  console.log('  2. Student: http://localhost:3000/student/login');
  console.log(`  3. Use Student ID + PIN above (student in ${DEMO_CLASS})`);
  console.log('  4. Dashboard → Start Exam → submit answers\n');
}

main()
  .catch((err) => {
    console.error('❌', err.message || err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
