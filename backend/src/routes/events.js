const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../config/db');
const { notifySchoolEvent } = require('../services/inAppNotifications');
const { sendSchoolEventPush } = require('../services/pushNotifications');

const router = Router();

router.use(authenticate);

function formatEventDate(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function toEventResponse(row) {
  const subtitle = [row.location, row.description?.slice(0, 80)].filter(Boolean).join(' · ');
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    eventDate: row.eventDate.toISOString(),
    date: row.eventDate.toISOString(),
    type: 'event',
    subtitle: subtitle || 'School event',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdBy
      ? `${row.createdBy.firstName || ''} ${row.createdBy.lastName || ''}`.trim()
      : null,
  };
}

// GET /events — upcoming school events (all staff)
router.get('/', async (req, res, next) => {
  try {
    const now = new Date();
    const includePast = req.query.includePast === 'true' && req.user.role === 'ADMIN';
    const rows = await prisma.schoolEvent.findMany({
      where: includePast ? {} : { eventDate: { gte: now } },
      orderBy: { eventDate: 'asc' },
      take: includePast ? 50 : 20,
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });
    res.json(rows.map(toEventResponse));
  } catch (err) {
    next(err);
  }
});

// POST /events — admin creates event + notifies teachers & parents
router.post('/', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { title, description, eventDate, location } = req.body;
    if (!title?.trim() || !eventDate) {
      return res.status(400).json({ message: 'Title and eventDate are required.' });
    }

    const parsed = new Date(eventDate);
    if (Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ message: 'Invalid eventDate.' });
    }

    const row = await prisma.schoolEvent.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        eventDate: parsed,
        location: location?.trim() || null,
        createdById: req.user.id,
      },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });

    const when = formatEventDate(row.eventDate);
    const body = row.description?.trim() || `Scheduled for ${when}.${row.location ? ` Location: ${row.location}.` : ''}`;

    const [inAppCount, pushResult] = await Promise.all([
      notifySchoolEvent({
        title: row.title,
        message: body,
        excludeUserId: req.user.id,
      }),
      sendSchoolEventPush({
        title: row.title,
        body,
        eventId: row.id,
        eventDate: row.eventDate.toISOString(),
      }),
    ]);

    res.status(201).json({
      ...toEventResponse(row),
      notifications: { inApp: inAppCount, push: pushResult },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /events/:id
router.put('/:id', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { title, description, eventDate, location } = req.body;
    const data = {};
    if (title !== undefined) data.title = title.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (location !== undefined) data.location = location?.trim() || null;
    if (eventDate !== undefined) {
      const parsed = new Date(eventDate);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ message: 'Invalid eventDate.' });
      }
      data.eventDate = parsed;
    }

    const row = await prisma.schoolEvent.update({
      where: { id: req.params.id },
      data,
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });

    res.json(toEventResponse(row));
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Event not found.' });
    next(err);
  }
});

// DELETE /events/:id
router.delete('/:id', authorize('ADMIN'), async (req, res, next) => {
  try {
    await prisma.schoolEvent.delete({ where: { id: req.params.id } });
    res.json({ message: 'Event deleted.' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Event not found.' });
    next(err);
  }
});

module.exports = router;
