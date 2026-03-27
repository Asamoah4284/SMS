const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../config/db');

const router = Router();
router.use(authenticate);

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

// ─────────────────────────────────────────────────────────────────
// GET /parents
// List all parents with their children summary
// ─────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const search = req.query.search?.trim();

    // Class teachers can only see parents of students in their class
    let classIdFilter = null;
    if (req.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findUnique({
        where: { userId: req.user.id },
        select: { classTeacherOf: { select: { id: true } } },
      });
      if (!teacher?.classTeacherOf) {
        return res.json({ parents: [] }); // subject teacher — no class guardians
      }
      classIdFilter = teacher.classTeacherOf.id;
    }

    // Build where clause
    const searchWhere = search
      ? {
          OR: [
            { user: { firstName: { contains: search, mode: 'insensitive' } } },
            { user: { lastName: { contains: search, mode: 'insensitive' } } },
            { user: { phone: { contains: search } } },
          ],
        }
      : {};

    const classWhere = classIdFilter
      ? { children: { some: { classId: classIdFilter, isActive: true } } }
      : {};

    const parents = await prisma.parent.findMany({
      where: { ...searchWhere, ...classWhere },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            isActive: true,
            createdAt: true,
          },
        },
        children: {
          where: { isActive: true },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentId: true,
            class: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { user: { firstName: 'asc' } },
    });

    res.json({
      parents: parents.map((p) => ({
        id: p.id,
        user: {
          firstName: p.user.firstName,
          lastName: p.user.lastName,
          phone: p.user.phone,
          email: p.user.email,
          isActive: p.user.isActive,
          joinedAt: p.user.createdAt,
        },
        childrenCount: p.children.length,
        children: p.children.map((c) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`,
          studentId: c.studentId,
          class: c.class,
        })),
      })),
    });
  } catch (error) {
    console.error('Get parents error:', error);
    res.status(500).json({ error: 'Failed to fetch parents' });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /parents/:id
// Parent detail: profile + all children + each child's attendance & fee status
// ─────────────────────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  // Teachers can only view parents of students in their class
  if (req.user.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: req.user.id },
      select: { classTeacherOf: { select: { id: true } } },
    });
    if (teacher?.classTeacherOf) {
      const parent = await prisma.parent.findUnique({
        where: { id: req.params.id },
        select: { children: { where: { classId: teacher.classTeacherOf.id, isActive: true }, select: { id: true } } },
      });
      if (!parent || parent.children.length === 0) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }
  }

  try {
    const { id } = req.params;

    const parent = await prisma.parent.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            isActive: true,
            createdAt: true,
          },
        },
        children: {
          where: { isActive: true },
          include: {
            class: { select: { id: true, name: true } },
            attendances: {
              take: 30,
              orderBy: { date: 'desc' },
              select: { status: true, date: true },
            },
            feePayments: {
              include: { feeStructure: { select: { amount: true, name: true } } },
            },
          },
        },
      },
    });

    if (!parent) return res.status(404).json({ error: 'Parent not found' });

    // Get current term for context
    const currentTerm = await prisma.term.findFirst({ where: { isCurrent: true } });

    const children = parent.children.map((child) => {
      // Attendance rate (recent 30 days)
      const total = child.attendances.length;
      const present = child.attendances.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
      const attendanceRate = total > 0 ? Math.round((present / total) * 100) : null;

      // Fee status (current term)
      const currentFees = currentTerm
        ? child.feePayments.filter((fp) => fp.termId === currentTerm.id)
        : [];
      const totalDue = currentFees.reduce((s, fp) => s + fp.feeStructure.amount, 0);
      const totalPaid = currentFees.reduce((s, fp) => s + fp.amountPaid, 0);

      return {
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        studentId: child.studentId,
        class: child.class,
        attendanceRate,
        recentAbsences: child.attendances.filter((a) => a.status === 'ABSENT').length,
        fees: {
          totalDue,
          totalPaid,
          balance: Math.max(0, totalDue - totalPaid),
          status: totalPaid >= totalDue && totalDue > 0 ? 'FULLY_PAID'
            : totalPaid > 0 ? 'PARTIAL'
            : 'UNPAID',
        },
      };
    });

    res.json({
      id: parent.id,
      user: {
        firstName: parent.user.firstName,
        lastName: parent.user.lastName,
        phone: parent.user.phone,
        email: parent.user.email,
        isActive: parent.user.isActive,
        joinedAt: parent.user.createdAt,
      },
      children,
    });
  } catch (error) {
    console.error('Get parent detail error:', error);
    res.status(500).json({ error: 'Failed to fetch parent' });
  }
});

// ─────────────────────────────────────────────────────────────────
// PUT /parents/:id
// Update parent contact info (name, phone, email)
// ─────────────────────────────────────────────────────────────────

router.put(
  '/:id',
  authorize('ADMIN'),
  [
    body('firstName').optional().notEmpty().withMessage('First name cannot be empty'),
    body('lastName').optional().notEmpty().withMessage('Last name cannot be empty'),
    body('email').optional().isEmail().withMessage('Invalid email'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { firstName, lastName, email } = req.body;

      const parent = await prisma.parent.findUnique({ where: { id } });
      if (!parent) return res.status(404).json({ error: 'Parent not found' });

      await prisma.user.update({
        where: { id: parent.userId },
        data: {
          ...(firstName && { firstName }),
          ...(lastName && { lastName }),
          ...(email !== undefined && { email }),
        },
      });

      res.json({ message: 'Parent updated' });
    } catch (error) {
      console.error('Update parent error:', error);
      res.status(500).json({ error: 'Failed to update parent' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// POST /parents/:id/students/:studentId
// Assign a student to this parent
// ─────────────────────────────────────────────────────────────────

router.post('/:id/students/:studentId', authorize('ADMIN'), async (req, res) => {
  try {
    const { id, studentId } = req.params;

    const [parent, student] = await Promise.all([
      prisma.parent.findUnique({ where: { id } }),
      prisma.student.findUnique({ where: { id: studentId } }),
    ]);

    if (!parent) return res.status(404).json({ error: 'Parent not found' });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    if (student.parentId === id) {
      return res.status(400).json({ error: 'Student is already assigned to this parent' });
    }

    await prisma.student.update({
      where: { id: studentId },
      data: { parentId: id },
    });

    res.json({ message: 'Student assigned to parent' });
  } catch (error) {
    console.error('Assign student error:', error);
    res.status(500).json({ error: 'Failed to assign student' });
  }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /parents/:id/students/:studentId
// Unassign a student from this parent
// ─────────────────────────────────────────────────────────────────

router.delete('/:id/students/:studentId', authorize('ADMIN'), async (req, res) => {
  try {
    const { id, studentId } = req.params;

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    if (student.parentId !== id) {
      return res.status(400).json({ error: 'Student is not assigned to this parent' });
    }

    await prisma.student.update({
      where: { id: studentId },
      data: { parentId: null },
    });

    res.json({ message: 'Student unassigned from parent' });
  } catch (error) {
    console.error('Unassign student error:', error);
    res.status(500).json({ error: 'Failed to unassign student' });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /parents/unassigned-students
// Students not yet linked to any parent (for assign modal)
// ─────────────────────────────────────────────────────────────────

router.get('/unassigned-students/list', async (req, res) => {
  try {
    const search = req.query.search?.trim();

    const students = await prisma.student.findMany({
      where: {
        parentId: null,
        isActive: true,
        ...(search && {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { studentId: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        class: { select: { name: true } },
      },
      take: 50,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    res.json({
      students: students.map((s) => ({
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        studentId: s.studentId,
        class: s.class,
      })),
    });
  } catch (error) {
    console.error('Get unassigned students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

module.exports = router;
