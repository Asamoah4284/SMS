const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

// All routes require authentication
router.use(authenticate);

// TODO: implement subjects routes

module.exports = router;
