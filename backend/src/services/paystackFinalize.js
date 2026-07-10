const prisma = require('../config/db');
const { allocatePaystackAmountToFeeLines } = require('./paystackFeeSettlement');
const { creditSchoolWallet } = require('./schoolWallet');
const { resolveSchoolAmount } = require('../utils/commission');
const { notifyFeePaymentReceived } = require('./inAppNotifications');

/**
 * Mark intent SUCCESS and allocate to fee lines (idempotent).
 * @param {string} reference Intent reference
 * @param {number} amountPesewas Amount charged (pesewas)
 * @param {{ paymentMethod?: string }} [opts]
 */
async function finalizePaystackIntentByReference(reference, amountPesewas, opts = {}) {
  const paymentMethod = opts.paymentMethod || 'moolre';
  const intent = await prisma.paystackIntent.findUnique({
    where: { reference },
    include: {
      student: { select: { firstName: true, lastName: true, studentId: true } },
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
    console.error('Fee payment amount mismatch', {
      reference,
      amountPesewas,
      expected: intent.amountPesewas,
    });
    return { ok: false, reason: 'AMOUNT_MISMATCH' };
  }

  const amountGhs = resolveSchoolAmount(intent);

  const applied = await prisma.$transaction(async (tx) => {
    const locked = await tx.paystackIntent.findUnique({ where: { reference } });
    if (!locked || locked.status === 'SUCCESS') return false;

    await allocatePaystackAmountToFeeLines(tx, {
      studentId: intent.studentId,
      termId: intent.termId,
      amountGhs,
      receiptReference: reference,
      restrictToFeeStructureIds: intent.targetFeeStructureIds,
      paymentMethod,
    });

    await creditSchoolWallet(tx, amountGhs);

    await tx.paystackIntent.update({
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
    notifyFeePaymentReceived({
      studentName,
      amountGhs,
      method: methodLabel,
    }).catch((err) => console.error('Fee payment notification failed:', err.message));
  }

  return { ok: true, already: !applied };
}

/**
 * Finalize from Moolre (amount may be in GHS).
 * @param {string} reference
 * @param {number} [amountGhs]
 */
async function finalizeFeeMoolreIntentByReference(reference, amountGhs) {
  const intent = await prisma.paystackIntent.findUnique({ where: { reference } });
  if (!intent) return { ok: false, reason: 'UNKNOWN_REFERENCE' };
  if (intent.status === 'SUCCESS') return { ok: true, already: true };

  let amountPesewas = intent.amountPesewas;
  if (amountGhs != null && Number.isFinite(Number(amountGhs)) && Number(amountGhs) > 0) {
    amountPesewas = Math.round(Number(amountGhs) * 100);
  }

  return finalizePaystackIntentByReference(reference, amountPesewas, {
    paymentMethod: 'moolre',
  });
}

async function markIntentFailed(reference) {
  await prisma.paystackIntent.updateMany({
    where: { reference, status: 'PENDING' },
    data: { status: 'FAILED' },
  });
}

module.exports = {
  finalizePaystackIntentByReference,
  finalizeFeeMoolreIntentByReference,
  markIntentFailed,
};
