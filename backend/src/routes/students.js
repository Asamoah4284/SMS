const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../config/db');

const router = Router();
router.use(authenticate);

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Generate next student ID: STM-YYYY-NNN */
async function generateStudentId() {
  const year = new Date().getFullYear();
  const prefix = `STM-${year}-`;
  const last = await prisma.student.findFirst({
    where: { studentId: { startsWith: prefix } },
    orderBy: { studentId: 'desc' },
  });
  if (!last) return `${prefix}001`;
  const seq = parseInt(last.studentId.split('-')[2], 10);
  return `${prefix}${String(seq + 1).padStart(3, '0')}`;
}

/** Normalise a Ghanaian phone to 10-digit local format for comparison */
function normalisePhone(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) return '0' + digits.slice(3);
  return digits.length === 10 ? digits : null;
}

// ─── GET /students ───────────────────────────────────────────────────────────
// Query params: page, limit, classId, search, isActive
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 30);
    const { classId, search, isActive } = req.query;

    const where = {};
    if (classId) where.classId = classId;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { studentId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, students] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: {
          class: { select: { id: true, name: true, level: true } },
          parent: {
            include: {
              user: { select: { firstName: true, lastName: true, phone: true } },
            },
          },
        },
      }),
    ]);

    const data = students.map((s) => ({
      id: s.id,
      studentId: s.studentId,
      firstName: s.firstName,
      lastName: s.lastName,
      gender: s.gender,
      isActive: s.isActive,
      class: s.class,
      parentName: s.parent
        ? `${s.parent.user.firstName} ${s.parent.user.lastName}`
        : s.parentName || null,
      parentPhone: s.parent ? s.parent.user.phone : s.parentPhone || null,
    }));

    res.json({ data, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('GET /students', err);
    res.status(500).json({ message: 'Failed to fetch students' });
  }
});

// ─── POST /students ──────────────────────────────────────────────────────────
router.post('/', authorize('ADMIN'), async (req, res) => {
  try {
    const {
      firstName,
      middleName,
      lastName,
      dateOfBirth,
      gender,
      address,
      classId,
      // Guardian / parent fields
      guardianName,
      guardianPhone,
      guardianAddress,
    } = req.body;

    // Basic validation
    if (!firstName || !lastName) {
      return res.status(400).json({ message: 'First name and last name are required' });
    }
    if (!gender || !['MALE', 'FEMALE'].includes(gender)) {
      return res.status(400).json({ message: 'Valid gender (MALE/FEMALE) is required' });
    }

    // Validate classId if provided
    if (classId) {
      const cls = await prisma.class.findUnique({ where: { id: classId } });
      if (!cls) return res.status(400).json({ message: 'Class not found' });
    }

    const studentId = await generateStudentId();
    const normPhone = normalisePhone(guardianPhone);

    // Build the full name (include middle if provided)
    const fullFirst = middleName ? `${firstName} ${middleName}` : firstName;

    // Parent linking logic
    let parentId = null;
    let storedParentName = null;
    let storedParentPhone = null;

    if (guardianPhone) {
      // Check if there's an existing User(PARENT) with this phone
      const existingUser = await prisma.user.findFirst({
        where: {
          phone: { in: [guardianPhone, normPhone].filter(Boolean) },
          role: 'PARENT',
        },
        include: { parentProfile: true },
      });

      if (existingUser?.parentProfile) {
        parentId = existingUser.parentProfile.id;
      } else {
        // No portal account — store denormalised quick-contact
        storedParentName = guardianName || null;
        storedParentPhone = normPhone || guardianPhone;
      }
    } else if (guardianName) {
      storedParentName = guardianName;
    }

    const student = await prisma.student.create({
      data: {
        studentId,
        firstName: fullFirst,
        lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender,
        address: address || null,
        classId: classId || null,
        parentId,
        parentName: storedParentName,
        parentPhone: storedParentPhone,
      },
      include: {
        class: { select: { id: true, name: true } },
        parent: {
          include: { user: { select: { firstName: true, lastName: true, phone: true } } },
        },
      },
    });

    res.status(201).json({
      message: 'Student created successfully',
      student: {
        id: student.id,
        studentId: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        gender: student.gender,
        class: student.class,
        parentLinked: !!parentId,
        parentName: student.parent
          ? `${student.parent.user.firstName} ${student.parent.user.lastName}`
          : student.parentName,
        parentPhone: student.parent ? student.parent.user.phone : student.parentPhone,
      },
    });
  } catch (err) {
    console.error('POST /students', err);
    res.status(500).json({ message: 'Failed to create student' });
  }
});

