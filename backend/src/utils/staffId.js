/**
 * Generate a unique Staff ID from teacher's name.
 * Format: [First initial][Last initial]-[5-digit random]
 * Example: JK-12345
 */

function generateStaffId(firstName, lastName) {
  const firstInitial = (firstName[0] || 'X').toUpperCase();
  const lastInitial = (lastName[0] || 'X').toUpperCase();
  const randomPart = Math.floor(10000 + Math.random() * 90000);
  return `${firstInitial}${lastInitial}-${randomPart}`;
}

module.exports = { generateStaffId };
