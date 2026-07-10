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

function paymentDisplayStatus(status) {
  return status === 'FULLY_PAID' ? 'Paid' : 'Pending';
}

async function computeTermFeeCollection(termId) {
  const structures = await prisma.feeStructure.findMany({ where: { termId } });
  const tuitionByLevel = {};
  const supplementary = [];
  for (const s of structures) {
    if (s.category === 'TUITION' && s.classLevel) tuitionByLevel[s.classLevel] = s.amount;
    else if (s.category !== 'TUITION') supplementary.push(s);
  }
  const suppForLevel = (level) =>
    supplementary
      .filter((f) => f.classLevel === null || f.classLevel === level)
      .reduce((sum, f) => sum + f.amount, 0);

  const students = await prisma.student.findMany({
    where: { isActive: true },
    select: { class: { select: { level: true } } },
  });

  let totalExpected = 0;
  for (const st of students) {
    const level = st.class?.level;
    if (!level) continue;
    totalExpected += (tuitionByLevel[level] ?? 0) + suppForLevel(level);
  }

  const collectedAgg = await prisma.feePayment.aggregate({
    where: { termId },
    _sum: { amountPaid: true },
  });
  const totalCollected = collectedAgg._sum.amountPaid ?? 0;
  const collectionRate =
    totalExpected > 0 ? Math.min(100, Math.round((totalCollected / totalExpected) * 100)) : 100;

  return { totalExpected, totalCollected, collectionRate };
}

async function fetchUpcomingEvents(now, currentTermId) {
  const [assessments, exams, terms, schoolEvents] = await Promise.all([
    prisma.assessment.findMany({
      where: {
        date: { not: null, gte: now },
        ...(currentTermId ? { termId: currentTermId } : {}),
      },
      include: {
        class: { select: { name: true } },
        subject: { select: { name: true } },
      },
      orderBy: { date: 'asc' },
      take: 10,
    }),
    prisma.onlineExam.findMany({
      where: {
        status: 'PUBLISHED',
        OR: [{ startAt: { gte: now } }, { endAt: { gte: now } }],
        ...(currentTermId ? { termId: currentTermId } : {}),
      },
      include: {
        class: { select: { name: true } },
        subject: { select: { name: true } },
      },
      orderBy: { startAt: 'asc' },
      take: 10,
    }),
    prisma.term.findMany({
      where: { endDate: { gte: now } },
      orderBy: { endDate: 'asc' },
      take: 3,
    }),
    prisma.schoolEvent.findMany({
      where: { eventDate: { gte: now } },
      orderBy: { eventDate: 'asc' },
      take: 10,
    }),
  ]);

  const events = [
    ...assessments.map((a) => ({
      id: `assessment-${a.id}`,
      title: a.name,
      date: a.date.toISOString(),
      type: 'assessment',
      subtitle: `${a.class.name} · ${a.subject.name}`,
    })),
    ...exams.map((e) => ({
      id: `exam-${e.id}`,
      title: e.title,
      date: (e.startAt ?? e.endAt).toISOString(),
      type: 'exam',
      subtitle: `${e.class.name} · ${e.subject.name}`,
    })),
    ...terms.map((t) => ({
      id: `term-${t.id}`,
      title: `${t.name} ${t.year} ends`,
      date: t.endDate.toISOString(),
      type: 'term',
      subtitle: 'Academic term',
    })),
    ...schoolEvents.map((e) => ({
      id: e.id,
      title: e.title,
      date: e.eventDate.toISOString(),
      type: 'event',
      subtitle: [e.location, e.description?.slice(0, 60)].filter(Boolean).join(' · ') || 'School event',
      description: e.description,
      location: e.location,
      isCustom: true,
    })),
  ];

  return events
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 8);
}

