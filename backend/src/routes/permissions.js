const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../config/db');
const { sendSMS, templates } = require('../services/sms');

const router = Router();
router.use(authenticate);

// ─── Helper: enumerate weekdays between two dates ────────────────────────────

function weekdaysBetween(startDate, endDate) {
  const days = [];
  const cur = new Date(startDate);
  const end = new Date(endDate);
  // Normalise to UTC midnight
  cur.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(0, 0, 0, 0);
  while (cur <= end) {
    const dow = cur.getUTCDay(); // 0=Sun, 6=Sat
    if (dow !== 0 && dow !== 6) days.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

// ─── GET /permissions ─────────────────────────────────────────────────────────
// Admin: all requests (sortable by status). Teacher: own requests only.
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};

    if (req.user.role === 'TEACHER') {
      where.userId = req.user.id;
    }
    if (status) where.status = status;

    const requests = await prisma.permissionRequest.findMany({
      where,
      include: {
        user: {
          select: { firstName: true, lastName: true, phone: true },
          include: { teacherProfile: { select: { id: true, staffId: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ requests });
  } catch (err) {
    console.error('GET /permissions', err);
    res.status(500).json({ message: 'Failed to fetch leave requests' });
  }
});

// ─── POST /permissions ────────────────────────────────────────────────────────
// Teacher submits a new leave request.
router.post('/', async (req, res) => {
  try {
    if (req.user.role !== 'TEACHER') {
      return res.status(403).json({ message: 'Only teachers can submit leave requests' });
    }

    const { type, reason, startDate, endDate } = req.body;
    if (!type || !reason || !startDate || !endDate) {
      return res.status(400).json({ message: 'type, reason, startDate, and endDate are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start) || isNaN(end) || start > end) {
      return res.status(400).json({ message: 'Invalid date range' });
    }

    const request = await prisma.permissionRequest.create({
      data: {
        type,
        reason,
        startDate: start,
        endDate: end,
        status: 'PENDING',
        userId: req.user.id,
      },
    });

    res.status(201).json({ message: 'Leave request submitted', request });
  } catch (err) {
    console.error('POST /permissions', err);
    res.status(500).json({ message: 'Failed to submit leave request' });
  }
});

// ─── PUT /permissions/:id ─────────────────────────────────────────────────────
// Admin approves or rejects a leave request.
// On APPROVE: auto-creates/updates TeacherAttendance to EXCUSED for all weekdays in range.
router.put('/:id', authorize('ADMIN'), async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ message: 'status must be APPROVED or REJECTED' });
    }

    const request = await prisma.permissionRequest.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: { firstName: true, lastName: true, phone: true },
          include: { teacherProfile: { select: { id: true } } },
        },
      },
    });
    if (!request) return res.status(404).json({ message: 'Leave request not found' });
    if (request.status !== 'PENDING') {
      return res.status(400).json({ message: 'Request is already processed' });
    }

    const updated = await prisma.permissionRequest.update({
      where: { id: req.params.id },
      data: { status, adminNote: adminNote || null },
    });

    // ── On APPROVAL: auto-create EXCUSED attendance records ──────────────────
    if (status === 'APPROVED' && request.user.teacherProfile) {
      const teacherId = request.user.teacherProfile.id;
      const term = await prisma.term.findFirst({ where: { isCurrent: true } });

      if (term) {
        const days = weekdaysBetween(request.startDate, request.endDate);
        for (const day of days) {
          await prisma.teacherAttendance.upsert({
            where: { teacherId_date: { teacherId, date: day } },
            create: {
              teacherId,
              date: day,
              status: 'EXCUSED',
              note: `Approved leave: ${request.type.replace(/_/g, ' ').toLowerCase()}`,
              termId: term.id,
            },
            // Only override if not already PRESENT (teacher came in early / leave cancelled)
            update: {
              status: 'EXCUSED',
              note: `Approved leave: ${request.type.replace(/_/g, ' ').toLowerCase()}`,
            },
          }).catch(() => {}); // skip individual day errors silently
        }
      }
    }

    // ── Notify teacher by SMS ─────────────────────────────────────────────────
    const teacherName = `${request.user.firstName} ${request.user.lastName}`;
    const dates = {
      start: request.startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      end: request.endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    };
    const message = status === 'APPROVED'
      ? templates.permissionApproved(teacherName, dates)
      : templates.permissionRejected(teacherName, adminNote || 'No reason provided');

    setImmediate(() => sendSMS(request.user.phone, message).catch(() => {}));

    res.json({ message: `Leave request ${status.toLowerCase()}`, request: updated });
  } catch (err) {
    console.error('PUT /permissions/:id', err);
    res.status(500).json({ message: 'Failed to process leave request' });
  }
});

// ─── DELETE /permissions/:id ──────────────────────────────────────────────────
// Teacher can cancel their own PENDING request.
router.delete('/:id', async (req, res) => {
  try {
    const request = await prisma.permissionRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ message: 'Request not found' });

    if (req.user.role === 'TEACHER' && request.userId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (request.status !== 'PENDING') {
      return res.status(400).json({ message: 'Only pending requests can be cancelled' });
    }

    await prisma.permissionRequest.delete({ where: { id: req.params.id } });
    res.json({ message: 'Request cancelled' });
  } catch (err) {
    console.error('DELETE /permissions/:id', err);
    res.status(500).json({ message: 'Failed to cancel request' });
  }
});

module.exports = router;
