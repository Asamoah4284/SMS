/**
 * Seed script: Create sample parent portal accounts and link to students.
 * Run: node src/scripts/seed-parents.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'parent1234';

const SAMPLE_PARENTS = [
  { firstName: 'Akosua', lastName: 'Boateng', phone: '0248002001', email: 'akosua.boateng@example.com' },
  { firstName: 'Yaw', lastName: 'Mensah', phone: '0248002002', email: 'yaw.mensah@example.com' },
  { firstName: 'Abena', lastName: 'Asante', phone: '0248002003', email: 'abena.asante@example.com' },
  { firstName: 'Kwaku', lastName: 'Darko', phone: '0248002004', email: 'kwaku.darko@example.com' },
  { firstName: 'Efia', lastName: 'Owusu', phone: '0248002005', email: 'efia.owusu@example.com' },
];

async function main() {
  console.log('Seeding sample parents...');

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const students = await prisma.student.findMany({
    where: { OR: [{ parentId: null }, { parentId: undefined }] },
    orderBy: [{ classId: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
  });

  for (let i = 0; i < SAMPLE_PARENTS.length; i += 1) {
    const row = SAMPLE_PARENTS[i];

    try {
      const existingUser = await prisma.user.findUnique({ where: { phone: row.phone } });

      if (existingUser && existingUser.role !== 'PARENT') {
        console.log(`Skipped ${row.firstName} ${row.lastName}: phone belongs to non-parent user`);
        continue;
      }

      const user =
        existingUser ||
        (await prisma.user.create({
          data: {
            phone: row.phone,
            email: row.email,
            password: passwordHash,
            firstName: row.firstName,
            lastName: row.lastName,
            role: 'PARENT',
          },
        }));

      let parent = await prisma.parent.findUnique({ where: { userId: user.id } });
      if (!parent) {
        parent = await prisma.parent.create({ data: { userId: user.id } });
        console.log(`Created parent: ${row.firstName} ${row.lastName}`);
      } else {
        console.log(`Parent already exists: ${row.firstName} ${row.lastName}`);
      }

      // Link one student per parent where possible so parent pages have real data.
      const candidate = students[i];
      if (candidate && !candidate.parentId) {
        await prisma.student.update({
          where: { id: candidate.id },
          data: {
            parentId: parent.id,
            parentName: `${row.firstName} ${row.lastName}`,
            parentPhone: row.phone,
          },
        });
        console.log(`Linked student ${candidate.studentId} to ${row.firstName} ${row.lastName}`);
      }
    } catch (error) {
      console.error(`Failed parent seed for ${row.firstName} ${row.lastName}:`, error.message);
    }
  }

  console.log('Parent seed completed.');
  console.log('Default parent password:', DEFAULT_PASSWORD);
}

main()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
