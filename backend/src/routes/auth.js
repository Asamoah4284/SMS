const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
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
      let smsWarning = null;
      try {
        await sendSMS(e164Phone, smsText);
      } catch (smsError) {
        console.error('Invite SMS send failed:', smsError);
        smsWarning = 'Invitation created, but SMS delivery failed. Share the code manually or retry.';
      }

      res.json({
        message: smsWarning ? 'Invitation created with SMS warning' : 'Invitation sent successfully',
        warning: smsWarning,
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
        user: {
          id: user.id,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        /** Invited without a pre-assigned class → subject teacher must pick subjects & classes */
        needsTeachingSetup: !invitation.classId,
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
      const raw = String(req.body.identifier ?? '').trim();
      const { password } = req.body;

      /** Phone may be stored as +233… while user types 024… — try both. */
      const phoneCandidates = new Set([raw]);
      if (isValidPhoneGH(raw)) {
        const e164 = formatPhoneE164(raw);
        if (e164) phoneCandidates.add(e164);
      }

      let user;
      for (const phone of phoneCandidates) {
        const byPhone = await prisma.user.findUnique({
          where: { phone },
        });
        if (byPhone) {
          user = byPhone;
          break;
        }
      }

      if (!user) {
        const teacher = await prisma.teacher.findUnique({
          where: { staffId: raw },
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
// POST /auth/parent/lookup
// Parent enters phone → get list of their children (no password needed)
// Parents are registered when students are created
// ─────────────────────────────────────────────────────────────────

router.post(
  '/parent/lookup',
  [
    body('phone')
      .custom((value) => {
        if (!isValidPhoneGH(value)) throw new Error('Invalid phone number');
        return true;
      }),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { phone } = req.body;

      // Normalize to local 0XXXXXXXXX format
      const digits = phone.replace(/\D/g, '');
      const localPhone = digits.startsWith('233') ? '0' + digits.slice(3) : digits;
      const e164Phone = '+233' + localPhone.slice(1);
      const phoneVariants = [...new Set([localPhone, e164Phone, digits])];

      // Find students by parentPhone (quick-contact, no portal account)
      const byParentPhone = await prisma.student.findMany({
        where: { isActive: true, parentPhone: { in: phoneVariants } },
        select: {
          id: true,
          studentId: true,
          firstName: true,
          lastName: true,
          photo: true,
          class: { select: { id: true, name: true } },
        },
      });

      // Find students via linked Parent → User account
      const byLinkedParent = await prisma.student.findMany({
        where: {
          isActive: true,
          parent: { user: { phone: { in: phoneVariants } } },
        },
        select: {
          id: true,
          studentId: true,
          firstName: true,
          lastName: true,
          photo: true,
          class: { select: { id: true, name: true } },
        },
      });

      // Get the user ID for the parent (if exists - for portal account holders)
      const user = await prisma.user.findFirst({
        where: { phone: { in: phoneVariants }, role: 'PARENT' },
        select: { id: true },
      });

      // Merge and deduplicate
      const seen = new Set();
      const children = [...byParentPhone, ...byLinkedParent].filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });

      if (children.length === 0) {
        return res.status(404).json({ error: 'No children found for this phone number' });
      }

      // Issue a JWT scoped to this parent
      // Include user ID if they have a portal account, otherwise use phone
      const token = jwt.sign(
        { 
          id: user?.id || null,
          phone: localPhone, 
          role: 'PARENT' 
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({ children, token });
    } catch (error) {
      console.error('Parent lookup error:', error);
      res.status(500).json({ error: 'Lookup failed' });
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
// POST /auth/teaching-assignments
// Subject-only teachers: register which subjects they teach and for which classes
// (Class teachers manage subject assignments via class settings.)
// ─────────────────────────────────────────────────────────────────

router.post(
  '/teaching-assignments',
  authenticate,
  authorize('TEACHER'),
  [
    body('assignments').isArray({ min: 1 }).withMessage('At least one assignment is required'),
    body('assignments.*.subjectId').notEmpty().withMessage('Each assignment needs subjectId'),
    body('assignments.*.classId').notEmpty().withMessage('Each assignment needs classId'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { assignments: raw } = req.body;

      const teacher = await prisma.teacher.findUnique({
        where: { userId: req.user.id },
        include: { classTeacherOf: { select: { id: true } } },
      });

      if (!teacher) {
        return res.status(404).json({ error: 'Teacher profile not found' });
      }

      if (teacher.classTeacherOf) {
        return res.status(400).json({
          error: 'Class teachers assign subjects from class settings, not this screen.',
        });
      }

      const seen = new Set();
      const pairs = [];
      for (const row of raw) {
        const subjectId = String(row.subjectId ?? '').trim();
        const classId = String(row.classId ?? '').trim();
        const key = `${subjectId}:${classId}`;
        if (!subjectId || !classId) {
          return res.status(400).json({ error: 'Each assignment must have subjectId and classId' });
        }
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push({ subjectId, classId });
      }

      if (pairs.length === 0) {
        return res.status(400).json({ error: 'Add at least one subject and class pair' });
      }

      for (const { subjectId, classId } of pairs) {
        const [subject, cls] = await Promise.all([
          prisma.subject.findUnique({ where: { id: subjectId } }),
          prisma.class.findUnique({ where: { id: classId } }),
        ]);
        if (!subject || !cls) {
          return res.status(400).json({ error: 'Invalid subject or class selected' });
        }
      }

      await prisma.subjectTeacher.createMany({
        data: pairs.map((p) => ({
          teacherId: teacher.id,
          subjectId: p.subjectId,
          classId: p.classId,
        })),
        skipDuplicates: true,
      });

      res.json({ message: 'Teaching assignments saved' });
    } catch (err) {
      console.error('POST /auth/teaching-assignments', err);
      res.status(500).json({ error: 'Failed to save assignments' });
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

    const needsTeachingSetup =
      user.role === 'TEACHER' &&
      user.teacherProfile &&
      !user.teacherProfile.classTeacherOf &&
      (user.teacherProfile.subjectTeachers?.length ?? 0) === 0;

    res.json({ user, needsTeachingSetup });
  } catch (err) {
    console.error('GET /auth/me', err);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

module.exports = router;
