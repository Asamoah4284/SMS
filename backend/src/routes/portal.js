const { Router } = require('express');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

const router = Router();

function normalisePhone(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) return '0' + digits.slice(3);
  return digits.length === 10 ? digits : null;
}

function authenticateParent(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'PARENT') return res.status(403).json({ error: 'Access denied' });
    req.parentPhone = decoded.phone;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─────────────────────────────────────────────────────────────────
// GET /portal/child/:studentId
// Returns child's full dashboard data for the parent portal
// ─────────────────────────────────────────────────────────────────

router.get('/child/:studentId', authenticateParent, async (req, res) => {
  try {
    const { studentId } = req.params;
    const parentPhone = req.parentPhone;

    const localPhone = normalisePhone(parentPhone) || parentPhone;
    const e164Phone = '+233' + localPhone.slice(1);
    const phoneVariants = [...new Set([localPhone, e164Phone, parentPhone])];

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

    // Verify parent has access to this student
    const hasAccess =
      phoneVariants.includes(student.parentPhone) ||
      (student.parent && phoneVariants.includes(student.parent.user.phone));

    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    // Attendance stats
    const total = student.attendances.length;
    const present = student.attendances.filter(
      (a) => a.status === 'PRESENT' || a.status === 'LATE'
    ).length;
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : null;

    // Fee status for current term
    const currentTerm = await prisma.term.findFirst({ where: { isCurrent: true } });
    const currentFees = currentTerm
      ? student.feePayments.filter((fp) => fp.termId === currentTerm.id)
      : [];
    const totalDue = currentFees.reduce((s, fp) => s + fp.feeStructure.amount, 0);
    const totalPaid = currentFees.reduce((s, fp) => s + fp.amountPaid, 0);

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
      fees: {
        totalDue,
        totalPaid,
        balance: Math.max(0, totalDue - totalPaid),
        status:
          totalDue === 0
            ? null
            : totalPaid >= totalDue
            ? 'FULLY_PAID'
            : totalPaid > 0
            ? 'PARTIAL'
            : 'UNPAID',
        termName: currentTerm?.name ?? null,
      },
      results: student.results.map((r) => ({
        subject: r.subject.name,
        term: `${r.term.name} ${r.term.year}`,
        totalScore: r.totalScore,
        grade: r.grade,
        remarks: r.remarks,
        position: r.position,
      })),
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

module.exports = router;
