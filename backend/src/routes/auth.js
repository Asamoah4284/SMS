const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');
const {
  isValidPhoneGH,
  formatPhoneE164,
  isStrongPassword,
} = require('../utils/validators');
const { generateStaffId } = require('../utils/staffId');
const { generateOTP, getOTPExpiry } = require('../utils/otp');
const { sendSMS } = require('../services/sms');

const router = Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ─────────────────────────────────────────────────────────────────
// POST /auth/invite
// Admin invites a teacher (sends SMS with invitation code)
// ─────────────────────────────────────────────────────────────────

router.post(
  '/invite',
  [
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('phone')
      .custom((value) => {
        if (!isValidPhoneGH(value)) {
          throw new Error('Invalid Ghana phone number');
        }
        return true;
      }),
  ],
  handleValidationErrors,
  authenticate, // Admin only
  async (req, res) => {
    try {
      const { firstName, lastName, phone, classId } = req.body;
      const adminId = req.user.id;

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({ where: { phone } });
      if (existingUser) {
        return res.status(400).json({ error: 'User with this phone already exists' });
      }

      // Check if an unaccepted invitation already exists for this phone
      const existingInvite = await prisma.teacherInvitation.findUnique({ where: { phone } });
      if (existingInvite && !existingInvite.accepted) {
        return res.status(400).json({ error: 'An invitation has already been sent to this phone' });
      }

      // Validate classId if provided (class teacher pre-assignment)
      if (classId) {
        const cls = await prisma.class.findUnique({ where: { id: classId } });
        if (!cls) return res.status(404).json({ error: 'Class not found' });
        if (cls.classTeacherId) {
          return res.status(400).json({ error: 'This class already has a teacher assigned' });
        }
      }

      // Generate unique staff ID
      let staffId = generateStaffId(firstName, lastName);
      let attempt = 0;
      while (
        (await prisma.teacher.findUnique({ where: { staffId } })) ||
        (await prisma.teacherInvitation.findFirst({ where: { staffId, accepted: false } }))
      ) {
        staffId = generateStaffId(firstName, lastName);
        if (++attempt > 10) { staffId = `${staffId}${Date.now() % 1000}`; break; }
      }

      // Generate 6-digit invite code
      const inviteCode = String(Math.floor(100000 + Math.random() * 900000));
      const codeExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

      // Create invitation record (with name + optional class)
      await prisma.teacherInvitation.create({
        data: {
          staffId,
          phone,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          inviteCode,
          codeExpiry,
          classId: classId || null,
          createdBy: adminId,
        },
      });

      // Send SMS with invite code
      const e164Phone = formatPhoneE164(phone);
      const smsText = `[${process.env.SCHOOL_ABBREVIATION || 'SMS'}] Welcome ${firstName}! Staff ID: ${staffId} | Code: ${inviteCode} | ${process.env.FRONTEND_URL}/invite`;

      await sendSMS(e164Phone, smsText);

      res.json({
        message: 'Invitation sent successfully',
        staffId,
        phone: '****' + phone.slice(-4),
      });
    } catch (error) {
      console.error('Invite error:', error);
      res.status(500).json({ error: 'Failed to send invitation' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// POST /auth/verify-invite
// Teacher provides staff ID and invite code
// ─────────────────────────────────────────────────────────────────

router.post(
  '/verify-invite',
  [
    body('staffId').notEmpty().withMessage('Staff ID is required'),
    body('inviteCode')
      .isLength({ min: 6, max: 6 })
      .withMessage('Invite code must be 6 digits'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { staffId, inviteCode } = req.body;

      // Find invitation
      const invitation = await prisma.teacherInvitation.findUnique({
        where: { staffId },
      });

      if (!invitation) {
        return res.status(404).json({ error: 'Invalid staff ID' });
      }

      if (invitation.accepted) {
        return res
          .status(400)
          .json({ error: 'This invitation has already been accepted' });
      }

      if (new Date() > invitation.codeExpiry) {
        return res.status(400).json({ error: 'Invitation code has expired' });
      }

      if (invitation.inviteCode !== inviteCode) {
        return res.status(400).json({ error: 'Invalid invitation code' });
      }

      // Code is valid - generate a temporary token for password setup
      const tempToken = jwt.sign(
        { staffId, invite: true },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );

      res.json({
        message: 'Invitation verified',
        tempToken,
        staffId,
      });
    } catch (error) {
      console.error('Verify invite error:', error);
      res.status(500).json({ error: 'Failed to verify invitation' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// POST /auth/set-password
// Teacher sets password after verifying invite code
// ─────────────────────────────────────────────────────────────────

router.post(
  '/set-password',
  [
    body('tempToken').notEmpty().withMessage('Temp token is required'),
    body('staffId').notEmpty().withMessage('Staff ID is required'),
    body('password')
      .custom((value) => {
        if (!isStrongPassword(value)) {
          throw new Error(
            'Password must be at least 8 chars with uppercase, lowercase, and digit'
          );
        }
        return true;
      }),
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { tempToken, staffId, password } = req.body;

      // Verify temp token
      let decoded;
      try {
        decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
      } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      if (decoded.staffId !== staffId || !decoded.invite) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Get invitation
      const invitation = await prisma.teacherInvitation.findUnique({
        where: { staffId },
      });

      if (!invitation || invitation.accepted) {
        return res.status(400).json({ error: 'Invalid invitation' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create User + Teacher + optionally assign class — all in one transaction
      const [user] = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            phone: invitation.phone,
            password: hashedPassword,
            firstName: invitation.firstName || '',
            lastName: invitation.lastName || '',
            role: 'TEACHER',
          },
        });

        const newTeacher = await tx.teacher.create({
          data: { userId: newUser.id, staffId },
        });

        // Pre-assign as class teacher if invitation had a classId
        if (invitation.classId) {
          await tx.class.update({
            where: { id: invitation.classId },
            data: { classTeacherId: newTeacher.id },
          });
        }

        await tx.teacherInvitation.update({
          where: { staffId },
          data: { accepted: true, acceptedAt: new Date() },
        });

        return [newUser];
      });

      // Generate JWT
      const token = jwt.sign(
        { id: user.id, phone: user.phone, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      const refreshToken = jwt.sign(
        { id: user.id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: '30d' }
      );

      // Save refresh token
      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken },
      });

      res.json({
        message: 'Account created successfully',
        token,
        refreshToken,
        user: { id: user.id, phone: user.phone, role: user.role },
      });
    } catch (error) {
      console.error('Set password error:', error);
      res.status(500).json({ error: 'Failed to create account' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// POST /auth/login
// User logs in with staff ID or phone number
// ─────────────────────────────────────────────────────────────────

router.post(
  '/login',
  [
    body('identifier')
      .notEmpty()
      .withMessage('Staff ID or phone is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { identifier, password } = req.body;

      // Find user by phone or teacher by staffId
      let user;

      user = await prisma.user.findUnique({
        where: { phone: identifier },
      });

      if (!user) {
        // Try to find by staffId
        const teacher = await prisma.teacher.findUnique({
          where: { staffId: identifier },
          include: { user: true },
        });

        user = teacher?.user;
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (!user.isActive) {
        return res.status(403).json({ error: 'Account is inactive' });
      }

      // Generate tokens
      const token = jwt.sign(
        { id: user.id, phone: user.phone, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      const refreshToken = jwt.sign(
        { id: user.id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: '30d' }
      );

      // Save refresh token
      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken },
      });

      // Log teacher attendance if teacher
      if (user.role === 'TEACHER') {
        const today = new Date();
        const currentTerm = await prisma.term.findFirst({
          where: { isCurrent: true },
        });

        if (currentTerm) {
          const teacher = await prisma.teacher.findUnique({
            where: { userId: user.id },
          });

          if (teacher) {
            await prisma.teacherAttendance.upsert({
              where: {
                teacherId_date: {
                  teacherId: teacher.id,
                  date: today,
                },
              },
              create: {
                teacherId: teacher.id,
                termId: currentTerm.id,
                date: today,
                status: 'PRESENT',
                checkIn: new Date(),
              },
              update: {
                status: 'PRESENT',
                checkIn: new Date(),
              },
            });
          }
        }
      }

      res.json({
        message: 'Login successful',
        token,
        refreshToken,
        user: {
          id: user.id,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// POST /auth/forgot-password
// Request OTP for password reset
// ─────────────────────────────────────────────────────────────────

router.post(
  '/forgot-password',
  [
    body('phone')
      .custom((value) => {
        if (!isValidPhoneGH(value)) {
          throw new Error('Invalid Ghana phone number');
        }
        return true;
      }),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { phone } = req.body;

      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { phone },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Generate OTP
      const otp = generateOTP();
      const expiresAt = getOTPExpiry(10);

      // Save OTP
      await prisma.oTPLog.create({
        data: {
          phone,
          code: otp,
          expiresAt,
        },
      });

      // Send OTP via SMS
      const e164Phone = formatPhoneE164(phone);
      const smsText = `[${process.env.SCHOOL_ABBREVIATION || 'SMS'}] Your OTP: ${otp}\nValid for 10 minutes`;

      await sendSMS(e164Phone, smsText);

      res.json({
        message: 'OTP sent to your phone',
        phone: '****' + phone.slice(-4),
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Failed to process request' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// POST /auth/verify-otp
// Verify OTP and get temporary token for password reset
// ─────────────────────────────────────────────────────────────────

router.post(
  '/verify-otp',
  [
    body('phone').custom((value) => {
      if (!isValidPhoneGH(value)) {
        throw new Error('Invalid Ghana phone number');
      }
      return true;
    }),
    body('otp')
      .isLength({ min: 6, max: 6 })
      .withMessage('OTP must be 6 digits'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { phone, otp } = req.body;

      // Find valid OTP
      const otpRecord = await prisma.oTPLog.findFirst({
        where: {
          phone,
          code: otp,
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!otpRecord) {
        return res.status(400).json({ error: 'Invalid or expired OTP' });
      }

      // Increment attempts
      await prisma.oTPLog.update({
        where: { id: otpRecord.id },
        data: { attempted: { increment: 1 } },
      });

      // Generate temp token
      const tempToken = jwt.sign(
        { phone, resetPassword: true },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );

      res.json({
        message: 'OTP verified',
        tempToken,
      });
    } catch (error) {
      console.error('Verify OTP error:', error);
      res.status(500).json({ error: 'Failed to verify OTP' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// POST /auth/reset-password
// Reset password using temporary token from OTP verification
// ─────────────────────────────────────────────────────────────────

router.post(
  '/reset-password',
  [
    body('tempToken').notEmpty().withMessage('Temp token is required'),
    body('phone').custom((value) => {
      if (!isValidPhoneGH(value)) {
        throw new Error('Invalid Ghana phone number');
      }
      return true;
    }),
    body('password')
      .custom((value) => {
        if (!isStrongPassword(value)) {
          throw new Error(
            'Password must be at least 8 chars with uppercase, lowercase, and digit'
          );
        }
        return true;
      }),
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { tempToken, phone, password } = req.body;

      // Verify temp token
      let decoded;
      try {
        decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
      } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      if (decoded.phone !== phone || !decoded.resetPassword) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Find and update user
      const user = await prisma.user.findUnique({
        where: { phone },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update password
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      // Clear OTP records
      await prisma.oTPLog.deleteMany({
        where: { phone },
      });

      res.json({
        message: 'Password reset successfully',
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// POST /auth/refresh
// Refresh JWT token
// ─────────────────────────────────────────────────────────────────

router.post(
  '/refresh',
  [body('refreshToken').notEmpty().withMessage('Refresh token is required')],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { refreshToken } = req.body;

      // Verify refresh token
      let decoded;
      try {
        decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
      } catch {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      // Find user and verify token matches
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (!user || user.refreshToken !== refreshToken) {
        return res.status(401).json({ error: 'Refresh token mismatch' });
      }

      // Generate new JWT
      const newToken = jwt.sign(
        { id: user.id, phone: user.phone, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        message: 'Token refreshed',
        token: newToken,
      });
    } catch (error) {
      console.error('Refresh error:', error);
      res.status(500).json({ error: 'Failed to refresh token' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// GET /auth/me
// Returns current user's profile + teacher context (if TEACHER)
// ─────────────────────────────────────────────────────────────────

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        teacherProfile: {
          select: {
            id: true,
            staffId: true,
            classTeacherOf: {
              select: { id: true, name: true, level: true },
            },
            subjectTeachers: {
              select: {
                classId: true,
                class: { select: { id: true, name: true } },
                subjectId: true,
                subject: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ user });
  } catch (err) {
    console.error('GET /auth/me', err);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

module.exports = router;
