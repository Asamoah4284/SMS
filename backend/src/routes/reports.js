const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const prisma = require('../config/db');

const router = Router();

// All routes require authentication
router.use(authenticate);

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfNextMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

// GET /reports/overview
// Dashboard stat cards: students, attendance, fees, staff
router.get('/overview', async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const monthStart = startOfMonth(now);
    const nextMonthStart = startOfNextMonth(now);

    const currentTerm = await prisma.term.findFirst({
      where: { isCurrent: true },
      select: { id: true },
    });

    const [
      totalStudents,
      activeStudents,
      enrolledThisMonth,
      inactiveStudents,
      totalTeachers,
      activeTeachers,
      inactiveTeachers,
      attendanceGroups,
      feesCollectedThisMonthAgg,
      pendingFeesCount,
    ] = await Promise.all([
      prisma.student.count(),
      prisma.student.count({ where: { isActive: true } }),
      prisma.student.count({
        where: { enrolledAt: { gte: monthStart, lt: nextMonthStart } },
      }),
      prisma.student.count({ where: { isActive: false } }),

      prisma.teacher.count(),
      prisma.teacher.count({ where: { user: { isActive: true } } }),
      prisma.teacher.count({ where: { user: { isActive: false } } }),

      prisma.attendance.groupBy({
        by: ['status'],
        where: {
          date: today,
          ...(currentTerm ? { termId: currentTerm.id } : {}),
        },
        _count: true,
      }),

      prisma.feePayment.aggregate({
        where: {
          paidAt: { not: null, gte: monthStart, lt: nextMonthStart },
          ...(currentTerm ? { termId: currentTerm.id } : {}),
        },
        _sum: { amountPaid: true },
      }),

      prisma.feePayment.count({
        where: {
          paymentStatus: { in: ['UNPAID', 'PARTIAL', 'HALF_PAID'] },
          ...(currentTerm ? { termId: currentTerm.id } : {}),
        },
      }),
    ]);

    const attendanceCountByStatus = attendanceGroups.reduce((acc, g) => {
      acc[g.status] = g._count;
      return acc;
    }, {});

    const presentCount =
      (attendanceCountByStatus.PRESENT ?? 0) + (attendanceCountByStatus.LATE ?? 0);
    const absentCount = attendanceCountByStatus.ABSENT ?? 0;
    const excusedCount = attendanceCountByStatus.EXCUSED ?? 0;
    const totalMarked = presentCount + absentCount + excusedCount;
    const attendanceRate = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 0;

    res.json({
      students: {
        total: totalStudents,
        active: activeStudents,
        inactive: inactiveStudents,
        addedThisMonth: enrolledThisMonth,
      },
      attendanceToday: {
        rate: attendanceRate,
        present: presentCount,
        absent: absentCount,
        excused: excusedCount,
        totalMarked,
      },
      fees: {
        collectedThisMonth: feesCollectedThisMonthAgg._sum.amountPaid ?? 0,
        pendingCount: pendingFeesCount,
      },
      staff: {
        total: totalTeachers,
        active: activeTeachers,
        inactive: inactiveTeachers,
      },
    });
  } catch (error) {
    console.error('Reports overview error:', error);
    res.status(500).json({ error: 'Failed to fetch overview stats' });
  }
});

module.exports = router;
