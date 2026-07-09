const bcrypt = require('bcryptjs');
const { normalisePhone } = require('../middleware/parentPortalAuth');
const { isValidPhoneGH } = require('../utils/validators');

const PLACEHOLDER_NAME_RE = /guardian\s*\(\s*update in dashboard\s*\)/i;
const DEFAULT_PARENT_PASSWORD = process.env.DEFAULT_PARENT_PASSWORD || 'parent1234';

function isPlaceholderGuardianName(name) {
  if (!name || !String(name).trim()) return true;
  return PLACEHOLDER_NAME_RE.test(String(name).trim());
}

function normalizeGuardianPhone(phone) {
  if (!phone) return null;
  const raw = String(phone).trim();
  if (!raw) return null;
  const norm = normalisePhone(raw);
  if (norm && isValidPhoneGH(norm)) return norm;
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) {
    const local = `0${digits.slice(3)}`;
    return isValidPhoneGH(local) ? local : null;
  }
  return isValidPhoneGH(digits) ? digits : null;
}

function isUsableGuardian({ name, phone }) {
  const normPhone = normalizeGuardianPhone(phone);
  if (!normPhone) return false;
  if (isPlaceholderGuardianName(name)) return true;
  return Boolean(String(name).trim());
}

function splitGuardianName(name) {
  if (!name || isPlaceholderGuardianName(name)) {
    return { firstName: 'Guardian', lastName: 'Contact' };
  }
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: 'Guardian' };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function phonesMatch(a, b) {
  const na = normalizeGuardianPhone(a);
  const nb = normalizeGuardianPhone(b);
  return !!(na && nb && na === nb);
}

async function findParentUserByPhone(prisma, phone) {
  const norm = normalizeGuardianPhone(phone);
  if (!norm) return null;
  const variants = [...new Set([norm, phone, `+233${norm.slice(1)}`])].filter(Boolean);
  return prisma.user.findFirst({
    where: { phone: { in: variants } },
    include: { parentProfile: true },
  });
}

/**
 * Find or create a PARENT user + Parent profile for a guardian phone.
 * Returns null when phone is missing/invalid or phone belongs to a non-parent user.
 */
async function ensureParentAccount(prisma, { name, phone }) {
  if (!isUsableGuardian({ name, phone })) return null;

  const normPhone = normalizeGuardianPhone(phone);
  const existing = await findParentUserByPhone(prisma, phone);

  if (existing && existing.role !== 'PARENT') {
    return { error: `phone_in_use_by_${existing.role.toLowerCase()}`, phone: normPhone };
  }

  const { firstName, lastName } = splitGuardianName(name);

  if (!existing) {
    const passwordHash = await bcrypt.hash(DEFAULT_PARENT_PASSWORD, 10);
    const user = await prisma.user.create({
      data: {
        phone: normPhone,
        firstName,
        lastName,
        role: 'PARENT',
        password: passwordHash,
      },
    });
    const parent = await prisma.parent.create({ data: { userId: user.id } });
    return { user, parent, created: true, phone: normPhone };
  }

  if (!isPlaceholderGuardianName(name)) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { firstName, lastName },
    });
  }

  let parent = existing.parentProfile;
  if (!parent) {
    parent = await prisma.parent.create({ data: { userId: existing.id } });
  }

  const user = await prisma.user.findUnique({ where: { id: existing.id } });
  return { user, parent, created: false, phone: normPhone };
}

/**
 * Sync guardian 1 (parentId link) and guardian 2 (parent2 fields + parent account) for one student.
 */
async function syncStudentGuardians(prisma, studentId) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { parent: { include: { user: true } } },
  });
  if (!student) return { error: 'student_not_found' };

  const result = {
    studentId: student.studentId,
    studentDbId: student.id,
    primary: null,
    secondary: null,
  };

  const g1Phone = student.parent?.user?.phone || student.parentPhone;
  const g1Name = student.parent?.user
    ? `${student.parent.user.firstName} ${student.parent.user.lastName}`.trim()
    : student.parentName;

  if (isUsableGuardian({ name: g1Name, phone: g1Phone })) {
    const account = await ensureParentAccount(prisma, { name: g1Name, phone: g1Phone });
    if (account?.error) {
      result.primary = { action: 'skipped', reason: account.error };
    } else if (account) {
      const data = { parentId: account.parent.id, parentName: null, parentPhone: null };
      const already = student.parentId === account.parent.id;
      await prisma.student.update({ where: { id: student.id }, data });
      result.primary = {
        action: already ? (account.created ? 'created_and_linked' : 'already_linked') : 'linked',
        parentId: account.parent.id,
        created: account.created,
      };
    }
  } else {
    result.primary = { action: 'skipped', reason: 'placeholder_or_no_phone' };
  }

  const fresh = await prisma.student.findUnique({
    where: { id: studentId },
    include: { parent: { include: { user: true } } },
  });

  const primaryPhone =
    fresh.parent?.user?.phone || fresh.parentPhone;
  const g2Phone = fresh.parent2Phone;
  const g2Name = fresh.parent2Name;

  if (!isUsableGuardian({ name: g2Name, phone: g2Phone })) {
    result.secondary = { action: 'skipped', reason: 'placeholder_or_no_phone' };
    return result;
  }

  if (phonesMatch(primaryPhone, g2Phone)) {
    result.secondary = { action: 'skipped', reason: 'same_as_primary' };
    return result;
  }

  const account2 = await ensureParentAccount(prisma, { name: g2Name, phone: g2Phone });
  if (account2?.error) {
    result.secondary = { action: 'skipped', reason: account2.error };
    return result;
  }

  if (account2) {
    const displayName = isPlaceholderGuardianName(g2Name)
      ? `${account2.user.firstName} ${account2.user.lastName}`.trim()
      : String(g2Name).trim();

    await prisma.student.update({
      where: { id: student.id },
      data: {
        parent2Phone: account2.phone,
        parent2Name: displayName,
      },
    });

    result.secondary = {
      action: account2.created ? 'created' : 'exists',
      parentId: account2.parent.id,
      created: account2.created,
    };
  }

  return result;
}

module.exports = {
  isPlaceholderGuardianName,
  isUsableGuardian,
  normalizeGuardianPhone,
  phonesMatch,
  ensureParentAccount,
  syncStudentGuardians,
};
