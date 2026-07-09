const prisma = require('../config/db');

/**
 * Mark book intent SUCCESS and create BookPayment records (idempotent).
 */
async function finalizeBookPaystackIntentByReference(reference, amountPesewas) {
  const intent = await prisma.bookPaystackIntent.findUnique({
    where: { reference },
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
    console.error('Book Paystack amount mismatch', { reference, amountPesewas, expected: intent.amountPesewas });
    return { ok: false, reason: 'AMOUNT_MISMATCH' };
  }

  const { getStudentBookLines } = require('../utils/studentBooks');

  await prisma.$transaction(async (tx) => {
    const locked = await tx.bookPaystackIntent.findUnique({ where: { reference } });
    if (!locked || locked.status === 'SUCCESS') return;

    const linesData = await getStudentBookLines(tx, intent.studentId, intent.termId);
    const unpaid = linesData.books.filter((b) => !b.isPaid && b.remaining > 0.004);

    let targetBooks = unpaid;
    if (intent.targetBookIds.length > 0) {
      const idSet = new Set(intent.targetBookIds);
      targetBooks = unpaid.filter((b) => idSet.has(b.bookId));
    }

    let remainingPay = intent.amountGhs;
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
          paymentMethod: 'paystack',
          paystackRef: reference,
          paidAt: new Date(),
        },
        update: {
          amountPaid: { increment: pay },
          paymentStatus: 'FULLY_PAID',
          paymentMethod: 'paystack',
          paystackRef: reference,
          paidAt: new Date(),
        },
      });

      remainingPay -= pay;
    }

    await tx.bookPaystackIntent.update({
      where: { reference },
      data: { status: 'SUCCESS' },
    });
  });

  return { ok: true };
}

async function markBookIntentFailed(reference) {
  await prisma.bookPaystackIntent.updateMany({
    where: { reference, status: 'PENDING' },
    data: { status: 'FAILED' },
  });
}

module.exports = { finalizeBookPaystackIntentByReference, markBookIntentFailed };
