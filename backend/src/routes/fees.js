const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../config/db');

const router = Router();
router.use(authenticate);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Compute a student's payment status for a given fee structure */
function computeStatus(amountDue, totalPaid) {
  if (totalPaid <= 0) return 'UNPAID';
  if (totalPaid >= amountDue) return 'FULLY_PAID';
  if (totalPaid >= amountDue / 2) return 'HALF_PAID';
  return 'PARTIAL';
}

// ─── GET /fees/structures ─────────────────────────────────────────────────────
// Query: ?termId=
router.get('/structures', async (req, res) => {
  try {
    const { termId } = req.query;
    const where = termId ? { termId } : {};
    const structures = await prisma.feeStructure.findMany({
      where,
      include: { term: { select: { id: true, name: true, year: true } }, _count: { select: { feePayments: true } } },
      orderBy: [{ classLevel: 'asc' }, { name: 'asc' }],
    });
    res.json({ structures });
  } catch (err) {
    console.error('GET /fees/structures', err);
    res.status(500).json({ message: 'Failed to fetch fee structures' });
  }
});

// ─── POST /fees/structures ────────────────────────────────────────────────────
router.post('/structures', authorize('ADMIN'), async (req, res) => {
  try {
    const { name, amount, classLevel, termId } = req.body;
    if (!name || !amount) return res.status(400).json({ message: 'name and amount are required' });

    const structure = await prisma.feeStructure.create({
      data: {
        name,
        amount: parseFloat(amount),
        classLevel: classLevel || null,
        termId: termId || null,
      },
    });
    res.status(201).json({ message: 'Fee structure created', structure });
  } catch (err) {
    console.error('POST /fees/structures', err);
    res.status(500).json({ message: 'Failed to create fee structure' });
  }
});

// ─── PUT /fees/structures/:id ─────────────────────────────────────────────────
router.put('/structures/:id', authorize('ADMIN'), async (req, res) => {
  try {
    const { name, amount, classLevel, termId } = req.body;
    const structure = await prisma.feeStructure.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(classLevel !== undefined && { classLevel: classLevel || null }),
        ...(termId !== undefined && { termId: termId || null }),
      },
    });
    res.json({ message: 'Fee structure updated', structure });
  } catch (err) {
    console.error('PUT /fees/structures/:id', err);
    res.status(500).json({ message: 'Failed to update fee structure' });
  }
});

// ─── DELETE /fees/structures/:id ──────────────────────────────────────────────
router.delete('/structures/:id', authorize('ADMIN'), async (req, res) => {
  try {
    const count = await prisma.feePayment.count({ where: { feeStructureId: req.params.id } });
    if (count > 0) {
      return res.status(400).json({ message: 'Cannot delete fee structure with existing payments' });
    }
    await prisma.feeStructure.delete({ where: { id: req.params.id } });
    res.json({ message: 'Fee structure deleted' });
  } catch (err) {
    console.error('DELETE /fees/structures/:id', err);
    res.status(500).json({ message: 'Failed to delete fee structure' });
  }
});

