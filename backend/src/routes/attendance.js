const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../config/db');
const { sendSMS, templates } = require('../services/sms');

const router = Router();
router.use(authenticate);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Return today's date as YYYY-MM-DD in local time */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Parse a YYYY-MM-DD string into a UTC midnight Date for Prisma @db.Date fields */
function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Format a Date to a human-readable string for SMS */
function formatDateFriendly(date) {
  return new Date(date).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ─── GET /attendance/students ─────────────────────────────────────────────────
// Query: ?classId=&date=YYYY-MM-DD
// Returns each student with their attendance status for that date.
// If attendance not yet marked, status is null for each student.
router.get('/students', async (req, res) => {
  try {
    const { classId, date } = req.query;
    if (!classId) return res.status(400).json({ message: 'classId is required' });

    const dateStr = date || todayStr();
    const dateObj = parseDate(dateStr);

    // Teachers can only view their own class
    if (req.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: req.user.id, classTeacherOf: { id: classId } },
      });
      if (!teacher) return res.status(403).json({ message: 'You can only view your own class' });
    }

    const cls = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        classTeacher: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        students: {
          where: { isActive: true },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          select: {
            id: true, firstName: true, lastName: true, studentId: true, gender: true,
            parentName: true, parentPhone: true,
            parent: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
          },
        },
      },
    });

    if (!cls) return res.status(404).json({ message: 'Class not found' });

    const studentIds = cls.students.map((s) => s.id);
    const attendances = await prisma.attendance.findMany({
      where: { studentId: { in: studentIds }, date: dateObj },
    });

    const attnMap = {};
    attendances.forEach((a) => { attnMap[a.studentId] = a; });

    const alreadyMarked = attendances.length > 0;

    res.json({
      classId,
      className: cls.name,
      classTeacher: cls.classTeacher
        ? { id: cls.classTeacher.id, name: `${cls.classTeacher.user.firstName} ${cls.classTeacher.user.lastName}` }
        : null,
      date: dateStr,
      alreadyMarked,
      students: cls.students.map((s) => {
        const record = attnMap[s.id];
        return {
          id: s.id,
          studentId: s.studentId,
          name: `${s.firstName} ${s.lastName}`,
          gender: s.gender,
          status: record?.status ?? null,
          note: record?.note ?? null,
          attendanceId: record?.id ?? null,
          parentName: s.parent
            ? `${s.parent.user.firstName} ${s.parent.user.lastName}`
            : s.parentName ?? null,
          parentPhone: s.parent?.user.phone ?? s.parentPhone ?? null,
        };
      }),
    });
  } catch (err) {
    console.error('GET /attendance/students', err);
    res.status(500).json({ message: 'Failed to fetch attendance' });
  }
});

// ─── POST /attendance/students/mark ──────────────────────────────────────────
// Body: { classId, date, records: [{ studentId, status, note? }] }
// Class teacher: today only.  Admin: any date.
// Side-effect: SMS to parent for each ABSENT student.
router.post('/students/mark', async (req, res) => {
  try {
    const { classId, date, records } = req.body;
    if (!classId || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: 'classId and records are required' });
    }

    const dateStr = date || todayStr();

    // Teachers can only mark today
    if (req.user.role === 'TEACHER') {
      if (dateStr !== todayStr()) {
        return res.status(403).json({ message: 'Teachers can only mark attendance for today. Contact admin to edit past records.' });
      }
      // Verify it's their class
      const teacher = await prisma.teacher.findFirst({
        where: { userId: req.user.id, classTeacherOf: { id: classId } },
      });
      if (!teacher) return res.status(403).json({ message: 'You can only mark attendance for your own class' });
    }

    const dateObj = parseDate(dateStr);

    // Get current term
    const term = await prisma.term.findFirst({ where: { isCurrent: true } });
    if (!term) return res.status(400).json({ message: 'No active term. Contact admin to set up a term.' });

    // Validate all studentIds belong to this class
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: { name: true, students: { where: { isActive: true }, select: { id: true, firstName: true, lastName: true, parentName: true, parentPhone: true, parent: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } } } } },
    });
    if (!cls) return res.status(404).json({ message: 'Class not found' });

    const studentMap = {};
    cls.students.forEach((s) => { studentMap[s.id] = s; });

    // Upsert each attendance record
    const upserts = records.map((r) =>
      prisma.attendance.upsert({
        where: { studentId_date: { studentId: r.studentId, date: dateObj } },
        create: { studentId: r.studentId, date: dateObj, status: r.status, note: r.note || null, termId: term.id },
        update: { status: r.status, note: r.note || null },
      })
    );
    await prisma.$transaction(upserts);

    // Send SMS to parents of ABSENT students (fire-and-forget — don't block response)
    const absentRecords = records.filter((r) => r.status === 'ABSENT');
    if (absentRecords.length > 0) {
      const friendlyDate = formatDateFriendly(dateObj);
      setImmediate(async () => {
        for (const r of absentRecords) {
          const student = studentMap[r.studentId];
          if (!student) continue;
          const parentPhone = student.parent?.user.phone ?? student.parentPhone;
          const parentName = student.parent
            ? `${student.parent.user.firstName} ${student.parent.user.lastName}`
            : (student.parentName ?? 'Parent/Guardian');
          const studentName = `${student.firstName} ${student.lastName}`;
          if (parentPhone) {
            try {
              await sendSMS(
                parentPhone,
                templates.studentAbsent(parentName, studentName, cls.name, friendlyDate)
              );
            } catch (smsErr) {
              console.error(`SMS failed for ${studentName}:`, smsErr.message);
            }
          }
        }
      });
    }

    res.json({
      message: 'Attendance marked successfully',
      marked: records.length,
      absent: absentRecords.length,
      smsSent: absentRecords.filter((r) => studentMap[r.studentId]?.parent?.user.phone || studentMap[r.studentId]?.parentPhone).length,
    });
  } catch (err) {
    console.error('POST /attendance/students/mark', err);
    res.status(500).json({ message: 'Failed to mark attendance' });
  }
});

