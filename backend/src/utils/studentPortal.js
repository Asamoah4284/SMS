const bcrypt = require('bcryptjs');

const DEFAULT_STUDENT_PIN = process.env.DEFAULT_STUDENT_PIN || '1234';

/**
 * Ensure a student has portal login (User + StudentProfile).
 * Idempotent — safe to call on create, seed, or re-run.
 */
async function ensureStudentPortal(
  prisma,
  student,
  { pin, mustChangePin = false } = {}
) {
  if (!student?.id || !student?.studentId) {
    throw new Error('Student id and studentId are required for portal setup');
  }

  const portalPin = pin ? String(pin) : DEFAULT_STUDENT_PIN;

  const existingProfile = await prisma.studentProfile.findUnique({
    where: { studentDbId: student.id },
  });
  if (existingProfile) {
    return {
      created: false,
      portalEnabled: true,
      studentId: student.studentId,
    };
  }

  const internalPhone = `STU-${student.studentId}`;
  let user = await prisma.user.findUnique({ where: { phone: internalPhone } });

  if (!user) {
    const hashed = await bcrypt.hash(portalPin, 10);
    user = await prisma.user.create({
      data: {
        phone: internalPhone,
        firstName: student.firstName,
        lastName: student.lastName,
        password: hashed,
        role: 'STUDENT',
      },
    });
  }

  const orphanProfile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
  });
  if (!orphanProfile) {
    await prisma.studentProfile.create({
      data: {
        userId: user.id,
        studentDbId: student.id,
        mustChangePin,
      },
    });
  }

  return {
    created: true,
    portalEnabled: true,
    studentId: student.studentId,
    defaultPin: portalPin,
  };
}

module.exports = { ensureStudentPortal, DEFAULT_STUDENT_PIN };
