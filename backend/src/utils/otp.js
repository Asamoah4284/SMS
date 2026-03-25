/**
 * OTP generation and validation utilities.
 */

/**
 * Generate a 6-digit OTP.
 */
function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Calculate OTP expiry time (current time + duration in minutes).
 */
function getOTPExpiry(minutesDuration = 10) {
  const now = new Date();
  return new Date(now.getTime() + minutesDuration * 60000);
}

module.exports = { generateOTP, getOTPExpiry };
