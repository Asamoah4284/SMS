const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../config/db');
const { sendSMS } = require('../services/sms');

const router = Router();
router.use(authenticate);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateStaffId(firstName, lastName) {
  const initials = `${(firstName[0] ?? 'X')}${(lastName[0] ?? 'X')}`.toUpperCase();
  const rand = String(Math.floor(10000 + Math.random() * 90000));
  return `${initials}-${rand}`;
}

function formatPhoneE164(phone) {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) return `+233${cleaned.slice(1)}`;
  if (cleaned.startsWith('233')) return `+${cleaned}`;
  return `+233${cleaned}`;
}

function isValidPhoneGH(phone) {
  return /^(0|\+233|233)[2-9]\d{8}$/.test(phone.replace(/\s/g, ''));
}

// ─────────────────────────────────────────────────────────────────
// GET /teachers
// List all teachers with stats
// ─────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const teachers = await prisma.teacher.findMany({
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            isActive: true,
          },
        },
        classTeacherOf: {
          select: {
            id: true,
            name: true,
            _count: { select: { students: true } },
          },
        },
        subjectTeachers: {
          select: { id: true },
        },
      },
      orderBy: { user: { firstName: 'asc' } },
    });

    res.json({
      teachers: teachers.map((t) => ({
        id: t.id,
        staffId: t.staffId,
        qualification: t.qualification,
        classTeacherOf: t.classTeacherOf
          ? {
              id: t.classTeacherOf.id,
              name: t.classTeacherOf.name,
              studentCount: t.classTeacherOf._count.students,
            }
          : null,
        subjectCount: t.subjectTeachers.length,
        user: {
          firstName: t.user.firstName,
          lastName: t.user.lastName,
          phone: t.user.phone,
          email: t.user.email,
          isActive: t.user.isActive,
        },
      })),
    });
  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /teachers/bulk-import (Admin only) — must be registered before /:id
// ─────────────────────────────────────────────────────────────────

