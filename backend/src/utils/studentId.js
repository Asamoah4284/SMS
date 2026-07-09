const DEFAULT_PREFIX = 'DASE';

/** Class segment in student IDs, e.g. N1, Y3, KG2 */
const LEVEL_CODES = {
  CRECHE: 'CR',
  NURSERY_1: 'N1',
  NURSERY_2: 'N2',
  KG_1: 'KG1',
  KG_2: 'KG2',
  YEAR_1: 'Y1',
  YEAR_2: 'Y2',
  YEAR_3: 'Y3',
  YEAR_4: 'Y4',
  YEAR_5: 'Y5',
  YEAR_6: 'Y6',
  YEAR_7: 'Y7',
  YEAR_8: 'Y8',
  BASIC_1: 'B1',
  BASIC_2: 'B2',
  BASIC_3: 'B3',
  BASIC_4: 'B4',
  BASIC_5: 'B5',
  BASIC_6: 'B6',
  JHS_1: 'J1',
  JHS_2: 'J2',
  JHS_3: 'J3',
};

function getPrefix(override) {
  return (override || process.env.SCHOOL_ID_PREFIX || DEFAULT_PREFIX).toUpperCase();
}

/** Register sort: surname first, then first name (case-insensitive). */
function sortNameKey({ firstName, lastName }) {
  const last = String(lastName || '').trim().toLowerCase();
  const first = String(firstName || '').trim().toLowerCase();
  return `${last}\0${first}`;
}

function classLevelToCode(level, className) {
  if (level && LEVEL_CODES[level]) return LEVEL_CODES[level];

  const name = String(className || '').toLowerCase();
  if (name.includes('creche')) return 'CR';
  if (/nursery\s*1/.test(name)) return 'N1';
  if (/nursery\s*2/.test(name)) return 'N2';
  if (/kg\s*1/.test(name)) return 'KG1';
  if (/kg\s*2/.test(name)) return 'KG2';
  const yearMatch = name.match(/year\s*(\d+)/);
  if (yearMatch) return `Y${yearMatch[1]}`;
  const classMatch = name.match(/class\s*(\d+)/);
  if (classMatch) return `B${classMatch[1]}`;
  const jhsMatch = name.match(/jhs\s*(\d+)/);
  if (jhsMatch) return `J${jhsMatch[1]}`;

  throw new Error(
    `Cannot derive class code for "${className}" (level: ${level || 'unknown'}). Update LEVEL_CODES in studentId.js.`
  );
}

function formatStudentId(prefix, classCode, sequence) {
  return `${getPrefix(prefix)}-${classCode}-${String(sequence).padStart(3, '0')}`;
}

async function getClassMeta(prisma, classId) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, name: true, level: true, classNumber: true },
  });
  if (!cls) throw new Error('Class not found');
  const classCode = classLevelToCode(cls.level, cls.name);
  return { ...cls, classCode };
}

async function updateStudentIdAndPortal(tx, studentDbId, oldStudentId, newStudentId) {
  if (oldStudentId === newStudentId) return;

  const profile = await tx.studentProfile.findUnique({
    where: { studentDbId },
    include: { user: true },
  });

  if (profile?.user) {
    const newPhone = `STU-${newStudentId}`;
    const phoneTaken = await tx.user.findFirst({
      where: { phone: newPhone, id: { not: profile.user.id } },
    });
    if (phoneTaken) {
      throw new Error(`Portal phone ${newPhone} already in use — cannot renumber ${oldStudentId}`);
    }
    await tx.user.update({
      where: { id: profile.user.id },
      data: { phone: newPhone },
    });
  }

  await tx.student.update({
    where: { id: studentDbId },
    data: { studentId: newStudentId },
  });
}

/**
 * Renumber every student in a class by alphabetical register order.
 * Uses short per-student writes (safe on remote Postgres — no long transactions).
 */
