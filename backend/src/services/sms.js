/**
 * SMS via Moolre Open API (https://api.moolre.com/open/sms/send)
 * Requires MOOLRE_API_KEY and optional MOOLRE_SENDER_ID in environment.
 */

const MOOLRE_API_URL = 'https://api.moolre.com/open/sms/send';

function smsBrand() {
  return process.env.SCHOOL_ABBREVIATION || process.env.MOOLRE_SENDER_ID || 'DASE';
}

async function parseResponseBody(response) {
  const contentType = response.headers.get('content-type') || '';
  const raw = await response.text();
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(raw);
    } catch {
      return { raw };
    }
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

/**
 * Format phone for Moolre: international digits without + (e.g. 233XXXXXXXXX).
 * Accepts +233…, 233…, 0XXXXXXXXX (Ghana).
 */
function formatPhoneForMoolre(phone) {
  if (phone == null || phone === '') {
    throw new Error('Valid phone number is required');
  }
  const clean = String(phone).replace(/[\s\-()]/g, '');
  let digits = clean.startsWith('+') ? clean.slice(1) : clean;
  digits = digits.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length >= 10) {
    digits = `233${digits.slice(1)}`;
  } else if (!digits.startsWith('233')) {
    digits = `233${digits}`;
  }
  if (digits.length < 12) {
    throw new Error(`Invalid phone number after formatting: ${phone}`);
  }
  return digits;
}

/**
 * Send SMS to one or more recipients (same body for all).
 * @param {string | string[]} to - Phone(s); Ghana formats supported
 * @param {string} message
 * @returns {Promise<object>} Parsed API body on success
 * @throws {Error} On missing config, HTTP error, or status !== 1
 */
async function sendSMS(to, message) {
  const apiKey = process.env.MOOLRE_API_KEY;
  if (!apiKey) {
    throw new Error('MOOLRE_API_KEY environment variable is not set');
  }

  const senderId = process.env.MOOLRE_SENDER_ID || smsBrand();
  const numbers = Array.isArray(to) ? to : [to];
  const recipients = numbers.map((n) => formatPhoneForMoolre(n));

  const payload = {
    type: 1,
    senderid: senderId,
    messages: recipients.map((recipient) => ({
      recipient,
      message,
    })),
  };

  const response = await fetch(MOOLRE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-VASKEY': apiKey,
    },
    body: JSON.stringify(payload),
  });

  const responseData = await parseResponseBody(response);

  if (!response.ok) {
    const msg =
      typeof responseData === 'object' && responseData !== null && 'message' in responseData
        ? String(responseData.message)
        : JSON.stringify(responseData);
    throw new Error(`Moolre SMS failed (${response.status}): ${msg}`);
  }

  if (responseData.status !== 1) {
    throw new Error(
      `Moolre SMS failed: ${responseData.message || JSON.stringify(responseData)}`,
    );
  }

  return responseData;
}

const templates = {
  permissionApproved: (name, dates) =>
    `Dear ${name}, your leave request from ${dates.start} to ${dates.end} has been APPROVED. - ${smsBrand()}`,

  permissionRejected: (name, reason) =>
    `Dear ${name}, your leave request has been DECLINED. Reason: ${reason}. - ${smsBrand()}`,

  feeReminder: (studentName, balance, termName) =>
    `Reminder: ${studentName}'s outstanding fee balance is GHS ${balance} for ${termName}. Please settle at school. - ${smsBrand()}`,

  resultsReady: (studentName, termName) =>
    `${studentName}'s ${termName} results are now available. Log in to view. - ${smsBrand()}`,

  lowAttendance: (studentName, rate) =>
    `Alert: ${studentName}'s attendance rate is ${rate}% this term. Please contact the school. - ${smsBrand()}`,

  studentAbsent: (parentName, studentName, className, date) =>
    `Dear ${parentName}, ${studentName} was marked ABSENT from ${className} on ${date}. Contact the school if this was an error. - ${smsBrand()}`,

  payoutRequested: ({ schoolName, amountGhs, requesterName, note, payoutId }) => {
    const amt = Number(amountGhs).toFixed(2);
    const lines = [
      `Payout request: ${schoolName}`,
      `GH₵${amt} by ${requesterName}`,
      `Ref: ${payoutId}`,
    ];
    if (note) lines.push(`Note: ${note}`);
    lines.push(`Process manually via Paystack/Moolre. - ${smsBrand()}`);
    return lines.join('. ');
  },
};

module.exports = { sendSMS, templates, formatPhoneForMoolre };
