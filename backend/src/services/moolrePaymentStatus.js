const { getMoolrePaymentAuthHeaders } = require('./moolreAuth');

const MOOLRE_ACCOUNT_NUMBER = process.env.MOOLRE_ACCOUNT_NUMBER;
const STATUS_URL = 'https://api.moolre.com/open/transact/status';

async function queryMoolrePaymentStatus(id, idtype) {
  const payload = {
    type: 1,
    idtype: String(idtype),
    id,
    accountnumber: MOOLRE_ACCOUNT_NUMBER,
  };

  const response = await fetch(STATUS_URL, {
    method: 'POST',
    headers: getMoolrePaymentAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    return { ok: false, error: 'Invalid status response', raw: text?.slice(0, 200) };
  }

  const txstatus = data?.data?.txstatus ?? data?.data?.txStatus ?? null;
  const txStatusNum = txstatus == null ? null : Number(txstatus);
  const apiOk = Number(data?.status) === 1 || Number(data?.status) === 200;
  const code = String(data?.code || '').toUpperCase();

  return {
    ok: apiOk,
    txStatusNum,
    isPaid: txStatusNum === 1,
    isNotFound: code === 'SS07' || txStatusNum === 3,
    code,
    message: data?.message,
    data: data?.data,
    idtype,
    queriedId: id,
  };
}

async function checkMoolrePaymentStatus(externalref, options = {}) {
  if (
    !process.env.MOOLRE_USERNAME ||
    !MOOLRE_ACCOUNT_NUMBER ||
    (!process.env.MOOLRE_PUBLIC_KEY && !process.env.MOOLRE_PRIVATE_KEY)
  ) {
    return { ok: false, error: 'Moolre credentials not configured' };
  }

  const byRef = await queryMoolrePaymentStatus(externalref, '1');
  const moolreTransactionId =
    typeof options.moolreTransactionId === 'string' ? options.moolreTransactionId.trim() : '';

  if (byRef.isNotFound && moolreTransactionId) {
    const byTxnId = await queryMoolrePaymentStatus(moolreTransactionId, '2');
    if (!byTxnId.isNotFound) return byTxnId;
  }

  return byRef;
}

module.exports = { checkMoolrePaymentStatus };
