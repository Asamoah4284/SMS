const { AMOUNT_EPS } = require('../utils/feeAccounting');

function computeStatus(amountDue, totalPaid) {
  if (totalPaid <= 0) return 'UNPAID';
  if (totalPaid >= amountDue - AMOUNT_EPS) return 'FULLY_PAID';
  if (totalPaid >= amountDue / 2) return 'HALF_PAID';
  return 'PARTIAL';
}

/**
 * Record one Paystack settlement: split `amountGhs` across fee lines (in order) inside a transaction.
 * @param {import('@prisma/client').PrismaClient} tx
 * @param {{ studentId: string, termId: string, amountGhs: number, receiptReference: string, restrictToFeeStructureIds?: string[] | null }} params
 */
async function allocatePaystackAmountToFeeLines(tx, params) {
  const { studentId, termId, amountGhs, receiptReference, restrictToFeeStructureIds } = params;

  const student = await tx.student.findUnique({
    where: { id: studentId },
    include: { class: { select: { level: true } } },
  });
  if (!student?.class?.level) throw new Error('Student has no class level');

  const level = student.class.level;

  const tuition = await tx.feeStructure.findFirst({
    where: { termId, category: 'TUITION', classLevel: level },
  });
  const supplementary = await tx.feeStructure.findMany({
    where: {
      termId,
      category: { in: ['UNIFORM', 'OTHER'] },
      OR: [{ classLevel: null }, { classLevel: level }],
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  let structures = [];
  if (tuition) structures.push(tuition);
  structures.push(...supplementary);

  const restrict = restrictToFeeStructureIds?.filter(Boolean);
  if (restrict?.length) {
    const allow = new Set(restrict);
    structures = structures.filter((s) => allow.has(s.id));
  }

  let left = amountGhs;
  const created = [];

  for (const structure of structures) {
    if (left <= AMOUNT_EPS) break;

    const agg = await tx.feePayment.aggregate({
      where: { studentId, feeStructureId: structure.id, termId },
      _sum: { amountPaid: true },
    });
    const already = agg._sum.amountPaid ?? 0;
    const remaining = Math.max(0, structure.amount - already);
    if (remaining <= AMOUNT_EPS) continue;

    const chunk = Math.min(remaining, left);
    if (chunk <= AMOUNT_EPS) continue;

    const runningTotal = already + chunk;
    const paymentStatus = computeStatus(structure.amount, runningTotal);

    const payment = await tx.feePayment.create({
      data: {
        studentId,
        feeStructureId: structure.id,
        termId,
        amountPaid: chunk,
        paymentStatus,
        paymentMethod: 'paystack',
        receiptNumber: receiptReference,
        paidAt: new Date(),
      },
    });
    created.push(payment);
    left -= chunk;
  }

  return { createdCount: created.length, remainder: left };
}

module.exports = { allocatePaystackAmountToFeeLines, computeStatus };
