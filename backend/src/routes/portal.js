const { Router } = require('express');
const prisma = require('../config/db');
const { authenticateParent, parentPhoneVariants, parentHasAccessToStudent } = require('../middleware/parentPortalAuth');
const { getStudentFeeLinesForTerm } = require('../utils/studentFeeLines');
const { computeClassPositionByTerm } = require('../utils/classRanking');
const {
  finalizeFeeMoolreIntentByReference,
  markIntentFailed,
} = require('../services/paystackFinalize');
const {
  finalizeBookMoolreIntentByReference,
  markBookIntentFailed,
} = require('../services/bookPaystackFinalize');
const { getStudentBookLines } = require('../utils/studentBooks');
const { applyPlatformFee } = require('../utils/commission');
const {
  billingEmailFromStudent,
  generateBookPaymentReference,
  generateFeePaymentReference,
  initializeMoolreEmbedLink,
} = require('../services/moolreEmbedPayment');
const { isMoolrePaymentsConfigured } = require('../services/moolreAuth');
const { checkMoolrePaymentStatus } = require('../services/moolrePaymentStatus');
const { fetchReportCardData } = require('../services/reportCardData');

const router = Router();

// ─────────────────────────────────────────────────────────────────
// GET /portal/child/:studentId
// ─────────────────────────────────────────────────────────────────

