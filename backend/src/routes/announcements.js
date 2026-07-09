const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../config/db');
const { sendAnnouncementPush } = require('../services/pushNotifications');
const { notifyAnnouncement } = require('../services/inAppNotifications');

const router = Router();

router.use(authenticate);

function authorName(author) {
  if (!author) return 'Staff';
  return `${author.firstName || ''} ${author.lastName || ''}`.trim() || 'Staff';
}

// GET / - list announcements
router.get('/', async (req, res, next) => {
  try {
    const { role } = req.user;

    let validAudiences = ['ALL'];
    if (role === 'TEACHER') validAudiences.push('TEACHERS');
    else if (role === 'PARENT') validAudiences.push('PARENTS');
    else if (role === 'STUDENT') validAudiences.push('STUDENTS');

    const whereClause = role === 'ADMIN' ? {} : { targetAudience: { in: validAudiences } };

    const announcements = await prisma.announcement.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { firstName: true, lastName: true, role: true },
        },
      },
    });

    res.json(
      announcements.map((a) => ({
        ...a,
        authorName: authorName(a.author),
      }))
    );
  } catch (err) {
    next(err);
  }
});

// POST / - create announcement (Admin + Teacher) and notify parents via push
router.post('/', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const { title, content, targetAudience } = req.body;

    if (!title || !content || !targetAudience) {
      return res.status(400).json({ message: 'Title, content, and targetAudience are required.' });
    }

    const allowedAudiences = ['ALL', 'TEACHERS', 'PARENTS', 'STUDENTS'];
    if (!allowedAudiences.includes(targetAudience)) {
      return res.status(400).json({ message: 'Invalid targetAudience. Must be ALL, TEACHERS, PARENTS, or STUDENTS.' });
    }

    if (req.user.role === 'TEACHER' && targetAudience === 'TEACHERS') {
      return res.status(403).json({ message: 'Teachers cannot post teacher-only announcements.' });
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        content,
        targetAudience,
        authorId: req.user.id,
      },
      include: {
        author: { select: { firstName: true, lastName: true, role: true } },
      },
    });

    let pushResult = { sent: 0 };
    if (['ALL', 'PARENTS'].includes(targetAudience)) {
      pushResult = await sendAnnouncementPush({ title, content, targetAudience });
    }

    let inAppCount = 0;
    if (['ALL', 'TEACHERS'].includes(targetAudience)) {
      inAppCount = await notifyAnnouncement({
        title,
        content,
        targetAudience,
        authorId: req.user.id,
      });
    }

    res.status(201).json({
      ...announcement,
      authorName: authorName(announcement.author),
      push: pushResult,
      inApp: { sent: inAppCount },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /:id - update announcement (Admin + Teacher)
router.put('/:id', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, content, targetAudience } = req.body;

    const dataToUpdate = {};
    if (title) dataToUpdate.title = title;
    if (content) dataToUpdate.content = content;
    if (targetAudience) {
      const allowedAudiences = ['ALL', 'TEACHERS', 'PARENTS', 'STUDENTS'];
      if (!allowedAudiences.includes(targetAudience)) {
        return res.status(400).json({ message: 'Invalid targetAudience.' });
      }
      dataToUpdate.targetAudience = targetAudience;
    }

    const announcement = await prisma.announcement.update({
      where: { id },
      data: dataToUpdate,
      include: { author: { select: { firstName: true, lastName: true, role: true } } },
    });

    res.json({ ...announcement, authorName: authorName(announcement.author) });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Announcement not found.' });
    }
    next(err);
  }
});

// DELETE /:id
router.delete('/:id', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    await prisma.announcement.delete({ where: { id: req.params.id } });
    res.json({ message: 'Announcement deleted successfully.' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Announcement not found.' });
    }
    next(err);
  }
});

module.exports = router;