// ─── GET /students/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: {
        class: {
          include: {
            classTeacher: {
              include: { user: { select: { firstName: true, lastName: true } } },
            },
          },
        },
        parent: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
            children: {
              select: { id: true, studentId: true, firstName: true, lastName: true },
            },
          },
        },
        attendances: {
          orderBy: { date: 'desc' },
          take: 30,
          include: { term: { select: { id: true, name: true, year: true } } },
        },
        results: {
          include: {
            subject: { select: { id: true, name: true } },
            term: { select: { id: true, name: true, year: true } },
          },
          orderBy: [{ term: { year: 'desc' } }, { subject: { name: 'asc' } }],
        },
        feePayments: {
          include: {
            feeStructure: { select: { name: true, amount: true } },
            term: { select: { name: true, year: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!student) return res.status(404).json({ message: 'Student not found' });

    // Attendance summary
    const attendanceSummary = student.attendances.reduce(
      (acc, a) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      },
      { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 }
    );
    const totalDays = student.attendances.length;
    const attendanceRate =
      totalDays > 0
        ? Math.round(
            ((attendanceSummary.PRESENT + attendanceSummary.LATE) / totalDays) * 100
          )
        : null;

    // Fee summary
    const feeTotalPaid = student.feePayments.reduce((s, p) => s + p.amountPaid, 0);
    const feeTotalDue = student.feePayments.reduce((s, p) => s + p.feeStructure.amount, 0);

    res.json({
      ...student,
      attendanceSummary: { ...attendanceSummary, total: totalDays, rate: attendanceRate },
      feeSummary: { totalPaid: feeTotalPaid, totalDue: feeTotalDue, balance: Math.max(0, feeTotalDue - feeTotalPaid) },
    });
  } catch (err) {
    console.error('GET /students/:id', err);
    res.status(500).json({ message: 'Failed to fetch student' });
  }
});

// ─── PUT /students/:id ───────────────────────────────────────────────────────
router.put('/:id', authorize('ADMIN'), async (req, res) => {
  try {
    const { firstName, middleName, lastName, dateOfBirth, gender, address, classId, isActive } =
      req.body;

    const existing = await prisma.student.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Student not found' });

    const fullFirst =
      firstName !== undefined
        ? middleName
          ? `${firstName} ${middleName}`
          : firstName
        : undefined;

    const updated = await prisma.student.update({
      where: { id: req.params.id },
      data: {
        ...(fullFirst !== undefined && { firstName: fullFirst }),
        ...(lastName !== undefined && { lastName }),
        ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }),
        ...(gender !== undefined && { gender }),
        ...(address !== undefined && { address }),
        ...(classId !== undefined && { classId: classId || null }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { class: { select: { id: true, name: true } } },
    });

    res.json({ message: 'Student updated', student: updated });
  } catch (err) {
    console.error('PUT /students/:id', err);
    res.status(500).json({ message: 'Failed to update student' });
  }
});

// ─── POST /students/bulk-import ──────────────────────────────────────────────
router.post('/bulk-import', authorize('ADMIN'), async (req, res) => {
  try {
    const { students } = req.body;
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ message: 'No students provided' });
    }

    const results = { imported: 0, failed: [] };

    for (let i = 0; i < students.length; i++) {
      const row = students[i];
      const rowNum = i + 1;

      if (!row.firstName || !row.lastName) {
        results.failed.push({ row: rowNum, reason: 'Missing first or last name' });
        continue;
      }
      if (!row.gender || !['MALE', 'FEMALE'].includes(String(row.gender).toUpperCase())) {
        results.failed.push({ row: rowNum, reason: 'Invalid gender' });
        continue;
      }

      try {
        const studentId = await generateStudentId();
        const normPhone = normalisePhone(row.guardianPhone);

        let parentId = null;
        let storedParentName = row.guardianName || null;
        let storedParentPhone = normPhone || row.guardianPhone || null;

        if (row.guardianPhone) {
          const existingUser = await prisma.user.findFirst({
            where: {
              phone: { in: [row.guardianPhone, normPhone].filter(Boolean) },
              role: 'PARENT',
            },
            include: { parentProfile: true },
          });
          if (existingUser?.parentProfile) {
            parentId = existingUser.parentProfile.id;
            storedParentName = null;
            storedParentPhone = null;
          }
        }

        const fullFirst = row.middleName
          ? `${row.firstName} ${row.middleName}`
          : row.firstName;

        await prisma.student.create({
          data: {
            studentId,
            firstName: fullFirst,
            lastName: row.lastName,
            dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : null,
            gender: String(row.gender).toUpperCase(),
            address: row.address || null,
            classId: row.classId || null,
            parentId,
            parentName: storedParentName,
            parentPhone: storedParentPhone,
          },
        });
        results.imported++;
      } catch (rowErr) {
        results.failed.push({ row: rowNum, reason: rowErr.message });
      }
    }

    res.json(results);
  } catch (err) {
    console.error('POST /students/bulk-import', err);
    res.status(500).json({ message: 'Failed to bulk import students' });
  }
});

module.exports = router;
