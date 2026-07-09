const { normalisePhone } = require('../middleware/parentPortalAuth');

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
 * Link guardian 1 to an existing parent portal account when phone matches.
 */
async function resolvePrimaryGuardian(prisma, { name, phone }) {
  if (!phone && !name) {
    return { parentId: null, parentName: null, parentPhone: null };
  }

  const normPhone = phone ? normalisePhone(phone) || phone : null;

  if (phone) {
    const existingUser = await prisma.user.findFirst({
      where: {
        phone: { in: [phone, normPhone].filter(Boolean) },
        role: 'PARENT',
      },
      include: { parentProfile: true },
    });

    if (existingUser?.parentProfile) {
      return { parentId: existingUser.parentProfile.id, parentName: null, parentPhone: null };
    }
  }

  return {
    parentId: null,
    parentName: name || null,
    parentPhone: normPhone || phone || null,
  };
}

function resolveSecondaryGuardian({ name, phone }) {
  if (!phone && !name) {
    return { parent2Name: null, parent2Phone: null };
  }
  const normPhone = phone ? normalisePhone(phone) || phone : null;
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
