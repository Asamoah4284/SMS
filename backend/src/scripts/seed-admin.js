const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedAdmin() {
  try {
    const phone = '0241234567'; // Change this
    const password = 'admin1234'; // Change this
    const staffId = 'AD-00001';   // Change this

    console.log('🔐 Seeding admin user...');

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      console.log('❌ User with phone', phone, 'already exists.');
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        phone,
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
      },
    });

    console.log('✅ User created:', user.id);

    // Create teacher record
    const teacher = await prisma.teacher.create({
      data: {
        staffId,
        userId: user.id,
      },
    });

    console.log('✅ Teacher record created:', teacher.id);
    console.log('\n📋 Login with:');
    console.log('   Phone:', phone);
    console.log('   Password:', password);

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedAdmin();
