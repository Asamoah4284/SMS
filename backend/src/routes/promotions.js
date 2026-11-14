const { Router } = require('express');
const prisma = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { renumberClassesStudentIds } = require('../utils/studentId');

const router = Router();
router.use(authenticate);

async function getTeacherClass(req) {
  return prisma.class.findFirst({
    where: { classTeacher: { userId: req.user.id } },
    select: { id: true, name: true, classNumber: true },
  });
}

async function allowedSourceClass(req, classId) {
  if (req.user.role === 'ADMIN') {
    return prisma.class.findUnique({ where: { id: classId } });
  }
  if (req.user.role !== 'TEACHER') return null;
  const teacherClass = await getTeacherClass(req);
  return teacherClass?.id === classId ? teacherClass : null;
}

router.get('/classes', authorize('ADMIN', 'TEACHER'), async (req, res) => {
  try {
    const where = req.user.role === 'ADMIN'
      ? {}
      : { classTeacher: { userId: req.user.id } };
    const classes = await prisma.class.findMany({
      where,
      select: { id: true, name: true, level: true, classNumber: true, _count: { select: { students: true } } },
      orderBy: { classNumber: 'asc' },
    });
    res.json({ classes });
  } catch (error) {
    console.error('GET /promotions/classes', error);
    res.status(500).json({ message: 'Failed to load promotion classes' });
  }
});

router.get('/roster', authorize('ADMIN', 'TEACHER'), async (req, res) => {
  try {
    const sourceClassId = String(req.query.classId || '');
    const source = await allowedSourceClass(req, sourceClassId);
    if (!source) return res.status(403).json({ message: 'You cannot prepare promotions for this class' });

    const [students, suggestedTarget] = await Promise.all([
      prisma.student.findMany({
        where: { classId: sourceClassId, isActive: true },
        select: { id: true, studentId: true, firstName: true, lastName: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      prisma.class.findFirst({
        where: { classNumber: { gt: source.classNumber } },
        select: { id: true, name: true, level: true, classNumber: true },
        orderBy: { classNumber: 'asc' },
      }),
    ]);

    const draft = await prisma.promotionBatch.findFirst({
      where: { sourceClassId, status: 'DRAFT' },
      orderBy: { createdAt: 'desc' },
      include: { decisions: true },
    });
    res.json({ sourceClass: source, suggestedTarget, students, draft });
  } catch (error) {
    console.error('GET /promotions/roster', error);
    res.status(500).json({ message: 'Failed to load promotion roster' });
  }
});

router.post('/drafts', authorize('ADMIN', 'TEACHER'), async (req, res) => {
  try {
    const { sourceClassId, decisions } = req.body || {};
    const source = await allowedSourceClass(req, sourceClassId);
    if (!source) return res.status(403).json({ message: 'You cannot prepare promotions for this class' });
    if (!Array.isArray(decisions) || decisions.length === 0) {
      return res.status(400).json({ message: 'At least one student decision is required' });
    }

    const studentIds = decisions.map((decision) => decision.studentId);
    const students = await prisma.student.findMany({
      where: { id: { in: studentIds }, classId: sourceClassId, isActive: true },
      select: { id: true },
    });
    if (students.length !== studentIds.length) {
      return res.status(400).json({ message: 'All selected students must belong to the source class' });
    }

    const targetIds = decisions
      .filter((decision) => decision.action === 'PROMOTE')
      .map((decision) => decision.targetClassId)
      .filter(Boolean);
    if (targetIds.length !== decisions.filter((decision) => decision.action === 'PROMOTE').length) {
      return res.status(400).json({ message: 'Promoted students require a destination class' });
    }
    const validTargets = await prisma.class.findMany({ where: { id: { in: targetIds } }, select: { id: true } });
    if (validTargets.length !== new Set(targetIds).size) {
      return res.status(400).json({ message: 'One or more destination classes are invalid' });
    }

    const batch = await prisma.promotionBatch.create({
      data: {
        sourceClassId,
        targetClassId: targetIds[0] || null,
        createdById: req.user.id,
        decisions: {
          create: decisions.map((decision) => ({
            studentId: decision.studentId,
            action: decision.action,
            targetClassId: decision.action === 'PROMOTE' ? decision.targetClassId : null,
            note: decision.note || null,
          })),
        },
      },
      include: { decisions: true },
    });
    res.status(201).json({ batch });
  } catch (error) {
    console.error('POST /promotions/drafts', error);
    res.status(500).json({ message: 'Failed to save promotion recommendations' });
  }
});

router.post('/:id/finalize', authorize('ADMIN'), async (req, res) => {
  try {
    const batch = await prisma.promotionBatch.findUnique({
      where: { id: req.params.id },
      include: { decisions: true },
    });
    if (!batch) return res.status(404).json({ message: 'Promotion draft not found' });
    if (batch.status === 'FINALIZED') return res.status(400).json({ message: 'Promotion is already finalized' });

    const sourceStudents = await prisma.student.findMany({
      where: { classId: batch.sourceClassId, isActive: true },
      select: { id: true },
    });
    const decisionIds = new Set(batch.decisions.map((decision) => decision.studentId));
    if (sourceStudents.some((student) => !decisionIds.has(student.id))) {
      return res.status(400).json({ message: 'Every active student must have a promotion decision' });
    }

    const affectedClasses = new Set([batch.sourceClassId]);
    await prisma.$transaction(async (tx) => {
      for (const decision of batch.decisions) {
        if (decision.action === 'PROMOTE') {
          await tx.student.update({
            where: { id: decision.studentId },
            data: { classId: decision.targetClassId, isActive: true },
          });
          affectedClasses.add(decision.targetClassId);
        } else if (decision.action === 'REPEAT') {
          await tx.student.update({
            where: { id: decision.studentId },
            data: { classId: batch.sourceClassId, isActive: true },
          });
        } else {
          await tx.student.update({
            where: { id: decision.studentId },
            data: { classId: null, isActive: false },
          });
        }
      }
      await tx.promotionBatch.update({
        where: { id: batch.id },
        data: { status: 'FINALIZED', finalizedById: req.user.id, finalizedAt: new Date() },
      });
    });

    await renumberClassesStudentIds(prisma, [...affectedClasses]);
    res.json({ message: 'Promotion finalized successfully' });
  } catch (error) {
    console.error('POST /promotions/:id/finalize', error);
    res.status(500).json({ message: 'Failed to finalize promotion' });
  }
});

module.exports = router;