// ─── GET /fees/overview ───────────────────────────────────────────────────────
// Query: ?termId=
// Returns all classes with collection summary for the term
router.get('/overview', authorize('ADMIN'), async (req, res) => {
  try {
    const { termId } = req.query;
    if (!termId) return res.status(400).json({ message: 'termId is required' });

    // Get all classes with student counts
    const classes = await prisma.class.findMany({
      include: {
        classTeacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        _count: { select: { students: { where: { isActive: true } } } },
      },
      orderBy: { name: 'asc' },
    });

    // Get fee structures for this term (by classLevel)
    const structures = await prisma.feeStructure.findMany({
      where: { termId },
    });
    const structureByLevel = {};
    structures.forEach((s) => {
      if (s.classLevel) structureByLevel[s.classLevel] = s;
    });

    // Get all payments for this term, grouped by student class
    const payments = await prisma.feePayment.findMany({
      where: { termId },
      include: {
        student: { select: { classId: true } },
        feeStructure: { select: { amount: true } },
      },
    });

    // Aggregate payments by classId
    const paymentByClass = {};
    payments.forEach((p) => {
      const cid = p.student.classId;
      if (!cid) return;
      if (!paymentByClass[cid]) paymentByClass[cid] = { totalCollected: 0, studentsPaid: new Set(), studentsPartial: new Set() };
      paymentByClass[cid].totalCollected += p.amountPaid;
    });

    // Get per-student totals for status breakdown per class
    const studentPaymentTotals = await prisma.feePayment.groupBy({
      by: ['studentId'],
      where: { termId },
      _sum: { amountPaid: true },
    });
    const studentTotalMap = {};
    studentPaymentTotals.forEach((sp) => {
      studentTotalMap[sp.studentId] = sp._sum.amountPaid ?? 0;
    });

    // Get students by class for status breakdown
    const allStudents = await prisma.student.findMany({
      where: { isActive: true },
      select: { id: true, classId: true, class: { select: { level: true } } },
    });

    const classStatusMap = {};
    allStudents.forEach((st) => {
      const cid = st.classId;
      if (!cid) return;
      const level = st.class?.level;
      const structure = level ? structureByLevel[level] : null;
      const amountDue = structure?.amount ?? 0;
      const totalPaid = studentTotalMap[st.id] ?? 0;
      const status = amountDue > 0 ? computeStatus(amountDue, totalPaid) : null;

      if (!classStatusMap[cid]) classStatusMap[cid] = { fullyPaid: 0, partial: 0, halfPaid: 0, unpaid: 0, noStructure: 0, totalCollected: 0 };
      classStatusMap[cid].totalCollected += totalPaid;
      if (status === 'FULLY_PAID') classStatusMap[cid].fullyPaid++;
      else if (status === 'HALF_PAID') classStatusMap[cid].halfPaid++;
      else if (status === 'PARTIAL') classStatusMap[cid].partial++;
      else if (status === 'UNPAID') classStatusMap[cid].unpaid++;
      else classStatusMap[cid].noStructure++;
    });

    const result = classes.map((cls) => {
      const stats = classStatusMap[cls.id] ?? { fullyPaid: 0, partial: 0, halfPaid: 0, unpaid: 0, noStructure: 0, totalCollected: 0 };
      const total = cls._count.students;
      const structure = structureByLevel[cls.level] ?? null;
      const totalDue = structure ? structure.amount * total : null;
      return {
        id: cls.id,
        name: cls.name,
        level: cls.level,
        classTeacher: cls.classTeacher
          ? { name: `${cls.classTeacher.user.firstName} ${cls.classTeacher.user.lastName}` }
          : null,
        totalStudents: total,
        feeStructure: structure ? { id: structure.id, name: structure.name, amount: structure.amount } : null,
        totalDue,
        totalCollected: stats.totalCollected,
        fullyPaid: stats.fullyPaid,
        halfPaid: stats.halfPaid,
        partial: stats.partial,
        unpaid: stats.unpaid,
        noStructure: stats.noStructure,
        collectionRate: totalDue && totalDue > 0 ? Math.round((stats.totalCollected / totalDue) * 100) : null,
      };
    });

    res.json({ classes: result });
  } catch (err) {
    console.error('GET /fees/overview', err);
    res.status(500).json({ message: 'Failed to fetch fee overview' });
  }
});

