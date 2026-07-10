const prisma = require('../config/db');
const { creditSchoolWallet } = require('./schoolWallet');
const { resolveSchoolAmount } = require('../utils/commission');
const { notifyBookPaymentReceived } = require('./inAppNotifications');

/**
 * Mark book intent SUCCESS and create BookPayment records (idempotent).
 * Works for both legacy Paystack and Moolre book intents (same table).
 * @param {string} reference
 * @param {number} amountPesewas - gross amount in pesewas (GHS * 100)
 * @param {{ paymentMethod?: string }} [opts]
 */
async function finalizeBookPaystackIntentByReference(reference, amountPesewas, opts = {}) {
  const paymentMethod = opts.paymentMethod || 'moolre';

  const intent = await prisma.bookPaystackIntent.findUnique({
    where: { reference },
    include: {
      student: { select: { firstName: true, lastName: true, studentId: true, classId: true } },
    },
  });

  if (!intent) {
    return { ok: false, reason: 'UNKNOWN_REFERENCE' };
  }
  if (intent.status === 'SUCCESS') {
    return { ok: true, already: true };
  }
  if (intent.status === 'FAILED') {
    return { ok: false, reason: 'INTENT_FAILED' };
  }

  if (Math.abs(amountPesewas - intent.amountPesewas) > 2) {
    console.error('Book payment amount mismatch', {
      reference,
      amountPesewas,
      expected: intent.amountPesewas,
    });
    return { ok: false, reason: 'AMOUNT_MISMATCH' };
  }

  const { getStudentBookLines } = require('../utils/studentBooks');

  const schoolAmountGhs = resolveSchoolAmount(intent);

  const applied = await prisma.$transaction(async (tx) => {
    const locked = await tx.bookPaystackIntent.findUnique({ where: { reference } });
    if (!locked || locked.status === 'SUCCESS') return false;

    const linesData = await getStudentBookLines(tx, intent.studentId, intent.termId);
    const unpaid = linesData.books.filter((b) => !b.isPaid && b.remaining > 0.004);

    let targetBooks = unpaid;
    if (intent.targetBookIds.length > 0) {
      const idSet = new Set(intent.targetBookIds);
      targetBooks = unpaid.filter((b) => idSet.has(b.bookId));
    }

    let remainingPay = schoolAmountGhs;
    for (const book of targetBooks) {
      if (remainingPay <= 0.004) break;
      const pay = Math.min(remainingPay, book.remaining);
      if (pay < 0.01) continue;

      await tx.bookPayment.upsert({
        where: {
          studentId_bookId_termId: {
            studentId: intent.studentId,
            bookId: book.bookId,
            termId: intent.termId,
          },
        },
        create: {
          studentId: intent.studentId,
          bookId: book.bookId,
          termId: intent.termId,
          amountPaid: pay,
          paymentStatus: pay >= book.remaining - 0.004 ? 'FULLY_PAID' : 'PARTIAL',
          paymentMethod,
          paystackRef: reference,
          paidAt: new Date(),
        },
        update: {
          amountPaid: { increment: pay },
          paymentStatus: 'FULLY_PAID',
          paymentMethod,
          paystackRef: reference,
          paidAt: new Date(),
        },
      });

      remainingPay -= pay;
    }

    await creditSchoolWallet(tx, schoolAmountGhs);

    await tx.bookPaystackIntent.update({
      where: { reference },
      data: { status: 'SUCCESS' },
    });
    return true;
  });

  if (applied) {
    const studentName = intent.student
      ? `${intent.student.firstName} ${intent.student.lastName}`.trim()
      : 'A student';
    const methodLabel =
      paymentMethod === 'moolre'
        ? 'Moolre'
        : paymentMethod === 'paystack'
          ? 'Paystack'
          : paymentMethod;

    notifyBookPaymentReceived({
      studentName,
      amountGhs: schoolAmountGhs,
      method: methodLabel,
      classId: intent.student?.classId,
    }).catch((err) => console.error('Book payment notification failed:', err.message));
  }

  return { ok: true, already: !applied };
}

/**
 * Finalize from Moolre (amount may be in GHS).
 * @param {string} reference
 * @param {number} [amountGhs]
 */
async function finalizeBookMoolreIntentByReference(reference, amountGhs) {
  const intent = await prisma.bookPaystackIntent.findUnique({ where: { reference } });
  if (!intent) return { ok: false, reason: 'UNKNOWN_REFERENCE' };
  if (intent.status === 'SUCCESS') return { ok: true, already: true };

  let amountPesewas = intent.amountPesewas;
  if (amountGhs != null && Number.isFinite(Number(amountGhs)) && Number(amountGhs) > 0) {
    amountPesewas = Math.round(Number(amountGhs) * 100);
  }

  return finalizeBookPaystackIntentByReference(reference, amountPesewas, {
    paymentMethod: 'moolre',
  });
}

async function markBookIntentFailed(reference) {
  await prisma.bookPaystackIntent.updateMany({
    where: { reference, status: 'PENDING' },
    data: { status: 'FAILED' },
  });
}

module.exports = {
  finalizeBookPaystackIntentByReference,
  finalizeBookMoolreIntentByReference,
  markBookIntentFailed,
};
