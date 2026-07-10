/**
 * Moolre payment auth + webhook secret helpers (CommonJS).
 */

function getMoolrePaymentAuthHeaders() {
  return {
    'X-API-USER': process.env.MOOLRE_USERNAME || '',
    'X-API-PUBKEY': process.env.MOOLRE_PUBLIC_KEY || '',
    'Content-Type': 'application/json',
  };
}

function verifyMoolreWebhook(payload, headers = {}) {
  const h = headers || {};
  const p = payload && typeof payload === 'object' ? payload : {};
  const webhookSecret =
    p?.data?.secret ??
    p?.secret ??
    p?.data?.webhookSecret ??
    h['x-moolre-secret'] ??
    h['x-moolre-webhook-secret'] ??
    h['x-webhook-secret'] ??
    null;

  const expected = process.env.MOOLRE_WEBHOOK_SECRET;
  if (expected) {
    if (!webhookSecret) {
      return String(process.env.MOOLRE_WEBHOOK_ALLOW_MISSING_SECRET || '').toLowerCase() === 'true';
    }
    return webhookSecret === expected;
  }
  return true;
}

function isMoolrePaymentsConfigured() {
  return Boolean(
    process.env.MOOLRE_ACCOUNT_NUMBER &&
      process.env.MOOLRE_USERNAME &&
      process.env.MOOLRE_PUBLIC_KEY
  );
}

module.exports = {
  getMoolrePaymentAuthHeaders,
  verifyMoolreWebhook,
  isMoolrePaymentsConfigured,
};
