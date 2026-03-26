/**
 * Seed script: Create sample teachers and optionally assign class teachers.
 * Run: node src/scripts/seed-teachers.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'teacher1234';

const SAMPLE_TEACHERS = [
  { firstName: 'Clement', lastName: 'Obeng', phone: '0538118529', qualification: 'B.Ed Mathematics' },
  { firstName: 'Ama', lastName: 'Serwaa', phone: '0247001001', qualification: 'B.Ed Early Childhood' },
  { firstName: 'Kwame', lastName: 'Addai', phone: '0247001002', qualification: 'B.Sc Science Education' },
  { firstName: 'Efua', lastName: 'Mensima', phone: '0247001003', qualification: 'B.A English' },
  { firstName: 'Kojo', lastName: 'Owusu', phone: '0247001004', qualification: 'B.Ed Social Studies' },
];

function buildStaffId(firstName, lastName, index) {
  const initials = `${(firstName[0] || 'X')}${(lastName[0] || 'X')}`.toUpperCase();
  return `${initials}-${String(index + 1).padStart(5, '0')}`;
}

async function ensureUniqueStaffId(baseStaffId) {
  let staffId = baseStaffId;
  let bump = 1;

  while (await prisma.teacher.findUnique({ where: { staffId } })) {
    staffId = `${baseStaffId}${bump}`;
    bump += 1;
  }

  return staffId;
}

async function main() {
  console.log('Seeding sample teachers...');

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const classes = await prisma.class.findMany({ orderBy: { name: 'asc' } });

  for (let i = 0; i < SAMPLE_TEACHERS.length; i += 1) {
    const row = SAMPLE_TEACHERS[i];

    try {
      const existingUser = await prisma.user.findUnique({ where: { phone: row.phone } });

      if (existingUser && existingUser.role !== 'TEACHER') {
        console.log(`Skipped ${row.firstName} ${row.lastName}: phone belongs to non-teacher user`);
        continue;
      }

      const user =
        existingUser ||
        (await prisma.user.create({
          data: {
            phone: row.phone,
            password: passwordHash,
            firstName: row.firstName,
            lastName: row.lastName,
            role: 'TEACHER',
          },
        }));

      let teacher = await prisma.teacher.findUnique({ where: { userId: user.id } });

      if (!teacher) {
        const rawStaffId = buildStaffId(row.firstName, row.lastName, i);
        const staffId = await ensureUniqueStaffId(rawStaffId);

        teacher = await prisma.teacher.create({
          data: {
            userId: user.id,
            staffId,
            qualification: row.qualification,
          },
        });

        console.log(`Created teacher: ${row.firstName} ${row.lastName} (${teacher.staffId})`);
      } else {
        console.log(`Teacher already exists: ${row.firstName} ${row.lastName} (${teacher.staffId})`);
      }

      const targetClass = classes[i];
      if (targetClass && !targetClass.classTeacherId) {
        await prisma.class.update({
          where: { id: targetClass.id },
          data: { classTeacherId: teacher.id },
        });
        console.log(`Assigned ${teacher.staffId} as class teacher for ${targetClass.name}`);
      }
    } catch (error) {
      console.error(`Failed teacher seed for ${row.firstName} ${row.lastName}:`, error.message);
    }
  }

  console.log('Teacher seed completed.');
  console.log('Default teacher password:', DEFAULT_PASSWORD);
}

main()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
