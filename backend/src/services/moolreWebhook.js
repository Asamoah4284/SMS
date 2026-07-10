/**
 * Parse Moolre payment webhooks (wallet callback + transact/payment).
 */

function getMoolreWebhookPayload(req) {
  let raw = req.body;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = {};
    }
  }
  if (!raw || typeof raw !== 'object') raw = {};

  const keys = Object.keys(raw);
  if (keys.length === 1) {
    const key = keys[0];
    if (key.trim().startsWith('{')) {
      try {
        const cleanJson = key.replace(/\\r\\n/g, '').replace(/\r\n/g, '');
        raw = JSON.parse(cleanJson);
      } catch {
        /* keep raw */
      }
    }
  }

  const nested = raw.data || raw.payload || raw.request;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return { ...raw, ...nested, _root: raw };
  }
  return raw;
}

function pickString(...values) {
  for (const v of values) {
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return null;
}

function parseMoolrePaymentEvent(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const root = p;
  const data =
    root.data && typeof root.data === 'object' && !Array.isArray(root.data) ? root.data : root;

  const reference = pickString(
    data.externalref,
    data.externalRef,
    data.Externalref,
    root.externalref,
    root.externalRef
  );

  let txRaw =
    data.txstatus ??
    data.txStatus ??
    data.TXSTATUS ??
    root.txstatus ??
    root.txStatus ??
    null;

  const topStatus = Number(root.status ?? data.status);
  const code = String(root.code ?? data.code ?? '').toUpperCase();

  if (txRaw == null || txRaw === '') {
    if (topStatus === 1 || code === 'P01' || code === 'SS01' || code === 'TR099') {
      txRaw = 1;
    } else if (topStatus === 0) {
      txRaw = 0;
    } else if (topStatus === 2) {
      txRaw = 2;
    }
  }

  const txStatusNum = txRaw == null || txRaw === '' ? null : Number(txRaw);
  return {
    reference,
    txStatusNum,
    isSuccess: txStatusNum === 1,
    isFailed: txStatusNum === 2,
    isPending: txStatusNum === 0 || txStatusNum == null,
    code,
  };
}

module.exports = {
  getMoolreWebhookPayload,
  parseMoolrePaymentEvent,
};
