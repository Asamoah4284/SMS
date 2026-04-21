const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const deletedCount = await prisma.$executeRawUnsafe('DELETE FROM "announcements";');
    console.log('Deleted ' + deletedCount + ' old announcements!');
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}
run();