async function fetchQuickNotesForUser(userId, role, ctx) {
  const { now, currentTermId, pendingFeesCount, attendanceTotalMarked, activeStudents } = ctx;
  const notes = [];
  const push = (note) => {
    if (notes.length < 6) notes.push(note);
  };

  if (role === 'ADMIN') {
    const [pendingLeaves, unpublishedClasses, latestAnnouncement, nextEvent] = await Promise.all([
      prisma.permissionRequest.count({ where: { status: 'PENDING' } }),
      currentTermId
        ? prisma.termResult.count({ where: { termId: currentTermId, isPublished: false } })
        : Promise.resolve(0),
      prisma.announcement.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, createdAt: true },
      }),
      prisma.schoolEvent.findFirst({
        where: { eventDate: { gte: now } },
        orderBy: { eventDate: 'asc' },
        select: { title: true, eventDate: true },
      }),
    ]);

    if (pendingLeaves > 0) {
      push({
        id: 'pending-leaves',
        text: `${pendingLeaves} teacher leave request${pendingLeaves === 1 ? '' : 's'} awaiting approval`,
        href: '/leaves',
        tone: 'warning',
      });
    }
    if (unpublishedClasses > 0) {
      push({
        id: 'unpublished-results',
        text: `${unpublishedClasses} class${unpublishedClasses === 1 ? '' : 'es'} with unpublished results`,
        href: '/results',
        tone: 'warning',
      });
    }
    if (pendingFeesCount > 0) {
      push({
        id: 'pending-fees',
        text: `${pendingFeesCount} student fee record${pendingFeesCount === 1 ? '' : 's'} still pending`,
        href: '/fees',
        tone: 'info',
      });
    }
    const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
    if (isWeekday && activeStudents > 0 && attendanceTotalMarked === 0) {
      push({
        id: 'attendance-missing',
        text: 'No attendance marked for today yet',
        href: '/attendance',
        tone: 'warning',
      });
    }
    if (latestAnnouncement) {
      push({
        id: `announcement-${latestAnnouncement.id}`,
        text: `Latest announcement: “${latestAnnouncement.title}”`,
        href: '/announcements',
        tone: 'info',
      });
    }
    if (nextEvent) {
      const when = new Date(nextEvent.eventDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      });
      push({
        id: 'next-event',
        text: `Next event: ${nextEvent.title} (${when})`,
        href: '/overview',
        tone: 'success',
      });
    }
  } else if (role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({
      where: { userId },
      select: {
        classTeacherOf: { select: { id: true, name: true } },
      },
    });
    const classId = teacher?.classTeacherOf?.id;
    if (classId && currentTermId) {
      const [termResult, todayAttendance] = await Promise.all([
        prisma.termResult.findUnique({
          where: { classId_termId: { classId, termId: currentTermId } },
          select: { isPublished: true },
        }),
        prisma.attendance.count({
          where: { classId, termId: currentTermId, date: ctx.today },
        }),
      ]);
      if (termResult && !termResult.isPublished) {
        push({
          id: 'class-results-draft',
          text: `${teacher.classTeacherOf.name} results are not published yet`,
          href: `/results/${classId}`,
          tone: 'warning',
        });
      }
      const classStudents = await prisma.student.count({ where: { classId, isActive: true } });
      const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
      if (isWeekday && classStudents > 0 && todayAttendance === 0) {
        push({
          id: 'class-attendance',
          text: `Mark attendance for ${teacher.classTeacherOf.name} today`,
          href: '/attendance',
          tone: 'warning',
        });
      }
    }
    const myPendingLeave = await prisma.permissionRequest.count({
      where: { userId, status: 'PENDING' },
    });
    if (myPendingLeave > 0) {
      push({
        id: 'my-leave',
        text: 'Your leave request is pending admin approval',
        href: '/leaves',
        tone: 'info',
      });
    }
    const latestAnnouncement = await prisma.announcement.findFirst({
      where: { targetAudience: { in: ['ALL', 'TEACHERS'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true },
    });
    if (latestAnnouncement) {
      push({
        id: `announcement-${latestAnnouncement.id}`,
        text: `School notice: “${latestAnnouncement.title}”`,
        href: '/announcements',
        tone: 'info',
      });
    }
  }

  if (notes.length === 0) {
    push({
      id: 'all-clear',
      text: 'You are all caught up — no urgent items right now.',
      tone: 'success',
    });
  }

  return notes;
}

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

function summarizeAttendanceRecords(records) {
  let present = 0;
  let absent = 0;
  let total = 0;
  for (const r of records) {
    total += 1;
    if (r.status === 'PRESENT' || r.status === 'LATE') present += 1;
    else if (r.status === 'ABSENT') absent += 1;
  }
  const presentRate = total > 0 ? Math.round((present / total) * 100) : 0;
  const absentRate = total > 0 ? Math.round((absent / total) * 100) : 0;
  return { present, absent, total, presentRate, absentRate };
}

async function fetchAttendanceWeeklyTrend(now, currentTermId) {
  const DAY_COUNT = 6;
  const termFilter = currentTermId ? { termId: currentTermId } : {};

  const chartStart = new Date(now);
  chartStart.setDate(chartStart.getDate() - (DAY_COUNT - 1));
  chartStart.setHours(0, 0, 0, 0);

  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(thisWeekStart.getDate() - 6);
  thisWeekStart.setHours(0, 0, 0, 0);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setMilliseconds(-1);

  const allRecords = await prisma.attendance.findMany({
    where: {
      date: { gte: lastWeekStart, lte: now },
      ...termFilter,
    },
    select: { date: true, status: true },
  });

  const byDate = {};
  for (const r of allRecords) {
    const key = dateKey(new Date(r.date));
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(r);
  }

  const days = [];
  for (let i = 0; i < DAY_COUNT; i += 1) {
    const d = new Date(chartStart);
    d.setDate(d.getDate() + i);
    const key = dateKey(d);
    const summary = summarizeAttendanceRecords(byDate[key] ?? []);
    days.push({
      date: key,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      presentRate: summary.presentRate,
      absentRate: summary.absentRate,
      present: summary.present,
      absent: summary.absent,
      totalMarked: summary.total,
    });
  }

  const avgPresentRate = (records) => {
    if (!records.length) return null;
    const present = records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
    return Math.round((present / records.length) * 100);
  };

  const thisWeekRecords = allRecords.filter((r) => {
    const d = new Date(r.date);
    return d >= thisWeekStart && d <= now;
  });
  const lastWeekRecords = allRecords.filter((r) => {
    const d = new Date(r.date);
    return d >= lastWeekStart && d <= lastWeekEnd;
  });

  const thisAvg = avgPresentRate(thisWeekRecords);
  const lastAvg = avgPresentRate(lastWeekRecords);
  const weekOverWeekChange =
    thisAvg !== null && lastAvg !== null ? Number((thisAvg - lastAvg).toFixed(1)) : null;

  return { days, weekOverWeekChange };
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
      recentFeePayments,
      termFeeCollection,
      upcomingEvents,
      attendanceWeekly,
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

      prisma.feePayment.findMany({
        where: currentTerm ? { termId: currentTerm.id } : {},
        include: {
          student: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
        take: 5,
      }),

      currentTerm ? computeTermFeeCollection(currentTerm.id) : Promise.resolve({
        totalExpected: 0,
        totalCollected: 0,
        collectionRate: 100,
      }),

      fetchUpcomingEvents(now, currentTerm?.id ?? null),

      fetchAttendanceWeeklyTrend(now, currentTerm?.id ?? null),
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

    const quickNotes = await fetchQuickNotesForUser(req.user.id, req.user.role, {
      now,
      today,
      currentTermId: currentTerm?.id ?? null,
      pendingFeesCount,
      attendanceTotalMarked: totalMarked,
      activeStudents,
    });

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
      attendanceWeekly,
      fees: {
        collectedThisMonth: feesCollectedThisMonthAgg._sum.amountPaid ?? 0,
        pendingCount: pendingFeesCount,
        collectionRate: termFeeCollection.collectionRate,
        recentPayments: recentFeePayments.map((p) => ({
          studentName: `${p.student.firstName} ${p.student.lastName}`,
          date: (p.paidAt ?? p.createdAt).toISOString(),
          amount: p.amountPaid,
          status: paymentDisplayStatus(p.paymentStatus),
        })),
      },
      staff: {
        total: totalTeachers,
        active: activeTeachers,
        inactive: inactiveTeachers,
      },
      upcomingEvents,
      quickNotes,
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

    const quickNotes = await fetchQuickNotesForUser(req.user.id, 'TEACHER', {
      now: new Date(),
      today,
      currentTermId: currentTerm?.id ?? null,
      pendingFeesCount: 0,
      attendanceTotalMarked: totalMarked,
      activeStudents: students.length,
    });

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
      quickNotes,
    });
  } catch (err) {
    console.error('GET /reports/my-class', err);
    res.status(500).json({ message: 'Failed to fetch class stats' });
  }
});

module.exports = router;
