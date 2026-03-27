/**
 * SMS service — wraps Hubtel and Arkesel providers.
 * Switch provider via SMS_PROVIDER env variable.
 */

const provider = process.env.SMS_PROVIDER || 'hubtel';

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
 * Send an SMS to one or more recipients.
 * @param {string | string[]} to  - Phone number(s) in format 0XXXXXXXXX or +233XXXXXXXXX
 * @param {string} message        - SMS body (max 160 chars per segment)
 */
async function sendSMS(to, message) {
  const numbers = Array.isArray(to) ? to : [to];

  if (provider === 'hubtel') {
    return sendViaHubtel(numbers, message);
  }

  return sendViaArkesel(numbers, message);
}

async function sendViaHubtel(numbers, message) {
  // Hubtel Quick Send API
  const clientId = process.env.HUBTEL_CLIENT_ID;
  const clientSecret = process.env.HUBTEL_CLIENT_SECRET;
  const from = process.env.HUBTEL_SENDER_ID || 'EduTrack';

  const results = await Promise.allSettled(
    numbers.map(async (to) => {
      const response = await fetch(
        `https://smsc.hubtel.com/v1/messages/send?clientsecret=${clientSecret}&clientid=${clientId}&from=${from}&to=${to}&content=${encodeURIComponent(message)}`,
        { method: 'GET' }
      );
      const body = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(`Hubtel SMS failed (${response.status}): ${typeof body === 'object' ? JSON.stringify(body) : String(body)}`);
      }
      return body;
    })
  );

  return results;
}

async function sendViaArkesel(numbers, message) {
  const apiKey = process.env.ARKESEL_API_KEY;
  const sender = process.env.ARKESEL_SENDER_ID || 'EduTrack';

  const response = await fetch('https://sms.arkesel.com/sms/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'send-sms',
      api_key: apiKey,
      to: numbers.join(','),
      from: sender,
      sms: message,
    }),
  });

  const body = await parseResponseBody(response);
  if (!response.ok) {
    throw new Error(`Arkesel SMS failed (${response.status}): ${typeof body === 'object' ? JSON.stringify(body) : String(body)}`);
  }
  return body;
}

// Pre-built message templates
const templates = {
  permissionApproved: (name, dates) =>
    `Dear ${name}, your leave request from ${dates.start} to ${dates.end} has been APPROVED. - EduTrack`,

  permissionRejected: (name, reason) =>
    `Dear ${name}, your leave request has been DECLINED. Reason: ${reason}. - EduTrack`,

  feeReminder: (studentName, balance, termName) =>
    `Reminder: ${studentName}'s outstanding fee balance is GHS ${balance} for ${termName}. Please settle at school. - EduTrack`,

  resultsReady: (studentName, termName) =>
    `${studentName}'s ${termName} results are now available. Log in to EduTrack to view. - EduTrack`,

  lowAttendance: (studentName, rate) =>
    `Alert: ${studentName}'s attendance rate is ${rate}% this term. Please contact the school. - EduTrack`,

  studentAbsent: (parentName, studentName, className, date) =>
    `Dear ${parentName}, ${studentName} was marked ABSENT from ${className} on ${date}. Contact the school if this was an error. - EduTrack`,
};

module.exports = { sendSMS, templates };
