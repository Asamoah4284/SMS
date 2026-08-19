const { checkMoolrePaymentStatus } = require('./moolrePaymentStatus');
const { resolveMoolreRedirectUrl, resolveMoolreWebhookUrl } = require('./moolrePaymentUrls');
const { getMoolrePaymentAuthHeaders, isMoolrePaymentsConfigured } = require('./moolreAuth');

const MOOLRE_ACCOUNT_NUMBER = process.env.MOOLRE_ACCOUNT_NUMBER;
const MOOLRE_EMBED_URL = 'https://api.moolre.com/embed/link';

function billingEmailFromPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 7) return null;
  return `${digits}@phone.elmax.edu.gh`;
}

function billingEmailFromStudent(schoolStudentId, reference, parentEmail, parentPhone) {
  const raw = parentEmail && String(parentEmail).trim();
  if (raw && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(raw)) {
    return raw;
  }
  const fromPhone = billingEmailFromPhone(parentPhone);
  if (fromPhone) return fromPhone;
  const id = String(schoolStudentId || 'ward')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 32) || 'ward';
  const ref = String(reference).replace(/[^a-z0-9]/gi, '').slice(0, 12) || 'ref';
  return `pay.${id}.${ref}@phone.elmax.edu.gh`;
}

function generateBookPaymentReference() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SMS-BOOK-${stamp}-${rand}`;
}

function generateFeePaymentReference() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SMS-FEE-${stamp}-${rand}`;
}

async function initializeMoolreEmbedLink(opts) {
  const { amount, email, externalref, metadata = {}, redirectUrl: redirectOverride } = opts;

  if (!isMoolrePaymentsConfigured()) {
    return { ok: false, error: 'Payment gateway not configured. Contact support.' };
  }

  const webhookUrl = resolveMoolreWebhookUrl();
  const redirectBase = redirectOverride
    ? String(redirectOverride).trim()
    : resolveMoolreRedirectUrl();
  const redirectUrl = redirectOverride
    ? redirectBase
    : `${redirectBase}${redirectBase.includes('?') ? '&' : '?'}externalref=${encodeURIComponent(externalref)}`;

  const payload = {
    type: 1,
    amount: String(amount),
    email,
    externalref,
    callback: webhookUrl,
    redirect: redirectUrl,
    reusable: '0',
    currency: 'GHS',
    accountnumber: MOOLRE_ACCOUNT_NUMBER,
    metadata,
  };

  console.log('[moolre-init] embed/link request', {
    externalref,
    amount,
    webhookUrl,
    redirectUrl,
  });

  const response = await fetch(MOOLRE_EMBED_URL, {
    method: 'POST',
    headers: getMoolrePaymentAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    console.error('[moolre-init] invalid JSON', { externalref, bodyPreview: text.slice(0, 400) });
    return { ok: false, error: 'Invalid response from payment gateway.' };
  }

  const status = Number(data?.status);
  if (!response.ok || (status !== 1 && status !== 200)) {
    const msg = data?.message ? String(data.message) : 'Payment initialization failed';
    console.error('[moolre-init] failed', { externalref, httpStatus: response.status, msg });
    return { ok: false, error: msg };
  }

  const authUrl =
    data?.data && typeof data.data === 'object' && data.data.authorization_url
      ? String(data.data.authorization_url)
      : '';

  if (!authUrl) {
    return { ok: false, error: 'Payment gateway did not return a payment URL.' };
  }

  return { ok: true, authorization_url: authUrl, redirect_url: redirectUrl };
}

async function verifyMoolrePaymentWithRetry(paymentReference) {
  const delays = [0, 2000, 3000, 4000, 5000, 6000];
  let lastMessage = 'Payment verification failed';

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt] > 0) {
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }

    const status = await checkMoolrePaymentStatus(paymentReference);
    if (!status.ok) {
      lastMessage = status.error || status.message || lastMessage;
      break;
    }

    if (status.isPaid) {
      const amountPaid = Number(status.data?.amount ?? status.data?.Amount ?? 0);
      return { ok: true, amountPaid, data: status.data };
    }

    if (status.txStatusNum === 2) {
      return { ok: false, error: 'Payment failed or was cancelled.' };
    }

    lastMessage = 'Payment is still processing. Please wait and try again.';
  }

  return { ok: false, error: lastMessage };
}

module.exports = {
  billingEmailFromPhone,
  billingEmailFromStudent,
  generateBookPaymentReference,
  generateFeePaymentReference,
  initializeMoolreEmbedLink,
  verifyMoolrePaymentWithRetry,
};
