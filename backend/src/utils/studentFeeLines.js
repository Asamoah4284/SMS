/**
 * Build per-line fee state for a student in a term (structures + paid amounts).
 * Order: TUITION (class level), then UNIFORM, then OTHER — same as admin fee overview.
 */
async function getStudentFeeLinesForTerm(prisma, studentInternalId, termId) {
  const student = await prisma.student.findUnique({
    where: { id: studentInternalId },
    include: { class: { select: { level: true } } },
  });
  if (!student || !student.class?.level) {
    return { lines: [], totalDue: 0, totalPaid: 0, balance: 0 };
  }

  const level = student.class.level;

  const tuition = await prisma.feeStructure.findFirst({
    where: { termId, category: 'TUITION', classLevel: level },
  });

  const supplementary = await prisma.feeStructure.findMany({
    where: {
      termId,
      category: { in: ['UNIFORM', 'OTHER'] },
      OR: [{ classLevel: null }, { classLevel: level }],
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  const structures = [];
  if (tuition) structures.push(tuition);
  structures.push(...supplementary);

  const payments = await prisma.feePayment.findMany({
    where: { studentId: studentInternalId, termId },
    select: { feeStructureId: true, amountPaid: true },
  });

  const paidByStructure = {};
  for (const p of payments) {
    paidByStructure[p.feeStructureId] = (paidByStructure[p.feeStructureId] || 0) + p.amountPaid;
  }

  const lines = structures.map((s) => {
    const lineDue = s.amount;
    const paid = paidByStructure[s.id] || 0;
    const remaining = Math.max(0, lineDue - paid);
    return {
      feeStructureId: s.id,
      name: s.name,
      category: s.category,
      lineDue,
      paid,
      remaining,
    };
  });

  const totalDue = lines.reduce((a, l) => a + l.lineDue, 0);
  const totalPaid = lines.reduce((a, l) => a + l.paid, 0);
  const balance = lines.reduce((a, l) => a + l.remaining, 0);

  return { lines, totalDue, totalPaid, balance };
}

module.exports = { getStudentFeeLinesForTerm };
