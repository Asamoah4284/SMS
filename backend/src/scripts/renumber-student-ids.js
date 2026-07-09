/**
 * Reassign all student IDs by class register order (surname A–Z, then first name).
 * Format: {PREFIX}-{classCode}-{NNN} e.g. DASE-Y8-001
 *
 * Usage: npm run students:renumber-ids
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { PrismaClient } = require('@prisma/client');
const { renumberAllClassStudentIds, getPrefix } = require('../utils/studentId');

const prisma = new PrismaClient();

async function main() {
  console.log(`\n🔢 Renumbering student IDs (prefix: ${getPrefix()})\n`);
  const total = await renumberAllClassStudentIds(prisma);
  console.log(`\n✅ Done — ${total} student ID(s) updated.\n`);
}

main()
  .catch((err) => {
    console.error('Failed:', err.message || err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
