const FEE_COMMISSION_RATE = parseFloat(process.env.FEE_COMMISSION_RATE || '0.015');
const BOOK_COMMISSION_RATE = parseFloat(process.env.BOOK_COMMISSION_RATE || '0.05');

/**
 * Parent pays gross = school amount + platform fee.
 * School/admin sees only schoolAmountGhs.
 */
function applyPlatformFee(schoolAmountGhs, type) {
  const rate = type === 'BOOK' ? BOOK_COMMISSION_RATE : FEE_COMMISSION_RATE;
  const school = Math.round(schoolAmountGhs * 100) / 100;
  const platformFeeGhs = Math.round(school * rate * 100) / 100;
  const grossGhs = Math.round((school + platformFeeGhs) * 100) / 100;
  const grossPesewas = Math.round(grossGhs * 100);

  return {
    schoolAmountGhs: school,
    platformFeeGhs,
    grossGhs,
    grossPesewas,
    commissionRatePercent: rate * 100,
  };
}

function resolveSchoolAmount(intent) {
  if (intent.schoolAmountGhs > 0) return intent.schoolAmountGhs;
  return intent.amountGhs;
}

module.exports = {
  applyPlatformFee,
  resolveSchoolAmount,
  FEE_COMMISSION_RATE,
  BOOK_COMMISSION_RATE,
};
