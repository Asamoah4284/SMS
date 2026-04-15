/**
 * Sum of amounts due: one fee structure amount per (feeStructureId, termId).
 * Multiple payment rows toward the same line must not duplicate the "due" figure.
 */
function totalDueFromPayments(payments) {
  const byKey = new Map();
  for (const p of payments) {
    const key = `${p.feeStructureId}-${p.termId}`;
    if (!byKey.has(key)) {
      byKey.set(key, p.feeStructure.amount);
    }
  }
  let sum = 0;
  for (const v of byKey.values()) sum += v;
  return sum;
}

/** Small tolerance for float comparison (GHS amounts). */
const AMOUNT_EPS = 0.005;

module.exports = { totalDueFromPayments, AMOUNT_EPS };