async function renumberClassStudentIds(prisma, classId, prefix) {
  const { classCode } = await getClassMeta(prisma, classId);
  const students = await prisma.student.findMany({
    where: { classId, isActive: true },
    select: { id: true, studentId: true, firstName: true, lastName: true },
  });

  if (students.length === 0) return { updated: 0, classCode };

  const sorted = [...students]
    .sort((a, b) => sortNameKey(a).localeCompare(sortNameKey(b)))
    .map((s) => ({ ...s, originalStudentId: s.studentId }));

  const tempPrefix = `__REN_${Date.now()}_`;

  // Phase 1: temporary IDs so final IDs never collide during swap
  for (const s of sorted) {
    const tempId = `${tempPrefix}${s.id}`;
    if (s.studentId === tempId) continue;
    await prisma.student.update({
      where: { id: s.id },
      data: { studentId: tempId },
    });
  }

  let updated = 0;
  const txOpts = { timeout: 60_000, maxWait: 15_000 };

  // Phase 2: assign register numbers + sync portal login
  for (let i = 0; i < sorted.length; i++) {
    const newStudentId = formatStudentId(prefix, classCode, i + 1);
    const tempId = `${tempPrefix}${sorted[i].id}`;

    if (sorted[i].originalStudentId === newStudentId) {
      const current = await prisma.student.findUnique({
        where: { id: sorted[i].id },
        select: { studentId: true },
      });
      if (current?.studentId === newStudentId) continue;
    }

    await prisma.$transaction(
      async (tx) => {
        await updateStudentIdAndPortal(tx, sorted[i].id, tempId, newStudentId);
      },
      txOpts
    );

    if (sorted[i].originalStudentId !== newStudentId) updated++;
  }

  return { updated, classCode };
}

/**
 * Assign register number from alphabetical position (surname, first name).
 */
async function generateStudentId(prisma, classId, options = {}) {
  const { firstName, lastName, prefix, excludeStudentDbId } = options;
  const { classCode } = await getClassMeta(prisma, classId);

  if (!firstName?.trim() || !lastName?.trim()) {
    const head = `${getPrefix(prefix)}-${classCode}-`;
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
    return formatStudentId(prefix, classCode, seq);
  }

  const existing = await prisma.student.findMany({
    where: {
      classId,
      isActive: true,
      ...(excludeStudentDbId ? { id: { not: excludeStudentDbId } } : {}),
    },
    select: { firstName: true, lastName: true },
  });

  const roster = [
    ...existing.map((s) => ({ firstName: s.firstName, lastName: s.lastName })),
    { firstName: firstName.trim(), lastName: lastName.trim() },
  ];

  roster.sort((a, b) => sortNameKey(a).localeCompare(sortNameKey(b)));
  const index = roster.findIndex(
    (r) =>
      r.firstName.toLowerCase() === firstName.trim().toLowerCase() &&
      r.lastName.toLowerCase() === lastName.trim().toLowerCase()
  );

  const seq = index >= 0 ? index + 1 : roster.length;
  return formatStudentId(prefix, classCode, seq);
}

async function renumberAllClassStudentIds(prisma, prefix) {
  const classes = await prisma.class.findMany({
    select: { id: true, name: true },
    orderBy: { classNumber: 'asc' },
  });
  let total = 0;
  for (const cls of classes) {
    process.stdout.write(`  … ${cls.name}`);
    const { updated, classCode } = await renumberClassStudentIds(prisma, cls.id, prefix);
    total += updated;
    if (updated > 0) {
      console.log(` → ${updated} updated (${classCode})`);
    } else {
      console.log(' → ok');
    }
  }
  return total;
}

module.exports = {
  generateStudentId,
  renumberClassStudentIds,
  renumberAllClassStudentIds,
  classLevelToCode,
  formatStudentId,
  sortNameKey,
  getPrefix,
  DEFAULT_PREFIX,
  LEVEL_CODES,
};
