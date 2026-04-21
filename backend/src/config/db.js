const { PrismaClient } = require('@prisma/client');

/**
 * Append pool settings if missing (helps remote DBs e.g. Render under concurrent /portal + /verify).
 * Override with DATABASE_URL query params if you prefer.
 */
function resolvedDatabaseUrl() {
  const urlString = process.env.DATABASE_URL;
  if (!urlString) return undefined;
  try {
    const u = new URL(urlString);
    if (!u.searchParams.has('connection_limit')) {
      u.searchParams.set(
        'connection_limit',
        process.env.DATABASE_CONNECTION_LIMIT || '15'
      );
    }
    if (!u.searchParams.has('pool_timeout')) {
      u.searchParams.set('pool_timeout', process.env.DATABASE_POOL_TIMEOUT || '20');
    }
    return u.toString();
  } catch {
    return urlString;
  }
}

const prisma = new PrismaClient({
  datasources: {
    db: { url: resolvedDatabaseUrl() },
  },
  log:
    process.env.NODE_ENV === 'development'
      ? ['error', 'warn']
      : ['error'],
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
