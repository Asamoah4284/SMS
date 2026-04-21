const { Router } = require('express');
const crypto = require('crypto');
const prisma = require('../config/db');
const { authenticateParent, parentPhoneVariants } = require('../middleware/parentPortalAuth');
const { getStudentFeeLinesForTerm } = require('../utils/studentFeeLines');
const { computeClassPositionByTerm } = require('../utils/classRanking');
const { finalizePaystackIntentByReference } = require('../services/paystackFinalize');

const router = Router();

/**
 * Paystack validates the `email` field strictly; placeholder domains like `*.local` are rejected.
 * Use the parent’s real address when it looks valid, else a safe system address.
 */
function paystackCustomerEmail(parentUserEmail, schoolStudentId, reference) {
  const raw = parentUserEmail && String(parentUserEmail).trim();
  if (raw && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(raw)) {
    return raw;
  }
  const id = String(schoolStudentId || 'ward')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 32) || 'ward';
  const ref = String(reference).replace(/[^a-z0-9]/gi, '').slice(0, 12) || 'ref';
  return `edutrack.ward.${id}.${ref}@example.com`;
}

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

    const hasAccess =
      phoneVariants.includes(student.parentPhone) ||
      (student.parent && phoneVariants.includes(student.parent.user.phone));

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
// POST /portal/paystack/initialize
// Body: { studentId, amount?: GHS, callbackUrl?, feeStructureIds?: string[] }
// If feeStructureIds is set, payment applies only to those fee lines (e.g. tuition vs feeding vs other).
// ─────────────────────────────────────────────────────────────────

router.post('/paystack/initialize', authenticateParent, async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
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

    const hasAccess =
      phoneVariants.includes(student.parentPhone) ||
      (student.parent && phoneVariants.includes(student.parent.user.phone));

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

    let payAmount = maxPayable;
    if (amountRaw != null && amountRaw !== '') {
      const n = typeof amountRaw === 'number' ? amountRaw : parseFloat(String(amountRaw));
      if (!Number.isFinite(n) || n <= 0) {
        return res.status(400).json({ error: 'amount must be a positive number' });
      }
      payAmount = Math.min(n, maxPayable);
    }

    if (payAmount < 0.01) {
      return res.status(400).json({ error: 'Minimum payment is GH₵0.01' });
    }

    if (callbackUrl != null && typeof callbackUrl === 'string' && callbackUrl.length > 0) {
      const ok =
        callbackUrl.startsWith('edutracksms://') ||
        callbackUrl.startsWith('exp://') ||
        callbackUrl.startsWith('http://localhost');
      if (!ok) {
        return res.status(400).json({ error: 'callbackUrl is not allowed' });
      }
    }

    const amountPesewas = Math.round(payAmount * 100);
    if (amountPesewas < 1) {
      return res.status(400).json({ error: 'Amount too small after conversion' });
    }

    const reference = `EDU_${crypto.randomBytes(10).toString('hex')}`;

    const intent = await prisma.paystackIntent.create({
      data: {
        reference,
        amountGhs: payAmount,
        amountPesewas,
        studentId: student.id,
        termId: currentTerm.id,
        callbackUrl: callbackUrl || null,
        targetFeeStructureIds: targetFeeStructureIds ?? [],
      },
    });

    const email = paystackCustomerEmail(
      student.parent?.user?.email,
      schoolStudentId,
      reference
    );

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountPesewas,
        currency: 'GHS',
        reference,
        callback_url: callbackUrl || undefined,
        metadata: {
          studentSchoolId: schoolStudentId,
          termId: currentTerm.id,
          intentId: intent.id,
        },
      }),
    });

    const paystackJson = await paystackRes.json();
    if (!paystackJson.status || !paystackJson.data?.authorization_url) {
      await prisma.paystackIntent.update({
        where: { reference },
        data: { status: 'FAILED' },
      });
      console.error('Paystack initialize failed:', paystackJson);
      return res.status(502).json({
        error: paystackJson.message || 'Could not start payment with Paystack',
      });
    }

    await prisma.paystackIntent.update({
      where: { reference },
      data: { paystackAccessCode: paystackJson.data.access_code || null },
    });

    return res.json({
      authorizationUrl: paystackJson.data.authorization_url,
      reference,
      amountGhs: payAmount,
      currency: 'GHS',
    });
  } catch (error) {
    console.error('POST /portal/paystack/initialize error:', error);
    res.status(500).json({ error: 'Failed to initialize payment' });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /portal/paystack/verify/:reference  (optional — after redirect)
// ─────────────────────────────────────────────────────────────────

router.get('/paystack/verify/:reference', authenticateParent, async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      return res.status(503).json({ error: 'Online payments are not configured' });
    }

    const { reference } = req.params;
    const intent = await prisma.paystackIntent.findUnique({
      where: { reference },
      include: { student: { select: { studentId: true } } },
    });

    if (!intent) return res.status(404).json({ error: 'Payment not found' });

    const phoneVariants = parentPhoneVariants(req.parentPhone);
    const st = await prisma.student.findUnique({
      where: { id: intent.studentId },
      include: { parent: { include: { user: { select: { phone: true } } } } },
    });
    if (!st) return res.status(404).json({ error: 'Student not found' });

    const hasAccess =
      phoneVariants.includes(st.parentPhone) ||
      (st.parent && phoneVariants.includes(st.parent.user.phone));
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    if (intent.status === 'SUCCESS') {
      return res.json({ status: 'SUCCESS', reference });
    }

    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const verifyJson = await verifyRes.json();
    if (!verifyJson.status || verifyJson.data?.status !== 'success') {
      return res.json({
        status: intent.status,
        reference,
        paystackStatus: verifyJson.data?.status || verifyJson.message,
      });
    }

    const amount = verifyJson.data.amount;
    const finalize = await finalizePaystackIntentByReference(reference, Number(amount));
    if (!finalize.ok && finalize.reason === 'AMOUNT_MISMATCH') {
      return res.status(400).json({ error: 'Amount verification failed' });
    }

    return res.json({ status: 'SUCCESS', reference });
  } catch (error) {
    console.error('GET /portal/paystack/verify error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

module.exports = router;
