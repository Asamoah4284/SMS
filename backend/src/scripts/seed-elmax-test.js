/**
 * Comprehensive test seed for Elmax school.
 * Creates: admin, term, classes, subjects, teacher, students, parent, attendance, results, timetable.
 *
 * Run: node src/scripts/seed-elmax-test.js
 *
 * Test credentials (parent app):
 *   Phone: 0201234567
 *   → Select child: Kwame Mensah (ELM-B4-001)
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const CLASSES = [
  { name: 'Nursery 1', level: 'NURSERY_1', classNumber: 1 },
  { name: 'Nursery 2', level: 'NURSERY_2', classNumber: 2 },
  { name: 'KG 1', level: 'KG_1', classNumber: 3 },
  { name: 'KG 2', level: 'KG_2', classNumber: 4 },
  { name: 'Class 1', level: 'BASIC_1', classNumber: 5 },
  { name: 'Class 2', level: 'BASIC_2', classNumber: 6 },
  { name: 'Class 3', level: 'BASIC_3', classNumber: 7 },
  { name: 'Class 4', level: 'BASIC_4', classNumber: 8 },
  { name: 'Class 5', level: 'BASIC_5', classNumber: 9 },
  { name: 'Class 6', level: 'BASIC_6', classNumber: 10 },
  { name: 'JHS 1', level: 'JHS_1', classNumber: 11 },
  { name: 'JHS 2', level: 'JHS_2', classNumber: 12 },
  { name: 'JHS 3', level: 'JHS_3', classNumber: 13 },
];

const SUBJECTS = [
  'English Language',
  'Mathematics',
  'Integrated Science',
  'Social Studies',
  'Computing / ICT',
  'Creative Arts',
  'Ghanaian Language (Twi)',
  'Religious & Moral Education',
  'French',
  'Physical Education',
];

const STUDENTS = [
  { firstName: 'Kwame', lastName: 'Mensah', gender: 'MALE', studentId: 'ELM-B4-001' },
  { firstName: 'Ama', lastName: 'Owusu', gender: 'FEMALE', studentId: 'ELM-B4-002' },
  { firstName: 'Kofi', lastName: 'Asante', gender: 'MALE', studentId: 'ELM-B4-003' },
  { firstName: 'Adwoa', lastName: 'Boateng', gender: 'FEMALE', studentId: 'ELM-B4-004' },
  { firstName: 'Yaw', lastName: 'Darko', gender: 'MALE', studentId: 'ELM-B4-005' },
];

const DAYS = [1, 2, 3, 4, 5]; // Mon–Fri

async function main() {
  console.log('🌱 Seeding Elmax test data...\n');

  // 1. Term
  console.log('→ Creating term...');
  const term = await prisma.term.upsert({
    where: { name_year: { name: 'First Term', year: 2026 } },
    update: { isCurrent: true, startDate: new Date('2026-01-06'), endDate: new Date('2026-04-10') },
    create: {
      name: 'First Term',
      year: 2026,
      startDate: new Date('2026-01-06'),
      endDate: new Date('2026-04-10'),
      isCurrent: true,
    },
  });
  console.log(`  ✓ Term: ${term.name} ${term.year}`);

  // 2. Admin user
  console.log('→ Creating admin...');
  const hashedPw = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { phone: '0200000000' },
    update: {},
    create: {
      phone: '0200000000',
      firstName: 'Admin',
      lastName: 'Elmax',
      password: hashedPw,
      role: 'ADMIN',
    },
  });
  console.log(`  ✓ Admin: ${adminUser.phone} / admin123`);

  // 3. Classes
  console.log('→ Creating classes...');
  const classMap = {};
  for (const c of CLASSES) {
    const cls = await prisma.class.upsert({
      where: { level_section: { level: c.level, section: '' } },
      update: { name: c.name, classNumber: c.classNumber },
      create: { name: c.name, level: c.level, classNumber: c.classNumber, section: '' },
    });
    classMap[c.level] = cls;
    console.log(`  ✓ ${cls.name}`);
  }

  const targetClass = classMap['BASIC_4'];

  // 4. Subjects
  console.log('→ Creating subjects...');
  const subjectMap = {};
  for (const name of SUBJECTS) {
    const subj = await prisma.subject.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    subjectMap[name] = subj;
    console.log(`  ✓ ${subj.name}`);
  }

  // 5. Teacher
  console.log('→ Creating teacher...');
  const teacherUser = await prisma.user.upsert({
    where: { phone: '0209999999' },
    update: {},
    create: {
      phone: '0209999999',
      firstName: 'Grace',
      lastName: 'Appiah',
      password: hashedPw,
      role: 'TEACHER',
    },
  });
  const teacher = await prisma.teacher.upsert({
    where: { userId: teacherUser.id },
    update: {},
    create: {
      userId: teacherUser.id,
      staffId: 'ELM-T-001',
    },
  });
  console.log(`  ✓ Teacher: ${teacherUser.firstName} ${teacherUser.lastName}`);

  // Assign as class teacher
  await prisma.class.update({
    where: { id: targetClass.id },
    data: { classTeacherId: teacher.id },
  });

  // Assign teacher to subjects for this class
  for (const name of SUBJECTS.slice(0, 5)) {
    await prisma.subjectTeacher.upsert({
      where: {
        teacherId_subjectId_classId: {
          teacherId: teacher.id,
          subjectId: subjectMap[name].id,
          classId: targetClass.id,
        },
      },
      update: {},
      create: {
        teacherId: teacher.id,
        subjectId: subjectMap[name].id,
        classId: targetClass.id,
      },
    });
  }

  // 6. Parent
  console.log('→ Creating parent...');
  const parentUser = await prisma.user.upsert({
    where: { phone: '0201234567' },
    update: {},
    create: {
      phone: '0201234567',
      firstName: 'Joseph',
      lastName: 'Mensah',
      password: hashedPw,
      role: 'PARENT',
    },
  });
  const parent = await prisma.parent.upsert({
    where: { userId: parentUser.id },
    update: {},
    create: { userId: parentUser.id },
  });
  console.log(`  ✓ Parent: ${parentUser.firstName} ${parentUser.lastName} (${parentUser.phone})`);

  // 7. Students
  console.log('→ Creating students...');
  const studentRecords = [];
  for (const s of STUDENTS) {
    const student = await prisma.student.upsert({
      where: { studentId: s.studentId },
      update: { classId: targetClass.id },
      create: {
        studentId: s.studentId,
        firstName: s.firstName,
        lastName: s.lastName,
        gender: s.gender,
        classId: targetClass.id,
        parentId: s.studentId === 'ELM-B4-001' ? parent.id : null,
        parentPhone: '0201234567',
        dateOfBirth: new Date('2016-03-15'),
      },
    });
    studentRecords.push(student);
    console.log(`  ✓ ${s.firstName} ${s.lastName} (${s.studentId})`);
  }

  // 8. Fee structure
  console.log('→ Creating fee structure...');
  const fee = await prisma.feeStructure.upsert({
    where: { id: 'elmax-tuition-b4' },
    update: {},
    create: {
      id: 'elmax-tuition-b4',
      name: 'Tuition Fee - Class 4',
      amount: 850.00,
      category: 'TUITION',
      classLevel: 'BASIC_4',
      termId: term.id,
    },
  });
  console.log(`  ✓ Fee: ${fee.name} — GH₵${fee.amount}`);

  // 9. Attendance (last 20 school days for all students)
  console.log('→ Creating attendance records...');
  const statuses = ['PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'LATE', 'ABSENT'];
  for (const student of studentRecords) {
    for (let d = 0; d < 20; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      await prisma.attendance.upsert({
        where: {
          studentId_date: { studentId: student.id, date: new Date(date.toISOString().split('T')[0]) },
        },
        update: { status },
        create: {
          studentId: student.id,
          date: new Date(date.toISOString().split('T')[0]),
          status,
          termId: term.id,
        },
      });
    }
  }
  console.log(`  ✓ Attendance seeded for ${studentRecords.length} students`);

  // 10. Results
  console.log('→ Creating results...');
  const grades = [
    { min: 80, grade: 'A', remarks: 'Excellent' },
    { min: 70, grade: 'B', remarks: 'Very Good' },
    { min: 60, grade: 'C', remarks: 'Good' },
    { min: 50, grade: 'D', remarks: 'Satisfactory' },
    { min: 0, grade: 'F', remarks: 'Needs Improvement' },
  ];

  for (const student of studentRecords) {
    for (const name of SUBJECTS) {
      const classScore = Math.floor(Math.random() * 20) + 20;
      const examScore = Math.floor(Math.random() * 30) + 30;
      const totalScore = classScore + examScore;
      const g = grades.find(gr => totalScore >= gr.min) || grades[grades.length - 1];

      await prisma.result.upsert({
        where: {
          studentId_subjectId_termId: {
            studentId: student.id,
            subjectId: subjectMap[name].id,
            termId: term.id,
          },
        },
        update: { classScore, examScore, totalScore, grade: g.grade, remarks: g.remarks },
        create: {
          studentId: student.id,
          subjectId: subjectMap[name].id,
          termId: term.id,
          classScore,
          examScore,
          totalScore,
          grade: g.grade,
          remarks: g.remarks,
        },
      });
    }
  }
  console.log(`  ✓ Results seeded for ${studentRecords.length} students × ${SUBJECTS.length} subjects`);

  // 11. Timetable
  console.log('→ Creating timetable...');
  const periods = [
    { startTime: '08:00', endTime: '08:45' },
    { startTime: '08:45', endTime: '09:30' },
    { startTime: '10:00', endTime: '10:45' },
    { startTime: '10:45', endTime: '11:30' },
    { startTime: '11:30', endTime: '12:15' },
  ];

  for (const day of DAYS) {
    for (let p = 0; p < periods.length; p++) {
      const subjectName = SUBJECTS[(day * 3 + p) % SUBJECTS.length];
      const subj = subjectMap[subjectName];
      await prisma.timetable.upsert({
        where: {
          classId_dayOfWeek_startTime: {
            classId: targetClass.id,
            dayOfWeek: day,
            startTime: periods[p].startTime,
          },
        },
        update: {},
        create: {
          classId: targetClass.id,
          subjectId: subj.id,
          dayOfWeek: day,
          startTime: periods[p].startTime,
          endTime: periods[p].endTime,
        },
      }).catch(() => {});
    }
  }
  console.log(`  ✓ Timetable seeded`);

  // 12. Announcements
  console.log('→ Creating announcements...');
  const announcements = [
    { title: 'Welcome Back to School!', content: 'We are excited to welcome all students back for the new term. Classes begin promptly at 8:00 AM.', targetAudience: 'ALL' },
    { title: 'PTA Meeting This Friday', content: 'All parents are invited to the Parent-Teacher Association meeting this Friday at 2:00 PM in the school hall.', targetAudience: 'PARENTS' },
    { title: 'Mid-Term Exams Schedule', content: 'Mid-term examinations will begin on March 15th. Please ensure your wards are well-prepared.', targetAudience: 'ALL' },
  ];
  for (const a of announcements) {
    await prisma.announcement.create({ data: a }).catch(() => {});
  }
  console.log(`  ✓ ${announcements.length} announcements created`);

  console.log('\n🎉 Elmax test seed complete!\n');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  PARENT APP LOGIN                           ║');
  console.log('║  Phone: 0201234567                          ║');
  console.log('║  Child: Kwame Mensah (ELM-B4-001)           ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  ADMIN LOGIN (web)                          ║');
  console.log('║  Phone: 0200000000                          ║');
  console.log('║  Password: admin123                         ║');
  console.log('╚══════════════════════════════════════════════╝');
}

main()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