router.post('/bulk-import', authorize('ADMIN'), async (req, res) => {
  try {
    const { teachers: rows } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No teacher rows provided' });
    }
    if (rows.length > 100) {
      return res.status(400).json({ error: 'Max 100 teachers per import' });
    }

    const adminId = req.user.id;
    const results = { imported: 0, failed: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      if (!row.firstName?.trim()) {
        results.failed.push({ row: rowNum, error: 'First name is required' });
        continue;
      }
      if (!row.lastName?.trim()) {
        results.failed.push({ row: rowNum, error: 'Last name is required' });
        continue;
      }
      if (!row.phone?.trim() || !isValidPhoneGH(row.phone.trim())) {
        results.failed.push({ row: rowNum, name: `${row.firstName} ${row.lastName}`, error: 'Invalid or missing phone number' });
        continue;
      }

      const phone = row.phone.trim();

      try {
        const existing = await prisma.user.findUnique({ where: { phone } });
        if (existing) {
          results.failed.push({ row: rowNum, name: `${row.firstName} ${row.lastName}`, error: 'Phone already registered' });
          continue;
        }

        let staffId = generateStaffId(row.firstName.trim(), row.lastName.trim());
        let attempt = 0;
        while (await prisma.teacher.findUnique({ where: { staffId } }) ||
               await prisma.teacherInvitation.findUnique({ where: { staffId } })) {
          staffId = generateStaffId(row.firstName.trim(), row.lastName.trim());
          if (++attempt > 10) { staffId = `${staffId}${Date.now() % 1000}`; break; }
        }

        const inviteCode = String(Math.floor(100000 + Math.random() * 900000));
        const codeExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000);

        await prisma.teacherInvitation.create({
          data: { staffId, phone, inviteCode, codeExpiry, createdBy: adminId },
        });

        const smsText = `[${process.env.SCHOOL_ABBREVIATION || 'EduTrack'}] Welcome ${row.firstName.trim()}! Staff ID: ${staffId} | Code: ${inviteCode} | ${process.env.FRONTEND_URL}/invite`;
        await sendSMS(formatPhoneE164(phone), smsText).catch(() => null);

        results.imported++;
      } catch {
        results.failed.push({ row: rowNum, name: `${row.firstName} ${row.lastName}`, error: 'Failed to process' });
      }
    }

    res.json({
      message: `Imported ${results.imported} teacher${results.imported !== 1 ? 's' : ''}`,
      imported: results.imported,
      failed: results.failed,
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ error: 'Bulk import failed' });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /teachers/:id
// Teacher detail: profile + class info + subjects + timetable + attendance + leaves
// ─────────────────────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            permissionRequests: {
              orderBy: { createdAt: 'desc' },
              take: 30,
              select: {
                id: true,
                type: true,
                reason: true,
                startDate: true,
                endDate: true,
                status: true,
                adminNote: true,
                createdAt: true,
              },
            },
          },
        },
        classTeacherOf: {
          include: {
            _count: { select: { students: true } },
          },
        },
        subjectTeachers: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
            class: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    // ── Timetable ─────────────────────────────────────────────────
    const stPairs = teacher.subjectTeachers.map((st) => ({
      subjectId: st.subjectId,
      classId: st.classId,
    }));

    let timetableWhere = {};
    if (teacher.classTeacherOf) {
      // Class teacher sees ALL slots for their class
      timetableWhere = { classId: teacher.classTeacherOf.id };
    } else if (stPairs.length > 0) {
      timetableWhere = { OR: stPairs.map((p) => ({ subjectId: p.subjectId, classId: p.classId })) };
    }

    const timetable = Object.keys(timetableWhere).length > 0
      ? await prisma.timetable.findMany({
          where: timetableWhere,
          include: {
            subject: { select: { name: true, code: true } },
            class: { select: { name: true } },
          },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        })
      : [];

    // ── Attendance ────────────────────────────────────────────────
    const currentTerm = await prisma.term.findFirst({ where: { isCurrent: true } });

    let attendanceRecords = [];
    let attendanceSummary = { present: 0, absent: 0, late: 0, excused: 0, rate: 0 };

    if (currentTerm) {
      attendanceRecords = await prisma.teacherAttendance.findMany({
        where: { teacherId: id, termId: currentTerm.id },
        orderBy: { date: 'desc' },
        take: 90,
        select: {
          id: true,
          date: true,
          status: true,
          checkIn: true,
          checkOut: true,
          note: true,
        },
      });

      const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
      attendanceRecords.forEach((r) => {
        counts[r.status] = (counts[r.status] || 0) + 1;
      });
      const total = attendanceRecords.length;
      attendanceSummary = {
        present: counts.PRESENT,
        absent: counts.ABSENT,
        late: counts.LATE,
        excused: counts.EXCUSED,
        rate: total > 0 ? Math.round(((counts.PRESENT + counts.LATE) / total) * 100) : 0,
      };
    }

    // ── Class performance (if class teacher) ──────────────────────
    let classPerformance = null;
    if (teacher.classTeacherOf && currentTerm) {
      const results = await prisma.result.findMany({
        where: {
          student: { classId: teacher.classTeacherOf.id, isActive: true },
          termId: currentTerm.id,
          totalScore: { not: null },
        },
        select: {
          totalScore: true,
          studentId: true,
          student: { select: { firstName: true, lastName: true } },
        },
      });

      if (results.length > 0) {
        const byStudent = {};
        results.forEach((r) => {
          if (!byStudent[r.studentId]) {
            byStudent[r.studentId] = {
              name: `${r.student.firstName} ${r.student.lastName}`,
              scores: [],
            };
          }
          if (r.totalScore !== null) byStudent[r.studentId].scores.push(r.totalScore);
        });

        const studentAvgs = Object.entries(byStudent)
          .map(([sid, { name, scores }]) => ({
            id: sid,
            name,
            avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
          }))
          .sort((a, b) => b.avgScore - a.avgScore);

        classPerformance = {
          avgScore: Math.round(studentAvgs.reduce((s, st) => s + st.avgScore, 0) / studentAvgs.length),
          topStudents: studentAvgs.slice(0, 3),
          struggling: [...studentAvgs].slice(-3).reverse().filter((s) => s.avgScore < 50),
        };
      }
    }

    res.json({
      id: teacher.id,
      staffId: teacher.staffId,
      qualification: teacher.qualification,
      user: {
        firstName: teacher.user.firstName,
        lastName: teacher.user.lastName,
        phone: teacher.user.phone,
        email: teacher.user.email,
        isActive: teacher.user.isActive,
        joinedAt: teacher.user.createdAt,
      },
      classTeacherOf: teacher.classTeacherOf
        ? {
            id: teacher.classTeacherOf.id,
            name: teacher.classTeacherOf.name,
            studentCount: teacher.classTeacherOf._count.students,
          }
        : null,
      subjects: teacher.subjectTeachers.map((st) => ({
        id: st.subject.id,
        name: st.subject.name,
        code: st.subject.code,
        class: { id: st.class.id, name: st.class.name },
      })),
      timetable: timetable.map((t) => ({
        id: t.id,
        dayOfWeek: t.dayOfWeek,
        startTime: t.startTime,
        endTime: t.endTime,
        subject: t.subject,
        class: t.class,
      })),
      attendance: {
        summary: attendanceSummary,
        records: attendanceRecords.map((r) => ({
          id: r.id,
          date: r.date,
          status: r.status,
          checkIn: r.checkIn,
          checkOut: r.checkOut,
          note: r.note,
        })),
      },
      leaveRequests: teacher.user.permissionRequests,
      classPerformance,
    });
  } catch (error) {
    console.error('Get teacher detail error:', error);
    res.status(500).json({ error: 'Failed to fetch teacher' });
  }
});

