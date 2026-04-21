const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../config/db');

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET / - list announcements
router.get('/', async (req, res, next) => {
  try {
    const { role } = req.user;
    
    // Determine which audiences this user can see
    let validAudiences = ['ALL'];
    if (role === 'TEACHER') validAudiences.push('TEACHERS');
    else if (role === 'PARENT') validAudiences.push('PARENTS');
    else if (role === 'STUDENT') validAudiences.push('STUDENTS');
    // ADMIN can see everything
    
    // Where clause bases visibility on role
    const whereClause = role === 'ADMIN' ? {} : {
      targetAudience: { in: validAudiences }
    };

    const announcements = await prisma.announcement.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { name: true, role: true }
        }
      }
    });

    res.json(announcements);
  } catch (err) {
    next(err);
  }
});

// POST / - create an announcement (Admin only)
router.post('/', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { title, content, targetAudience } = req.body;
    
    if (!title || !content || !targetAudience) {
      return res.status(400).json({ message: 'Title, content, and targetAudience are required.' });
    }

    const allowedAudiences = ['ALL', 'TEACHERS', 'PARENTS', 'STUDENTS'];
    if (!allowedAudiences.includes(targetAudience)) {
      return res.status(400).json({ message: 'Invalid targetAudience. Must be ALL, TEACHERS, PARENTS, or STUDENTS.' });
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        content,
        targetAudience,
        authorId: req.user.id
      }
    });

    res.status(201).json(announcement);
  } catch (err) {
    next(err);
  }
});

// PUT /:id - update announcement (Admin only)
router.put('/:id', authorize('ADMIN'), async (req, res, next) => {
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
      data: dataToUpdate
    });

    res.json(announcement);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Announcement not found.' });
    }
    next(err);
  }
});

// DELETE /:id - delete announcement (Admin only)
router.delete('/:id', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    
    await prisma.announcement.delete({
      where: { id }
    });
    
    res.json({ message: 'Announcement deleted successfully.' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Announcement not found.' });
    }
    next(err);
  }
});

module.exports = router;
