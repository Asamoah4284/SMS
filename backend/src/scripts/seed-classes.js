/**
 * Seed script: Initialize classes for a new school
 * Run: npx node src/scripts/seed-classes.js
 * 
 * Creates:
 * - Nursery 1, Nursery 2
 * - KG 1, KG 2
 * - Class 1-6 (no sections)
 * - JHS 1-3
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CLASSES = [
  { name: 'Nursery 1', level: 'NURSERY_1', section: null },
  { name: 'Nursery 2', level: 'NURSERY_2', section: null },
  { name: 'KG 1', level: 'KG_1', section: null },
  { name: 'KG 2', level: 'KG_2', section: null },
  { name: 'Class 1', level: 'BASIC_1', section: null },
  { name: 'Class 2', level: 'BASIC_2', section: null },
  { name: 'Class 3', level: 'BASIC_3', section: null },
  { name: 'Class 4', level: 'BASIC_4', section: null },
  { name: 'Class 5', level: 'BASIC_5', section: null },
  { name: 'Class 6', level: 'BASIC_6', section: null },
  { name: 'JHS 1', level: 'JHS_1', section: null },
  { name: 'JHS 2', level: 'JHS_2', section: null },
  { name: 'JHS 3', level: 'JHS_3', section: null },
];

async function main() {
  console.log('🌱 Starting class seed...');

  for (const classData of CLASSES) {
    try {
      const existing = await prisma.class.findFirst({
        where: {
          level: classData.level,
          section: classData.section,
        },
      });

      if (existing) {
        console.log(`✓ ${classData.name} already exists`);
        continue;
      }

      const created = await prisma.class.create({
        data: classData,
      });

      console.log(`✓ Created: ${created.name}`);
    } catch (error) {
      console.error(`✗ Failed to create ${classData.name}:`, error.message);
    }
  }

  console.log('🎉 Class seed completed!');
}

main()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