// ─── GET /fees/class/:classId ─────────────────────────────────────────────────
// Query: ?termId=
// Returns each student in the class with their payment status and history
router.get('/class/:classId', authorize('ADMIN'), async (req, res) => {
  try {
    const { classId } = req.params;
    const { termId } = req.query;
    if (!termId) return res.status(400).json({ message: 'termId is required' });

    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, name: true, level: true },
    });
    if (!cls) return res.status(404).json({ message: 'Class not found' });

    // Fee structure for this class level + term
    const structure = await prisma.feeStructure.findFirst({
      where: { classLevel: cls.level, termId },
    });

    // All active students in class
    const students = await prisma.student.findMany({
      where: { classId, isActive: true },
      select: {
        id: true, firstName: true, lastName: true, studentId: true, parentName: true, parentPhone: true,
        parent: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    // All payments for these students this term
    const studentIds = students.map((s) => s.id);
    const payments = await prisma.feePayment.findMany({
      where: { studentId: { in: studentIds }, termId },
      include: { feeStructure: { select: { id: true, name: true, amount: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Group payments by student
    const paymentMap = {};
    payments.forEach((p) => {
      if (!paymentMap[p.studentId]) paymentMap[p.studentId] = [];
      paymentMap[p.studentId].push(p);
    });

    const amountDue = structure?.amount ?? 0;

    const result = students.map((st) => {
      const studentPayments = paymentMap[st.id] ?? [];
      const totalPaid = studentPayments.reduce((s, p) => s + p.amountPaid, 0);
      const balance = Math.max(0, amountDue - totalPaid);
      const status = amountDue > 0 ? computeStatus(amountDue, totalPaid) : 'NO_STRUCTURE';
      const parentName = st.parent
        ? `${st.parent.user.firstName} ${st.parent.user.lastName}`
        : st.parentName;
      const parentPhone = st.parent?.user.phone ?? st.parentPhone;

      return {
        id: st.id,
        studentId: st.studentId,
        name: `${st.firstName} ${st.lastName}`,
        parentName,
        parentPhone,
        amountDue,
        totalPaid,
        balance,
        status,
        payments: studentPayments.map((p) => ({
          id: p.id,
          amountPaid: p.amountPaid,
          paymentMethod: p.paymentMethod,
          receiptNumber: p.receiptNumber,
          paidAt: p.paidAt,
          feeStructure: p.feeStructure,
        })),
      };
    });

    res.json({
      class: { id: cls.id, name: cls.name, level: cls.level },
      feeStructure: structure
        ? { id: structure.id, name: structure.name, amount: structure.amount }
        : null,
      students: result,
    });
  } catch (err) {
    console.error('GET /fees/class/:classId', err);
    res.status(500).json({ message: 'Failed to fetch class fees' });
  }
});

// ─── GET /fees/student/:studentId ─────────────────────────────────────────────
// Query: ?termId=
router.get('/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { termId } = req.query;

    // Parents can only view their own child
    if (req.user.role === 'PARENT') {
      const parent = await prisma.parent.findFirst({
        where: { userId: req.user.id, children: { some: { id: studentId } } },
      });
      if (!parent) return res.status(403).json({ message: 'Access denied' });
    }

    const where = { studentId, ...(termId && { termId }) };
    const payments = await prisma.feePayment.findMany({
      where,
      include: {
        feeStructure: { select: { id: true, name: true, amount: true } },
        term: { select: { id: true, name: true, year: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalPaid = payments.reduce((s, p) => s + p.amountPaid, 0);
    const totalDue = payments.reduce((s, p) => s + p.feeStructure.amount, 0);

    res.json({ payments, totalPaid, totalDue, balance: Math.max(0, totalDue - totalPaid) });
  } catch (err) {
    console.error('GET /fees/student/:studentId', err);
    res.status(500).json({ message: 'Failed to fetch student fees' });
  }
});

// ─── POST /fees/payments ──────────────────────────────────────────────────────
// Body: { studentId, feeStructureId, termId, amountPaid, paymentMethod, receiptNumber, paidAt }
router.post('/payments', authorize('ADMIN'), async (req, res) => {
  try {
    const { studentId, feeStructureId, termId, amountPaid, paymentMethod, receiptNumber, paidAt } = req.body;
    if (!studentId || !feeStructureId || !termId || !amountPaid) {
      return res.status(400).json({ message: 'studentId, feeStructureId, termId, and amountPaid are required' });
    }

    // Get structure to compute status
    const structure = await prisma.feeStructure.findUnique({ where: { id: feeStructureId } });
    if (!structure) return res.status(404).json({ message: 'Fee structure not found' });

    // Compute running total
    const existing = await prisma.feePayment.aggregate({
      where: { studentId, feeStructureId, termId },
      _sum: { amountPaid: true },
    });
    const runningTotal = (existing._sum.amountPaid ?? 0) + parseFloat(amountPaid);
    const status = computeStatus(structure.amount, runningTotal);

    const payment = await prisma.feePayment.create({
      data: {
        studentId,
        feeStructureId,
        termId,
        amountPaid: parseFloat(amountPaid),
        paymentStatus: status,
        paymentMethod: paymentMethod || null,
        receiptNumber: receiptNumber || null,
        paidAt: paidAt ? new Date(paidAt) : new Date(),
      },
      include: {
        feeStructure: { select: { id: true, name: true, amount: true } },
        term: { select: { id: true, name: true, year: true } },
      },
    });

    res.status(201).json({ message: 'Payment recorded', payment });
  } catch (err) {
    console.error('POST /fees/payments', err);
    res.status(500).json({ message: 'Failed to record payment' });
  }
});

// ─── DELETE /fees/payments/:id ────────────────────────────────────────────────
router.delete('/payments/:id', authorize('ADMIN'), async (req, res) => {
  try {
    await prisma.feePayment.delete({ where: { id: req.params.id } });
    res.json({ message: 'Payment reversed' });
  } catch (err) {
    console.error('DELETE /fees/payments/:id', err);
    res.status(500).json({ message: 'Failed to delete payment' });
  }
});

module.exports = router;
