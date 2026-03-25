/**
 * Utility functions for the frontend.
 */

/**
 * Merge class names together, removing duplicates and falsy values.
 * Similar to clsx or classnames package.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Format a date to a readable string.
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/**
 * Calculate age from date of birth.
 */
export function calculateAge(dob: Date | string): number {
  const birthDate = typeof dob === 'string' ? new Date(dob) : dob;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
}

/**
 * Validate email format.
 */
export function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Validate phone number (Ghana: 024, 025, 055, 056, 027, 0246, etc.).
 */
export function isValidPhoneGH(phone: string): boolean {
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
 * Format phone number to E.164 format for SMS APIs.
 * Input: "0241234567" or "024 123 4567"
 * Output: "+233241234567"
 */
export function formatPhoneE164(phone: string): string {
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
 * Capitalize the first letter of a string.
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Pluralize a noun.
 */
export function pluralize(
  count: number,
  singular: string,
  plural: string
): string {
  return count === 1 ? singular : plural;
}
