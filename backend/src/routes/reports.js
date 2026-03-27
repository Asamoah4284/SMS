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

// GET /reports/my-class
// Teacher-specific dashboard: stats for the class they're class-teacher of
router.get('/my-class', async (req, res) => {
  try {
    if (req.user.role !== 'TEACHER') {
      return res.status(403).json({ message: 'Teachers only' });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { userId: req.user.id },
      select: {
        classTeacherOf: {
          select: {
            id: true, name: true, level: true,
            _count: { select: { students: true } },
          },
        },
      },
    });

    if (!teacher?.classTeacherOf) {
      return res.json({ classTeacherOf: null });
    }

    const cls = teacher.classTeacherOf;
    const classId = cls.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentTerm = await prisma.term.findFirst({ where: { isCurrent: true } });

    // Active students
    const students = await prisma.student.findMany({
      where: { classId, isActive: true },
      select: { id: true, gender: true },
    });
    const studentIds = students.map((s) => s.id);

    // Today's attendance
    const todayAttendance = studentIds.length
      ? await prisma.attendance.groupBy({
          by: ['status'],
          where: { studentId: { in: studentIds }, date: today },
          _count: true,
        })
      : [];
    const attnMap = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    todayAttendance.forEach((a) => { attnMap[a.status] = a._count; });
    const totalMarked = Object.values(attnMap).reduce((s, v) => s + v, 0);
    const attendanceRate = totalMarked > 0
      ? Math.round(((attnMap.PRESENT + attnMap.LATE) / totalMarked) * 100)
      : null;

    // Results: published term results for this class
    const termResult = currentTerm
      ? await prisma.termResult.findFirst({
          where: { classId, termId: currentTerm.id },
          select: { isPublished: true },
        })
      : null;

    const resultCount = currentTerm && studentIds.length
      ? await prisma.result.groupBy({
          by: ['studentId'],
          where: { studentId: { in: studentIds }, termId: currentTerm.id, totalScore: { not: null } },
        }).then((r) => r.length)
      : 0;

    res.json({
      classTeacherOf: {
        id: classId,
        name: cls.name,
        level: cls.level,
        totalStudents: students.length,
        male: students.filter((s) => s.gender === 'MALE').length,
        female: students.filter((s) => s.gender === 'FEMALE').length,
        attendanceToday: {
          rate: attendanceRate,
          present: attnMap.PRESENT + attnMap.LATE,
          absent: attnMap.ABSENT,
          marked: totalMarked,
          total: students.length,
        },
        currentTerm: currentTerm ? { id: currentTerm.id, name: currentTerm.name, year: currentTerm.year } : null,
        results: {
          studentsWithResults: resultCount,
          isPublished: termResult?.isPublished ?? false,
        },
      },
    });
  } catch (err) {
    console.error('GET /reports/my-class', err);
    res.status(500).json({ message: 'Failed to fetch class stats' });
  }
});

module.exports = router;
