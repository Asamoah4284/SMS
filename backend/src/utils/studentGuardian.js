const { ensureParentAccount, normalizeGuardianPhone, isPlaceholderGuardianName } = require('../services/parentAccount');

/**
 * Resolve primary guardian display fields from a student row (with optional parent include).
 */
function primaryGuardianDisplay(student) {
  if (student.parent?.user) {
    return {
      name: `${student.parent.user.firstName} ${student.parent.user.lastName}`.trim(),
      phone: student.parent.user.phone,
      linked: true,
    };
  }
  return {
    name: student.parentName || null,
    phone: student.parentPhone || null,
    linked: false,
  };
}

/**
 * Resolve second guardian display fields.
 */
function secondaryGuardianDisplay(student) {
  return {
    name: student.parent2Name || null,
    phone: student.parent2Phone || null,
  };
}

/**
 * Link or create primary guardian parent account when phone is valid.
 */
async function resolvePrimaryGuardian(prisma, { name, phone }) {
  if (!phone && !name) {
    return { parentId: null, parentName: null, parentPhone: null };
  }

  const account = await ensureParentAccount(prisma, { name, phone });
  if (account && !account.error) {
    return { parentId: account.parent.id, parentName: null, parentPhone: null };
  }

  const normPhone = phone ? normalizeGuardianPhone(phone) : null;
  return {
    parentId: null,
    parentName: isPlaceholderGuardianName(name) ? name || null : name || null,
    parentPhone: normPhone || phone || null,
  };
}

function resolveSecondaryGuardian({ name, phone }) {
  if (!phone && !name) {
    return { parent2Name: null, parent2Phone: null };
  }
  const normPhone = phone ? normalizeGuardianPhone(phone) : null;
  return {
    parent2Name: name || null,
    parent2Phone: normPhone || phone || null,
  };
}

module.exports = {
  primaryGuardianDisplay,
  secondaryGuardianDisplay,
  resolvePrimaryGuardian,
  resolveSecondaryGuardian,
};
