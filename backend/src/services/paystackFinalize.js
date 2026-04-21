const prisma = require('../config/db');
const { allocatePaystackAmountToFeeLines } = require('./paystackFeeSettlement');

/**
 * Mark intent SUCCESS and allocate to fee lines (idempotent).
 * @param {string} reference Paystack reference (our intent.reference)
 * @param {number} amountPesewas Amount Paystack charged (pesewas)
 */
async function finalizePaystackIntentByReference(reference, amountPesewas) {
  const intent = await prisma.paystackIntent.findUnique({
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
    console.error('Paystack amount mismatch', { reference, amountPesewas, expected: intent.amountPesewas });
    return { ok: false, reason: 'AMOUNT_MISMATCH' };
  }

  const amountGhs = intent.amountGhs;

  await prisma.$transaction(async (tx) => {
    const locked = await tx.paystackIntent.findUnique({ where: { reference } });
    if (!locked || locked.status === 'SUCCESS') return;

    await allocatePaystackAmountToFeeLines(tx, {
      studentId: intent.studentId,
      termId: intent.termId,
      amountGhs,
      receiptReference: reference,
      restrictToFeeStructureIds: intent.targetFeeStructureIds,
    });

    await tx.paystackIntent.update({
      where: { reference },
      data: { status: 'SUCCESS' },
    });
  });

  return { ok: true };
}

async function markIntentFailed(reference) {
  await prisma.paystackIntent.updateMany({
    where: { reference, status: 'PENDING' },
    data: { status: 'FAILED' },
  });
}

module.exports = { finalizePaystackIntentByReference, markIntentFailed };
