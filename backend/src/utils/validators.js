/**
 * Validation utilities for common patterns.
 */

/**
 * Validate phone number (Ghana format).
 * Accepts: 024XXXXXXX, +233XXXXXXXXX, etc.
 */
function isValidPhoneGH(phone) {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    return cleaned.length === 10;
  }
  if (cleaned.startsWith('233')) {
    return cleaned.length === 12;
  }
  return false;
}

/**
 * Format phone to E.164 format (+233XXXXXXXXX).
 */
function formatPhoneE164(phone) {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    return `+233${cleaned.slice(1)}`;
  }
  if (cleaned.startsWith('233')) {
    return `+${cleaned}`;
  }
  return '';
}

/**
 * Validate email format.
 */
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Validate password strength.
 * Min 8 chars, at least one uppercase, one lowercase, one digit.
 */
function isStrongPassword(password) {
  const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return re.test(password);
}

module.exports = {
  isValidPhoneGH,
  formatPhoneE164,
  isValidEmail,
  isStrongPassword,
};
