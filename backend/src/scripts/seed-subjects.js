/**
 * Seed script: Create default school subjects.
 * Run: node src/scripts/seed-subjects.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SUBJECTS = [
  { name: 'Mathematics', code: 'MATH' },
  { name: 'English Language', code: 'ENG' },
  { name: 'Integrated Science', code: 'SCI' },
  { name: 'Social Studies', code: 'SOC' },
  { name: 'RME', code: 'RME' },
  { name: 'Creative Arts', code: 'ART' },
  { name: 'ICT', code: 'ICT' },
  { name: 'Physical Education', code: 'PE' },
  { name: 'French', code: 'FR' },
  { name: 'Ghanaian Language', code: 'GL' },
];

async function main() {
  console.log('Seeding subjects...');

  for (const row of SUBJECTS) {
    try {
      const existing = await prisma.subject.findUnique({ where: { name: row.name } });

      if (existing) {
        if (existing.code !== row.code) {
          await prisma.subject.update({ where: { id: existing.id }, data: { code: row.code } });
          console.log(`Updated subject code: ${row.name} -> ${row.code}`);
        } else {
          console.log(`✓ ${row.name} already exists`);
        }
        continue;
      }

      await prisma.subject.create({ data: row });
      console.log(`✓ Created subject: ${row.name}`);
    } catch (error) {
      console.error(`✗ Failed subject ${row.name}:`, error.message);
    }
  }

  console.log('Subject seed completed.');
}

main()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
