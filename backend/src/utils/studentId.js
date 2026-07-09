const DEFAULT_PREFIX = 'DASE';

function getPrefix(override) {
  return (override || process.env.SCHOOL_ID_PREFIX || DEFAULT_PREFIX).toUpperCase();
}

/**
 * Generate next student ID: {PREFIX}-{classNumber}-{NNN}
 * e.g. DASE-7-001 for class number 7, first student in that class.
 */
async function generateStudentId(prisma, classId, prefix) {
  const ID_PREFIX = getPrefix(prefix);
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { classNumber: true, name: true },
  });

  if (!cls?.classNumber) {
    throw new Error(`Class "${cls?.name || classId}" has no classNumber — set it in classes.csv or admin.`);
  }

  const head = `${prefix}-${cls.classNumber}-`;
  const last = await prisma.student.findFirst({
    where: { studentId: { startsWith: head } },
    orderBy: { studentId: 'desc' },
  });

  let seq = 1;
  if (last) {
    const part = last.studentId.split('-').pop();
    const n = parseInt(part, 10);
    if (!Number.isNaN(n)) seq = n + 1;
  }

  return `${head}${String(seq).padStart(3, '0')}`;
}

module.exports = { generateStudentId, getPrefix, DEFAULT_PREFIX };
