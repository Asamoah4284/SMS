const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const prisma = require('../config/db');

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET / - list notifications
router.get('/', async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(notifications);
  } catch (err) {
    next(err);
  }
});

// PUT /:id/read - mark read
router.put('/:id/read', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Verify notification ownership
    const existing = await prisma.notification.findUnique({
      where: { id }
    });
    
    if (!existing) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    if (existing.userId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const notification = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });
    
    res.json(notification);
  } catch (err) {
    next(err);
  }
});

module.exports = router;