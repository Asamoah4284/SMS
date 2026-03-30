/**
 * Optional: test Moolre SMS (set MOOLRE_API_KEY in backend/.env).
 * Usage: node scripts/test-moolre-sms.js
 * Edit TEST_PHONE below (233… or local 0… format).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { sendSMS, formatPhoneForMoolre } = require('../src/services/sms');

const TEST_PHONE = process.env.TEST_SMS_PHONE || '0240000000';

async function main() {
  console.log('Formatted:', formatPhoneForMoolre(TEST_PHONE));
  try {
    const result = await sendSMS(TEST_PHONE, 'Test SMS from EduTrack (Moolre).');
    console.log('OK:', result);
  } catch (e) {
    console.error('Failed:', e.message);
    process.exit(1);
  }
}

main();
