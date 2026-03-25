const { Router } = require('express');
const { authenticate } = require('../middleware/auth');

const router = Router();

// POST /api/v1/auth/login
router.post('/login', (req, res) => {
  res.json({ message: 'TODO: login' });
});

// POST /api/v1/auth/refresh
router.post('/refresh', (req, res) => {
  res.json({ message: 'TODO: refresh token' });
});

// POST /api/v1/auth/logout
router.post('/logout', authenticate, (req, res) => {
  res.json({ message: 'TODO: logout' });
});

// GET /api/v1/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/v1/auth/change-password
router.post('/change-password', authenticate, (req, res) => {
  res.json({ message: 'TODO: change password' });
});

module.exports = router;