// ─── GET /attendance/classes ──────────────────────────────────────────────────
// Admin: summary of all classes for a given date (how many marked, rates)
router.get('/classes', authorize('ADMIN'), async (req, res) => {
  try {
    const dateStr = req.query.date || todayStr();
    const dateObj = parseDate(dateStr);

    const classes = await prisma.class.findMany({
      include: {
        classTeacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        _count: { select: { students: { where: { isActive: true } } } },
      },
      orderBy: [{ level: 'asc' }, { section: 'asc' }],
    });

    // Get all attendance for this date in one query
    const allAttendance = await prisma.attendance.findMany({
      where: { date: dateObj },
      include: { student: { select: { classId: true } } },
    });

    const byClass = {};
    allAttendance.forEach((a) => {
      const cid = a.student.classId;
      if (!cid) return;
      if (!byClass[cid]) byClass[cid] = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
      byClass[cid][a.status] = (byClass[cid][a.status] || 0) + 1;
    });

    res.json({
      date: dateStr,
      classes: classes.map((c) => {
        const counts = byClass[c.id] ?? null;
        const total = c._count.students;
        const marked = counts ? Object.values(counts).reduce((s, v) => s + v, 0) : 0;
        return {
          id: c.id,
          name: c.name,
          level: c.level,
          classTeacher: c.classTeacher
            ? { id: c.classTeacher.id, name: `${c.classTeacher.user.firstName} ${c.classTeacher.user.lastName}` }
            : null,
          totalStudents: total,
          marked,
          isMarked: marked > 0,
          counts,
          rate: marked > 0 ? Math.round(((counts.PRESENT + counts.LATE) / marked) * 100) : null,
        };
      }),
    });
  } catch (err) {
    console.error('GET /attendance/classes', err);
    res.status(500).json({ message: 'Failed to fetch class attendance summary' });
  }
});

// ─── GET /attendance/teachers ─────────────────────────────────────────────────
// Admin only. Query: ?date=YYYY-MM-DD
// Returns all teachers with their attendance status for that day.
router.get('/teachers', authorize('ADMIN'), async (req, res) => {
  try {
    const dateStr = req.query.date || todayStr();
    const dateObj = parseDate(dateStr);

    const teachers = await prisma.teacher.findMany({
      include: {
        user: { select: { id: true, firstName: true, lastName: true, phone: true, isActive: true } },
        classTeacherOf: { select: { id: true, name: true } },
        attendances: {
          where: { date: dateObj },
          take: 1,
        },
      },
      orderBy: { user: { lastName: 'asc' } },
    });

    res.json({
      date: dateStr,
      teachers: teachers.map((t) => {
        const record = t.attendances[0] ?? null;
        return {
          id: t.id,
          staffId: t.staffId,
          name: `${t.user.firstName} ${t.user.lastName}`,
          phone: t.user.phone,
          isActive: t.user.isActive,
          classTeacherOf: t.classTeacherOf,
          status: record?.status ?? null,
          checkIn: record?.checkIn ?? null,
          note: record?.note ?? null,
          attendanceId: record?.id ?? null,
        };
      }),
    });
  } catch (err) {
    console.error('GET /attendance/teachers', err);
    res.status(500).json({ message: 'Failed to fetch teacher attendance' });
  }
});

// ─── PUT /attendance/teachers/:teacherId ──────────────────────────────────────
// Admin only. Override or add a teacher attendance record for any date.
router.put('/teachers/:teacherId', authorize('ADMIN'), async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { date, status, note } = req.body;
    if (!status) return res.status(400).json({ message: 'status is required' });

    const dateStr = date || todayStr();
    const dateObj = parseDate(dateStr);

    const term = await prisma.term.findFirst({ where: { isCurrent: true } });
    if (!term) return res.status(400).json({ message: 'No active term' });

    const record = await prisma.teacherAttendance.upsert({
      where: { teacherId_date: { teacherId, date: dateObj } },
      create: { teacherId, date: dateObj, status, note: note || null, termId: term.id },
      update: { status, note: note || null },
    });

    res.json({ message: 'Teacher attendance updated', record });
  } catch (err) {
    console.error('PUT /attendance/teachers/:id', err);
    res.status(500).json({ message: 'Failed to update teacher attendance' });
  }
});

// ─── GET /attendance/my-class ─────────────────────────────────────────────────
// Teacher shortcut: returns their class + today's attendance status
router.get('/my-class', async (req, res) => {
  try {
    if (req.user.role !== 'TEACHER') {
      return res.status(403).json({ message: 'Teachers only' });
    }
    const teacher = await prisma.teacher.findFirst({
      where: { userId: req.user.id },
      include: { classTeacherOf: { select: { id: true, name: true } } },
    });
    if (!teacher?.classTeacherOf) {
      return res.json({ classId: null, className: null, message: 'No class assigned' });
    }
    res.json({ classId: teacher.classTeacherOf.id, className: teacher.classTeacherOf.name });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get class info' });
  }
});

module.exports = router;
