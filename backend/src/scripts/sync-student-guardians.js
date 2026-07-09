/**
 * Backfill parent portal accounts from student guardian fields.
 *
 * - Guardian 1 (parentName/parentPhone) → links student.parentId, siblings share the same parent
 * - Guardian 2 (parent2Name/parent2Phone) → ensures Parent account + keeps phone on student for app login
 * - Skips placeholder names with no valid phone ("Guardian (update in dashboard)")
 * - Skips when parent account already linked / phone already exists
 *
 * Run on server:
 *   cd /var/www/SMS/backend && npm run parents:sync-guardians
 */

require('dotenv').config();
const prisma = require('../config/db');
const { syncStudentGuardians } = require('../services/parentAccount');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const studentIdArg = process.argv.find((a) => a.startsWith('--student='));
  const onlyStudentId = studentIdArg ? studentIdArg.split('=')[1] : null;

  console.log('Syncing student guardians → parent accounts...');
  if (dryRun) console.log('(dry-run mode — no database writes)\n');

  const students = await prisma.student.findMany({
    where: onlyStudentId ? { OR: [{ id: onlyStudentId }, { studentId: onlyStudentId }] } : {},
    select: { id: true, studentId: true, firstName: true, lastName: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  console.log(`Students to process: ${students.length}\n`);

  const stats = {
    processed: 0,
    primaryLinked: 0,
    primarySkipped: 0,
    secondaryCreated: 0,
    secondaryExists: 0,
    secondarySkipped: 0,
    errors: 0,
  };

  for (const s of students) {
    try {
      if (dryRun) {
        console.log(`[dry-run] Would sync ${s.studentId} — ${s.firstName} ${s.lastName}`);
        stats.processed++;
        continue;
      }

      const result = await syncStudentGuardians(prisma, s.id);
      stats.processed++;

      const p = result.primary;
      const g2 = result.secondary;

      if (p?.action === 'linked' || p?.action === 'created_and_linked') stats.primaryLinked++;
      else if (p?.action === 'already_linked') stats.primaryLinked++;
      else if (p?.action === 'skipped') stats.primarySkipped++;

      if (g2?.action === 'created') stats.secondaryCreated++;
      else if (g2?.action === 'exists') stats.secondaryExists++;
      else if (g2?.action === 'skipped') stats.secondarySkipped++;

      const notes = [];
      if (p) notes.push(`G1:${p.action}${p.created ? '(new)' : ''}`);
      if (g2) notes.push(`G2:${g2.action}${g2.created ? '(new)' : ''}`);
      if (notes.length) {
        console.log(`  ✓ ${s.studentId} — ${notes.join(', ')}`);
      }
    } catch (err) {
      stats.errors++;
      console.error(`  ✗ ${s.studentId}: ${err.message}`);
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Processed:          ${stats.processed}`);
  console.log(`Primary linked:     ${stats.primaryLinked}`);
  console.log(`Primary skipped:    ${stats.primarySkipped}`);
  console.log(`Secondary created:  ${stats.secondaryCreated}`);
  console.log(`Secondary existing: ${stats.secondaryExists}`);
  console.log(`Secondary skipped:  ${stats.secondarySkipped}`);
  console.log(`Errors:             ${stats.errors}`);
  console.log('\nParents log in to the app with their phone number (no password needed for lookup).');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