// ─────────────────────────────────────────────────────────────────
// PUT /teachers/:id (Admin only)
// Update teacher qualification + user profile
// ─────────────────────────────────────────────────────────────────

router.put('/:id', authorize('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { qualification, firstName, lastName, email } = req.body;

    const teacher = await prisma.teacher.findUnique({ where: { id }, include: { user: true } });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    await prisma.$transaction([
      prisma.teacher.update({
        where: { id },
        data: { ...(qualification !== undefined && { qualification }) },
      }),
      prisma.user.update({
        where: { id: teacher.userId },
        data: {
          ...(firstName && { firstName }),
          ...(lastName && { lastName }),
          ...(email !== undefined && { email }),
        },
      }),
    ]);

    res.json({ message: 'Teacher updated' });
  } catch (error) {
    console.error('Update teacher error:', error);
    res.status(500).json({ error: 'Failed to update teacher' });
  }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /teachers/:id (Admin only)
// Removes teacher assignments, profile, and user account
// ─────────────────────────────────────────────────────────────────

router.delete('/:id', authorize('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const teacher = await prisma.teacher.findUnique({ where: { id } });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    const userId = teacher.userId;

    await prisma.$transaction(async (tx) => {
      await tx.class.updateMany({ where: { classTeacherId: id }, data: { classTeacherId: null } });
      await tx.subjectTeacher.deleteMany({ where: { teacherId: id } });
      await tx.teacherAttendance.deleteMany({ where: { teacherId: id } });
      await tx.permissionRequest.deleteMany({ where: { userId } });
      await tx.teacher.delete({ where: { id } });
      await tx.user.delete({ where: { id: userId } });
    });

    res.json({ message: 'Teacher removed' });
  } catch (error) {
    console.error('Delete teacher error:', error);
    res.status(500).json({ error: 'Failed to delete teacher' });
  }
});

module.exports = router;
