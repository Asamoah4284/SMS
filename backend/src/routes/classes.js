const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

// All routes require authentication
router.use(authenticate);

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ─────────────────────────────────────────────────────────────────
// POST /classes (Admin only)
// Create a new class (e.g., "Basic 1A")
// ─────────────────────────────────────────────────────────────────

router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Class name is required'),
    body('level').notEmpty().withMessage('Academic level is required'),
    body('section').optional().isString(),
  ],
  handleValidationErrors,
  authorize('ADMIN'),
  async (req, res) => {
    try {
      const { name, level, section } = req.body;

      // Check if class already exists (level + section combination)
      const existingClass = await prisma.class.findFirst({
        where: {
          level,
          section: section || null,
        },
      });

      if (existingClass) {
        return res.status(400).json({ error: 'This class already exists' });
      }

      // Create class
      const newClass = await prisma.class.create({
        data: {
          name,
          level,
          section: section || null,
        },
        include: {
          classTeacher: true,
          students: { select: { id: true } },
        },
      });

      res.status(201).json({
        message: 'Class created successfully',
        class: {
          ...newClass,
          studentCount: newClass.students.length,
        },
      });
    } catch (error) {
      console.error('Create class error:', error);
      res.status(500).json({ error: 'Failed to create class' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// GET /classes
// List all classes (paginated)
// ─────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const [classes, total] = await Promise.all([
      prisma.class.findMany({
        skip,
        take: limit,
        include: {
          classTeacher: {
            include: { user: { select: { firstName: true, lastName: true, phone: true } } },
          },
          students: { select: { id: true } },
          _count: { select: { students: true } },
        },
        orderBy: [
          { level: 'asc' },
          { section: 'asc' },
        ],
      }),
      prisma.class.count(),
    ]);

    res.json({
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        level: c.level,
        section: c.section,
        studentCount: c._count.students,
        classTeacher: c.classTeacher
          ? {
              id: c.classTeacher.id,
              name: `${c.classTeacher.user.firstName} ${c.classTeacher.user.lastName}`,
              phone: c.classTeacher.user.phone,
            }
          : null,
      })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /classes/:id
// Get class details with students and subjects
// ─────────────────────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const classData = await prisma.class.findUnique({
      where: { id },
      include: {
        classTeacher: {
          include: { user: { select: { firstName: true, lastName: true, phone: true } } },
        },
        students: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            parent: { select: { user: { select: { phone: true } } } },
          },
        },
        subjectTeachers: {
          include: {
            teacher: {
              include: { user: { select: { firstName: true, lastName: true } } },
            },
            subject: true,
          },
        },
      },
    });

    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }

    res.json({
      id: classData.id,
      name: classData.name,
      level: classData.level,
      section: classData.section,
      classTeacher: classData.classTeacher
        ? {
            id: classData.classTeacher.id,
            name: `${classData.classTeacher.user.firstName} ${classData.classTeacher.user.lastName}`,
            phone: classData.classTeacher.user.phone,
          }
        : null,
      students: classData.students.map((s) => ({
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        dateOfBirth: s.dateOfBirth,
        parentPhone: s.parent?.user?.phone,
      })),
      subjects: classData.subjectTeachers.map((st) => ({
        id: st.subject.id,
        name: st.subject.name,
        code: st.subject.code,
        teacher: `${st.teacher.user.firstName} ${st.teacher.user.lastName}`,
      })),
    });
  } catch (error) {
    console.error('Get class error:', error);
    res.status(500).json({ error: 'Failed to fetch class' });
  }
});

// ─────────────────────────────────────────────────────────────────
// PUT /classes/:id (Admin only)
// Update class details
// ─────────────────────────────────────────────────────────────────

router.put(
  '/:id',
  [
    body('name').optional().notEmpty(),
    body('classTeacherId').optional().isString(),
  ],
  handleValidationErrors,
  authorize('ADMIN'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, classTeacherId } = req.body;

      // Verify class exists
      const existingClass = await prisma.class.findUnique({ where: { id } });
      if (!existingClass) {
        return res.status(404).json({ error: 'Class not found' });
      }

      // If assigning a class teacher, verify they're a teacher
      if (classTeacherId) {
        const teacher = await prisma.teacher.findUnique({
          where: { id: classTeacherId },
        });

        if (!teacher) {
          return res.status(404).json({ error: 'Teacher not found' });
        }

        // Check if this teacher is already assigned to a class
        const alreadyAssigned = await prisma.class.findFirst({
          where: {
            classTeacherId,
            id: { not: id },
          },
        });

        if (alreadyAssigned) {
          return res
            .status(400)
            .json({ error: 'This teacher is already assigned to another class' });
        }
      }

      // Update class
      const updated = await prisma.class.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(classTeacherId && { classTeacherId }),
        },
        include: {
          classTeacher: {
            include: { user: { select: { firstName: true, lastName: true } } },
          },
          _count: { select: { students: true } },
        },
      });

      res.json({
        message: 'Class updated successfully',
        class: {
          id: updated.id,
          name: updated.name,
          level: updated.level,
          section: updated.section,
          studentCount: updated._count.students,
          classTeacher: updated.classTeacher
            ? {
                id: updated.classTeacher.id,
                name: `${updated.classTeacher.user.firstName} ${updated.classTeacher.user.lastName}`,
              }
            : null,
        },
      });
    } catch (error) {
      console.error('Update class error:', error);
      res.status(500).json({ error: 'Failed to update class' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// DELETE /classes/:id (Admin only)
// Delete a class (only if it has no students)
// ─────────────────────────────────────────────────────────────────

router.delete('/:id', authorize('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if class has students
    const classWithStudents = await prisma.class.findUnique({
      where: { id },
      include: { _count: { select: { students: true } } },
    });

    if (!classWithStudents) {
      return res.status(404).json({ error: 'Class not found' });
    }

    if (classWithStudents._count.students > 0) {
      return res
        .status(400)
        .json({ error: 'Cannot delete class with enrolled students' });
    }

    // Delete class
    await prisma.class.delete({ where: { id } });

    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({ error: 'Failed to delete class' });
  }
});

module.exports = router;