router.get('/child/:studentId', authenticateParent, async (req, res) => {
  try {
    const { studentId } = req.params;
    const phoneVariants = parentPhoneVariants(req.parentPhone);

    const student = await prisma.student.findUnique({
      where: { studentId },
      include: {
        class: {
          include: {
            classTeacher: {
              include: {
                user: { select: { firstName: true, lastName: true, phone: true } },
              },
            },
          },
        },
        parent: {
          include: { user: { select: { phone: true } } },
        },
        attendances: {
          orderBy: { date: 'desc' },
          take: 30,
          select: { status: true, date: true },
        },
        feePayments: {
          include: { feeStructure: { select: { amount: true, name: true } } },
        },
        results: {
          include: {
            subject: { select: { name: true } },
            term: { select: { name: true, year: true } },
          },
          orderBy: [{ term: { year: 'desc' } }, { subject: { name: 'asc' } }],
        },
        termRemarks: {
          include: { term: { select: { name: true, year: true } } },
          orderBy: { term: { year: 'desc' } },
          take: 1,
        },
      },
    });

    if (!student) return res.status(404).json({ error: 'Student not found' });

    const hasAccess = parentHasAccessToStudent(student, phoneVariants);

    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    const total = student.attendances.length;
    const present = student.attendances.filter(
      (a) => a.status === 'PRESENT' || a.status === 'LATE'
    ).length;
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : null;

    const currentTerm = await prisma.term.findFirst({ where: { isCurrent: true } });
    let feesPayload = {
      totalDue: 0,
      totalPaid: 0,
      balance: 0,
      status: null,
      termName: currentTerm?.name ?? null,
      lineItems: [],
    };

    if (currentTerm) {
      const { lines, totalDue, totalPaid, balance } = await getStudentFeeLinesForTerm(
        prisma,
        student.id,
        currentTerm.id
      );
      const feeStatus =
        totalDue === 0
          ? null
          : totalPaid >= totalDue - 0.01
          ? 'FULLY_PAID'
          : totalPaid > 0
          ? 'PARTIAL'
          : 'UNPAID';

      feesPayload = {
        totalDue,
        totalPaid,
        balance: Math.max(0, balance),
        status: feeStatus,
        termName: currentTerm.name,
        lineItems: lines,
      };
    }

    const termIds = [...new Set(student.results.map((r) => r.termId))];
    const classPositionByTerm = await computeClassPositionByTerm(
      prisma,
      student.id,
      student.classId,
      termIds
    );

    res.json({
      student: {
        id: student.id,
        studentId: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        gender: student.gender,
        photo: student.photo,
        class: student.class
          ? {
              id: student.class.id,
              name: student.class.name,
              level: student.class.level,
              teacher: student.class.classTeacher
                ? {
                    name: `${student.class.classTeacher.user.firstName} ${student.class.classTeacher.user.lastName}`,
                    phone: student.class.classTeacher.user.phone,
                  }
                : null,
            }
          : null,
      },
      attendance: {
        rate: attendanceRate,
        recentAbsences: student.attendances.filter((a) => a.status === 'ABSENT').length,
        recentRecords: student.attendances.map((a) => ({
          date: a.date,
          status: a.status,
        })),
      },
      fees: feesPayload,
      results: student.results.map((r) => ({
        subject: r.subject.name,
        termId: r.termId,
        term: `${r.term.name} ${r.term.year}`,
        classScore: r.classScore,
        examScore: r.examScore,
        totalScore: r.totalScore,
        grade: r.grade,
        remarks: r.remarks,
        position: r.position,
      })),
      classPositionByTerm,
      latestRemarks: student.termRemarks[0]
        ? {
            teacherRemarks: student.termRemarks[0].teacherRemarks,
            headmasterRemarks: student.termRemarks[0].headmasterRemarks,
            term: `${student.termRemarks[0].term.name} ${student.termRemarks[0].term.year}`,
          }
        : null,
    });
  } catch (error) {
    console.error('GET /portal/child error:', error);
    res.status(500).json({ error: 'Failed to fetch child data' });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /portal/child/:studentId/reportcard/:termId
// Parent report card (published results only)
// ─────────────────────────────────────────────────────────────────

router.get('/child/:studentId/reportcard/:termId', authenticateParent, async (req, res) => {
  try {
    const { studentId: schoolStudentId, termId } = req.params;
    const phoneVariants = parentPhoneVariants(req.parentPhone);

    const student = await prisma.student.findUnique({
      where: { studentId: schoolStudentId },
      include: { parent: { include: { user: { select: { phone: true } } } } },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const hasAccess = parentHasAccessToStudent(student, phoneVariants);
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    const result = await fetchReportCardData(student.id, termId, { requirePublished: true });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.message });
    }

    res.json(result.data);
  } catch (error) {
    console.error('GET /portal/child/:studentId/reportcard/:termId', error);
    res.status(500).json({ error: 'Failed to fetch report card' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /portal/fees/moolre/initialize
// Body: { studentId, amount?: GHS, callbackUrl?, feeStructureIds?: string[] }
// Legacy alias: POST /portal/paystack/initialize
// ─────────────────────────────────────────────────────────────────

async function initializeFeeMoolrePayment(req, res) {
  try {
    if (!isMoolrePaymentsConfigured()) {
      return res.status(503).json({ error: 'Online payments are not configured on this server' });
    }

    const { studentId: schoolStudentId, amount: amountRaw, callbackUrl, feeStructureIds: feeIdsRaw } =
      req.body || {};
    if (!schoolStudentId || typeof schoolStudentId !== 'string') {
      return res.status(400).json({ error: 'studentId is required' });
    }

    const phoneVariants = parentPhoneVariants(req.parentPhone);

    const student = await prisma.student.findUnique({
      where: { studentId: schoolStudentId.trim() },
      include: {
        parent: { include: { user: { select: { phone: true, email: true, firstName: true, lastName: true } } } },
      },
    });

    if (!student) return res.status(404).json({ error: 'Student not found' });

    const hasAccess = parentHasAccessToStudent(student, phoneVariants);
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    const currentTerm = await prisma.term.findFirst({ where: { isCurrent: true } });
    if (!currentTerm) {
      return res.status(400).json({ error: 'No active school term — fees cannot be collected yet' });
    }

    const linesData = await getStudentFeeLinesForTerm(prisma, student.id, currentTerm.id);
    const { balance } = linesData;
    if (balance <= 0.004) {
      return res.status(400).json({ error: 'No outstanding balance for this term' });
    }

    let targetFeeStructureIds = null;
    let maxPayable = balance;

    if (feeIdsRaw !== undefined && feeIdsRaw !== null) {
      if (!Array.isArray(feeIdsRaw)) {
        return res.status(400).json({ error: 'feeStructureIds must be an array' });
      }
      const ids = [...new Set(feeIdsRaw.map((id) => String(id).trim()).filter(Boolean))];
      if (ids.length === 0) {
        return res.status(400).json({ error: 'Select at least one fee to pay' });
      }
      const lineById = new Map(linesData.lines.map((l) => [l.feeStructureId, l]));
      let sumSel = 0;
      for (const id of ids) {
        const line = lineById.get(id);
        if (!line) {
          return res.status(400).json({ error: 'One or more selected fees are not valid for this term' });
        }
        if (line.remaining <= 0.004) {
          return res.status(400).json({ error: `Nothing left to pay for: ${line.name}` });
        }
        sumSel += line.remaining;
      }
      targetFeeStructureIds = ids;
      maxPayable = Math.min(balance, sumSel);
    }

    let schoolAmount = maxPayable;
    if (amountRaw != null && amountRaw !== '') {
      const n = typeof amountRaw === 'number' ? amountRaw : parseFloat(String(amountRaw));
      if (!Number.isFinite(n) || n <= 0) {
        return res.status(400).json({ error: 'amount must be a positive number' });
      }
      schoolAmount = Math.min(n, maxPayable);
    }

    if (callbackUrl != null && typeof callbackUrl === 'string' && callbackUrl.length > 0) {
      const ok =
        callbackUrl.startsWith('edutracksms://') ||
        callbackUrl.startsWith('exp://') ||
        callbackUrl.startsWith('http://localhost') ||
        callbackUrl.startsWith('http://127.0.0.1');
      if (!ok) {
        return res.status(400).json({ error: 'callbackUrl is not allowed' });
      }
    }

    if (schoolAmount < 0.01) {
      return res.status(400).json({ error: 'Minimum payment is GH₵0.01' });
    }

    const feeBreakdown = applyPlatformFee(schoolAmount, 'FEE');
    const amountPesewas = feeBreakdown.grossPesewas;
    if (amountPesewas < 1) {
      return res.status(400).json({ error: 'Amount too small after conversion' });
    }

    const reference = generateFeePaymentReference();
    const parentPhone = student.parent?.user?.phone || student.parentPhone || req.parentPhone;
    const email = billingEmailFromStudent(
      schoolStudentId,
      reference,
      student.parent?.user?.email,
      parentPhone
    );

    await prisma.paystackIntent.create({
      data: {
        reference,
        amountGhs: feeBreakdown.grossGhs,
        amountPesewas,
        schoolAmountGhs: feeBreakdown.schoolAmountGhs,
        platformFeeGhs: feeBreakdown.platformFeeGhs,
        studentId: student.id,
        termId: currentTerm.id,
        callbackUrl: callbackUrl || null,
        targetFeeStructureIds: targetFeeStructureIds ?? [],
      },
    });

    const moolre = await initializeMoolreEmbedLink({
      amount: feeBreakdown.grossGhs,
      email,
      externalref: reference,
      metadata: {
        type: 'fees',
        studentSchoolId: schoolStudentId,
        termId: currentTerm.id,
      },
    });

    if (!moolre.ok || !moolre.authorization_url) {
      await prisma.paystackIntent.update({
        where: { reference },
        data: { status: 'FAILED' },
      });
      return res.status(502).json({
        error: moolre.error || 'Could not start payment with Moolre',
      });
    }

    return res.json({
      authorizationUrl: moolre.authorization_url,
      reference,
      schoolAmountGhs: feeBreakdown.schoolAmountGhs,
      platformFeeGhs: feeBreakdown.platformFeeGhs,
      grossAmountGhs: feeBreakdown.grossGhs,
      commissionRatePercent: feeBreakdown.commissionRatePercent,
      currency: 'GHS',
      provider: 'moolre',
    });
  } catch (error) {
    console.error('POST /portal/fees/moolre/initialize error:', error);
    res.status(500).json({ error: 'Failed to initialize payment' });
  }
}

router.post('/fees/moolre/initialize', authenticateParent, initializeFeeMoolrePayment);
// Backward-compatible alias (app may still call paystack path during rollout)
router.post('/paystack/initialize', authenticateParent, initializeFeeMoolrePayment);

async function verifyFeeMoolrePayment(req, res) {
  try {
    if (!isMoolrePaymentsConfigured()) {
      return res.status(503).json({ error: 'Online payments are not configured' });
    }

    const { reference } = req.params;
    const intent = await prisma.paystackIntent.findUnique({
      where: { reference },
    });
    if (!intent) return res.status(404).json({ error: 'Payment not found' });

    const phoneVariants = parentPhoneVariants(req.parentPhone);
    const st = await prisma.student.findUnique({
      where: { id: intent.studentId },
      include: { parent: { include: { user: { select: { phone: true } } } } },
    });
    if (!st) return res.status(404).json({ error: 'Student not found' });

    const hasAccess = parentHasAccessToStudent(st, phoneVariants);
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    if (intent.status === 'SUCCESS') {
      return res.json({ status: 'SUCCESS', reference });
    }
    if (intent.status === 'FAILED') {
      return res.json({ status: 'FAILED', reference });
    }

    const status = await checkMoolrePaymentStatus(reference);
    if (status.isPaid) {
      const amountGhs = Number(status.data?.amount ?? status.data?.Amount ?? intent.amountGhs);
      const finalize = await finalizeFeeMoolreIntentByReference(reference, amountGhs);
      if (!finalize.ok && finalize.reason === 'AMOUNT_MISMATCH') {
        return res.status(400).json({ error: 'Amount verification failed' });
      }
      return res.json({ status: 'SUCCESS', reference });
    }

    if (status.txStatusNum === 2) {
      await markIntentFailed(reference);
      return res.json({ status: 'FAILED', reference });
    }

    return res.json({
      status: intent.status,
      reference,
      moolreStatus: status.message || 'pending',
    });
  } catch (error) {
    console.error('GET /portal/fees/moolre/verify error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
}

router.get('/fees/moolre/verify/:reference', authenticateParent, verifyFeeMoolrePayment);
router.get('/paystack/verify/:reference', authenticateParent, verifyFeeMoolrePayment);

// ─────────────────────────────────────────────────────────────────
// GET /portal/child/:studentId/books
// ─────────────────────────────────────────────────────────────────

router.get('/child/:studentId/books', authenticateParent, async (req, res) => {
  try {
    const { studentId: schoolStudentId } = req.params;
    const phoneVariants = parentPhoneVariants(req.parentPhone);

    const student = await prisma.student.findUnique({
      where: { studentId: schoolStudentId },
      include: { parent: { include: { user: { select: { phone: true } } } } },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const hasAccess = parentHasAccessToStudent(student, phoneVariants);
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    const currentTerm = await prisma.term.findFirst({ where: { isCurrent: true } });
    if (!currentTerm) {
      return res.json({ termName: null, books: [], totalDue: 0, totalPaid: 0, balance: 0 });
    }

    const lines = await getStudentBookLines(prisma, student.id, currentTerm.id);
    res.json({
      termId: currentTerm.id,
      termName: `${currentTerm.name} ${currentTerm.year}`,
      ...lines,
    });
  } catch (error) {
    console.error('GET /portal/child/:studentId/books error:', error);
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /portal/books/moolre/initialize
// Body: { studentId, bookIds?: string[], amount?: GHS, callbackUrl? }
// Legacy alias: POST /portal/books/paystack/initialize
// ─────────────────────────────────────────────────────────────────

async function initializeBookMoolrePayment(req, res) {
  try {
    if (!isMoolrePaymentsConfigured()) {
      return res.status(503).json({ error: 'Online payments are not configured on this server' });
    }

    const { studentId: schoolStudentId, bookIds: bookIdsRaw, amount: amountRaw, callbackUrl } =
      req.body || {};
    if (!schoolStudentId || typeof schoolStudentId !== 'string') {
      return res.status(400).json({ error: 'studentId is required' });
    }

    const phoneVariants = parentPhoneVariants(req.parentPhone);
    const student = await prisma.student.findUnique({
      where: { studentId: schoolStudentId.trim() },
      include: {
        parent: { include: { user: { select: { phone: true, email: true } } } },
      },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const hasAccess = parentHasAccessToStudent(student, phoneVariants);
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    const currentTerm = await prisma.term.findFirst({ where: { isCurrent: true } });
    if (!currentTerm) {
      return res.status(400).json({ error: 'No active school term' });
    }

    const linesData = await getStudentBookLines(prisma, student.id, currentTerm.id);
    const unpaid = linesData.books.filter((b) => !b.isPaid && b.remaining > 0.004);
    if (unpaid.length === 0) {
      return res.status(400).json({ error: 'No unpaid books for this term' });
    }

    let targetBooks = unpaid;
    if (bookIdsRaw !== undefined && bookIdsRaw !== null) {
      if (!Array.isArray(bookIdsRaw)) {
        return res.status(400).json({ error: 'bookIds must be an array' });
      }
      const ids = [...new Set(bookIdsRaw.map((id) => String(id).trim()).filter(Boolean))];
      if (ids.length === 0) {
        return res.status(400).json({ error: 'Select at least one book to pay' });
      }
      targetBooks = unpaid.filter((b) => ids.includes(b.bookId));
      if (targetBooks.length === 0) {
        return res.status(400).json({ error: 'Selected books are not valid or already paid' });
      }
    }

    const maxPayable = targetBooks.reduce((s, b) => s + b.remaining, 0);
    let schoolAmount = maxPayable;
    if (amountRaw != null && amountRaw !== '') {
      const n = typeof amountRaw === 'number' ? amountRaw : parseFloat(String(amountRaw));
      if (!Number.isFinite(n) || n <= 0) {
        return res.status(400).json({ error: 'amount must be a positive number' });
      }
      schoolAmount = Math.min(n, maxPayable);
    }

    if (schoolAmount < 0.01) {
      return res.status(400).json({ error: 'Minimum payment is GH₵0.01' });
    }

    if (callbackUrl != null && typeof callbackUrl === 'string' && callbackUrl.length > 0) {
      const ok =
        callbackUrl.startsWith('edutracksms://') ||
        callbackUrl.startsWith('exp://') ||
        callbackUrl.startsWith('http://localhost') ||
        callbackUrl.startsWith('http://127.0.0.1');
      if (!ok) {
        return res.status(400).json({ error: 'callbackUrl is not allowed' });
      }
    }

    const bookBreakdown = applyPlatformFee(schoolAmount, 'BOOK');
    const amountPesewas = bookBreakdown.grossPesewas;
    if (amountPesewas < 1) {
      return res.status(400).json({ error: 'Amount too small after conversion' });
    }

    const reference = generateBookPaymentReference();
    const parentPhone = student.parent?.user?.phone || student.parentPhone || req.parentPhone;
    const email = billingEmailFromStudent(
      schoolStudentId,
      reference,
      student.parent?.user?.email,
      parentPhone
    );

    await prisma.bookPaystackIntent.create({
      data: {
        reference,
        amountGhs: bookBreakdown.grossGhs,
        amountPesewas,
        schoolAmountGhs: bookBreakdown.schoolAmountGhs,
        platformFeeGhs: bookBreakdown.platformFeeGhs,
        studentId: student.id,
        termId: currentTerm.id,
        callbackUrl: callbackUrl || null,
        targetBookIds: targetBooks.map((b) => b.bookId),
      },
    });

    const moolre = await initializeMoolreEmbedLink({
      amount: bookBreakdown.grossGhs,
      email,
      externalref: reference,
      metadata: {
        type: 'books',
        studentSchoolId: schoolStudentId,
        termId: currentTerm.id,
      },
      // Always use backend success page so the WebView can postMessage + poll verify.
      // App deep links (exp://) are stored on the intent but not sent to Moolre as redirect.
    });

    if (!moolre.ok || !moolre.authorization_url) {
      await prisma.bookPaystackIntent.update({
        where: { reference },
        data: { status: 'FAILED' },
      });
      return res.status(502).json({
        error: moolre.error || 'Could not start payment with Moolre',
      });
    }

    return res.json({
      authorizationUrl: moolre.authorization_url,
      reference,
      schoolAmountGhs: bookBreakdown.schoolAmountGhs,
      platformFeeGhs: bookBreakdown.platformFeeGhs,
      grossAmountGhs: bookBreakdown.grossGhs,
      commissionRatePercent: bookBreakdown.commissionRatePercent,
      currency: 'GHS',
      provider: 'moolre',
    });
  } catch (error) {
    console.error('POST /portal/books/moolre/initialize error:', error);
    res.status(500).json({ error: 'Failed to initialize payment' });
  }
}

router.post('/books/moolre/initialize', authenticateParent, initializeBookMoolrePayment);
// Backward-compatible alias (app may still call paystack path during rollout)
router.post('/books/paystack/initialize', authenticateParent, initializeBookMoolrePayment);

async function verifyBookMoolrePayment(req, res) {
  try {
    if (!isMoolrePaymentsConfigured()) {
      return res.status(503).json({ error: 'Online payments are not configured' });
    }

    const { reference } = req.params;
    const intent = await prisma.bookPaystackIntent.findUnique({
      where: { reference },
    });
    if (!intent) return res.status(404).json({ error: 'Payment not found' });

    const phoneVariants = parentPhoneVariants(req.parentPhone);
    const st = await prisma.student.findUnique({
      where: { id: intent.studentId },
      include: { parent: { include: { user: { select: { phone: true } } } } },
    });
    if (!st) return res.status(404).json({ error: 'Student not found' });

    const hasAccess = parentHasAccessToStudent(st, phoneVariants);
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    if (intent.status === 'SUCCESS') {
      return res.json({ status: 'SUCCESS', reference });
    }
    if (intent.status === 'FAILED') {
      return res.json({ status: 'FAILED', reference });
    }

    // Single status check (app polls every ~2.5s; avoid long retry loops here)
    const status = await checkMoolrePaymentStatus(reference);
    if (status.isPaid) {
      const amountGhs = Number(status.data?.amount ?? status.data?.Amount ?? intent.amountGhs);
      const finalize = await finalizeBookMoolreIntentByReference(reference, amountGhs);
      if (!finalize.ok && finalize.reason === 'AMOUNT_MISMATCH') {
        return res.status(400).json({ error: 'Amount verification failed' });
      }
      return res.json({ status: 'SUCCESS', reference });
    }

    if (status.txStatusNum === 2) {
      await markBookIntentFailed(reference);
      return res.json({ status: 'FAILED', reference });
    }

    return res.json({
      status: intent.status,
      reference,
      moolreStatus: status.message || 'pending',
    });
  } catch (error) {
    console.error('GET /portal/books/moolre/verify error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
}

router.get('/books/moolre/verify/:reference', authenticateParent, verifyBookMoolrePayment);
router.get('/books/paystack/verify/:reference', authenticateParent, verifyBookMoolrePayment);

// GET /portal/announcements
router.get('/announcements', authenticateParent, async (req, res) => {
  try {
    const announcements = await prisma.announcement.findMany({
      where: {
        targetAudience: { in: ['ALL', 'PARENTS'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
      },
    });
    res.json(announcements);
  } catch (error) {
    console.error('GET /portal/announcements error:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// GET /portal/events — upcoming school events for parent app
router.get('/events', authenticateParent, async (req, res) => {
  try {
    const now = new Date();
    const events = await prisma.schoolEvent.findMany({
      where: { eventDate: { gte: now } },
      orderBy: { eventDate: 'asc' },
      take: 20,
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        eventDate: true,
      },
    });
    res.json(
      events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        location: e.location,
        eventDate: e.eventDate.toISOString(),
      }))
    );
  } catch (error) {
    console.error('GET /portal/events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// POST /portal/push/register — store Expo push token for parent device
router.post('/push/register', authenticateParent, async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Push token is required' });
    }

    const parentPhone = req.parentPhone;
    const plat = platform === 'ios' || platform === 'android' ? platform : 'unknown';

    await prisma.pushToken.upsert({
      where: { token },
      create: { token, platform: plat, parentPhone },
      update: { platform: plat, parentPhone, updatedAt: new Date() },
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('POST /portal/push/register error:', error);
    res.status(500).json({ error: 'Failed to register push token' });
  }
});

// DELETE /portal/push/unregister
router.post('/push/unregister', authenticateParent, async (req, res) => {
  try {
    const { token } = req.body;
    if (token) {
      await prisma.pushToken.deleteMany({ where: { token } });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('POST /portal/push/unregister error:', error);
    res.status(500).json({ error: 'Failed to unregister push token' });
  }
});

module.exports = router;
