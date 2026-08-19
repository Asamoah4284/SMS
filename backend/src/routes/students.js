const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { totalDueFromPayments } = require('../utils/feeAccounting');
const { computeClassPositionByTerm } = require('../utils/classRanking');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../config/db');
const { ensureStudentPortal, DEFAULT_STUDENT_PIN } = require('../utils/studentPortal');
const { generateStudentId, renumberClassStudentIds } = require('../utils/studentId');
const {
  primaryGuardianDisplay,
  secondaryGuardianDisplay,
  resolvePrimaryGuardian,
  resolveSecondaryGuardian,
} = require('../utils/studentGuardian');
const { syncStudentGuardians } = require('../services/parentAccount');
const {
  notifyStudentEnrolled,
  notifyStudentDeleted,
} = require('../services/inAppNotifications');

const router = Router();
router.use(authenticate);

async function getTeacherAccess(userId) {
  return prisma.teacher.findUnique({
    where: { userId },
    include: {
      classTeacherOf: { select: { id: true, name: true } },
      subjectTeachers: { select: { classId: true } },
    },
  });
}

/** Teachers may edit students in classes they teach (class or subject teacher). */
async function assertCanEditStudent(req, student) {
  if (req.user.role === 'ADMIN') return { ok: true };
  if (req.user.role !== 'TEACHER') {
    return { ok: false, status: 403, message: 'Forbidden' };
  }

  const teacher = await getTeacherAccess(req.user.id);
  if (!teacher) {
    return { ok: false, status: 404, message: 'Teacher profile not found' };
  }

  const allowedClassIds = new Set(teacher.subjectTeachers.map((st) => st.classId));
  if (teacher.classTeacherOf) allowedClassIds.add(teacher.classTeacherOf.id);

  if (!student.classId || !allowedClassIds.has(student.classId)) {
    return {
      ok: false,
      status: 403,
      message: 'You can only edit students in your assigned classes',
    };
  }

  return { ok: true, teacher };
}

const uploadDir = path.join(__dirname, '../../uploads');
const studentDocUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      const kind = file.fieldname === 'healthInsuranceCard' ? 'insurance' : 'photo';
      cb(null, `student-${req.params.id}-${kind}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      (file.mimetype && file.mimetype.startsWith('image/')) ||
      file.mimetype === 'application/pdf';
    if (ok) cb(null, true);
    else cb(new Error('Only images (JPEG, PNG, WebP, GIF) or PDF are allowed'));
  },
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Normalise a Ghanaian phone to 10-digit local format for comparison */
function normalisePhone(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) return '0' + digits.slice(3);
  return digits.length === 10 ? digits : null;
}

// ─── GET /students ───────────────────────────────────────────────────────────
// Query params: page, limit, classId, search, isActive
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 30);
    const { classId, search, isActive } = req.query;

    const where = {};
    if (classId) where.classId = classId;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { studentId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, students] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: {
          class: { select: { id: true, name: true, level: true } },
          parent: {
            include: {
              user: { select: { firstName: true, lastName: true, phone: true } },
            },
          },
        },
      }),
    ]);

    const data = students.map((s) => {
      const primary = primaryGuardianDisplay(s);
      const secondary = secondaryGuardianDisplay(s);
      return {
        id: s.id,
        studentId: s.studentId,
        firstName: s.firstName,
        lastName: s.lastName,
        gender: s.gender,
        isActive: s.isActive,
        class: s.class,
        parentName: primary.name,
        parentPhone: primary.phone,
        parent2Name: secondary.name,
        parent2Phone: secondary.phone,
      };
    });

    res.json({ data, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('GET /students', err);
    res.status(500).json({ message: 'Failed to fetch students' });
  }
});

// ─── POST /students ──────────────────────────────────────────────────────────
router.post('/', authorize('ADMIN', 'TEACHER'), async (req, res) => {
  try {
    const {
      firstName,
      middleName,
      lastName,
      dateOfBirth,
      gender,
      address,
      classId,
      // Guardian / parent fields
      guardianName,
      guardianPhone,
      guardianAddress,
      guardian2Name,
      guardian2Phone,
    } = req.body;

    // Class teachers can only add students to their own class.
    if (req.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findUnique({
        where: { userId: req.user.id },
        include: { classTeacherOf: { select: { id: true, name: true } } },
      });

      if (!teacher?.classTeacherOf) {
        return res.status(403).json({ message: 'Only assigned class teachers can add students' });
      }

      if (!classId) {
        return res.status(400).json({ message: 'Class is required for teacher-created students' });
      }

      if (classId !== teacher.classTeacherOf.id) {
        return res.status(403).json({
          message: `You can only add students to your assigned class (${teacher.classTeacherOf.name})`,
        });
      }
    }

    // Basic validation
    if (!firstName || !lastName) {
      return res.status(400).json({ message: 'First name and last name are required' });
    }
    if (!gender || !['MALE', 'FEMALE'].includes(gender)) {
      return res.status(400).json({ message: 'Valid gender (MALE/FEMALE) is required' });
    }

    if (!classId) {
      return res.status(400).json({ message: 'Class is required (used to generate student ID, e.g. ELM-Y1-001).' });
    }

    // Validate classId if provided
    const cls = await prisma.class.findUnique({ where: { id: classId } });
    if (!cls) return res.status(400).json({ message: 'Class not found' });

    const fullFirst = middleName ? `${firstName} ${middleName}` : firstName;

    const studentId = await generateStudentId(prisma, classId, {
      firstName: fullFirst,
      lastName,
    });

    const primary = await resolvePrimaryGuardian(prisma, {
      name: guardianName,
      phone: guardianPhone,
    });
    const secondary = resolveSecondaryGuardian({
      name: guardian2Name,
      phone: guardian2Phone,
    });

    const student = await prisma.student.create({
      data: {
        studentId,
        firstName: fullFirst,
        lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender,
        address: address || null,
        classId: classId || null,
        parentId: primary.parentId,
        parentName: primary.parentName,
        parentPhone: primary.parentPhone,
        parent2Name: secondary.parent2Name,
        parent2Phone: secondary.parent2Phone,
      },
      include: {
        class: { select: { id: true, name: true } },
        parent: {
          include: { user: { select: { firstName: true, lastName: true, phone: true } } },
        },
      },
    });

    const portal = await ensureStudentPortal(prisma, student);
    await syncStudentGuardians(prisma, student.id);
    await renumberClassStudentIds(prisma, classId);
    const refreshed = await prisma.student.findUnique({
      where: { id: student.id },
      include: {
        class: { select: { id: true, name: true } },
        parent: {
          include: { user: { select: { firstName: true, lastName: true, phone: true } } },
        },
      },
    });

    res.status(201).json({
      message: 'Student created successfully',
      student: {
        id: refreshed.id,
        studentId: refreshed.studentId,
        firstName: refreshed.firstName,
        lastName: refreshed.lastName,
        gender: refreshed.gender,
        class: refreshed.class,
        parentLinked: !!primary.parentId,
        parentName: refreshed.parent
          ? `${refreshed.parent.user.firstName} ${refreshed.parent.user.lastName}`
          : refreshed.parentName,
        parentPhone: refreshed.parent ? refreshed.parent.user.phone : refreshed.parentPhone,
        parent2Name: refreshed.parent2Name,
        parent2Phone: refreshed.parent2Phone,
      },
      portal: {
        enabled: portal.portalEnabled,
        studentId: refreshed.studentId,
        defaultPin: portal.defaultPin ?? null,
        loginPath: '/student/login',
      },
    });

    notifyStudentEnrolled({
      studentName: `${refreshed.firstName} ${refreshed.lastName}`.trim(),
      className: refreshed.class?.name,
      classId: refreshed.classId,
      excludeUserId: req.user.id,
    }).catch((err) => console.error('Student enrolled notification failed:', err.message));
  } catch (err) {
    console.error('POST /students', err);
    res.status(500).json({ message: 'Failed to create student' });
  }
});

// ─── GET /students/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: {
        class: {
          include: {
            classTeacher: {
              include: { user: { select: { firstName: true, lastName: true } } },
            },
          },
        },
        parent: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
            children: {
              select: { id: true, studentId: true, firstName: true, lastName: true },
            },
          },
        },
        studentProfile: { select: { id: true, mustChangePin: true } },
        attendances: {
          orderBy: { date: 'desc' },
          take: 30,
          include: { term: { select: { id: true, name: true, year: true } } },
        },
        results: {
          include: {
            subject: { select: { id: true, name: true } },
            term: { select: { id: true, name: true, year: true } },
          },
          orderBy: [{ term: { year: 'desc' } }, { subject: { name: 'asc' } }],
        },
        feePayments: {
          include: {
            feeStructure: { select: { id: true, name: true, amount: true } },
            term: { select: { id: true, name: true, year: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!student) return res.status(404).json({ message: 'Student not found' });

    // Attendance summary
    const attendanceSummary = student.attendances.reduce(
      (acc, a) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      },
      { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 }
    );
    const totalDays = student.attendances.length;
    const attendanceRate =
      totalDays > 0
        ? Math.round(
            ((attendanceSummary.PRESENT + attendanceSummary.LATE) / totalDays) * 100
          )
        : null;

    // Fee summary
    const feeTotalPaid = student.feePayments.reduce((s, p) => s + p.amountPaid, 0);
    const feeTotalDue = totalDueFromPayments(student.feePayments);

    const termIds = [...new Set(student.results.map((r) => r.termId))];
    const classPositionByTerm = await computeClassPositionByTerm(
      prisma,
      student.id,
      student.classId,
      termIds,
    );

    res.json({
      ...student,
      portalEnabled: !!student.studentProfile,
      attendanceSummary: { ...attendanceSummary, total: totalDays, rate: attendanceRate },
      feeSummary: { totalPaid: feeTotalPaid, totalDue: feeTotalDue, balance: Math.max(0, feeTotalDue - feeTotalPaid) },
      classPositionByTerm,
    });
  } catch (err) {
    console.error('GET /students/:id', err);
    res.status(500).json({ message: 'Failed to fetch student' });
  }
});

// ─── POST /students/:id/upload — child photo & insurance card (multipart) ───
router.post('/:id/upload', authorize('ADMIN', 'TEACHER'), (req, res) => {
  studentDocUpload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'healthInsuranceCard', maxCount: 1 },
  ])(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Upload failed' });
    }
    try {
      const existing = await prisma.student.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ message: 'Student not found' });

      const gate = await assertCanEditStudent(req, existing);
      if (!gate.ok) return res.status(gate.status).json({ message: gate.message });

      const files = req.files || {};
      const data = {};
      const base = `${req.protocol}://${req.get('host')}/uploads`;

      if (files.photo?.[0]) {
        data.photo = `${base}/${files.photo[0].filename}`;
      }
      if (files.healthInsuranceCard?.[0]) {
        data.healthInsuranceCard = `${base}/${files.healthInsuranceCard[0].filename}`;
      }

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ message: 'No files provided (fields: photo, healthInsuranceCard)' });
      }

      const student = await prisma.student.update({
        where: { id: req.params.id },
        data,
      });

      res.json({ message: 'Files uploaded', ...data, student });
    } catch (uploadErr) {
      console.error('POST /students/:id/upload', uploadErr);
      res.status(500).json({ message: 'Failed to save uploaded files' });
    }
  });
});

// ─── PUT /students/:id ───────────────────────────────────────────────────────
router.put('/:id', authorize('ADMIN', 'TEACHER'), async (req, res) => {
  try {
    const {
      firstName,
      middleName,
      lastName,
      dateOfBirth,
      gender,
      address,
      classId,
      isActive,
      photo,
      healthInsuranceCard,
      parentName,
      parentPhone,
      parent2Name,
      parent2Phone,
    } = req.body;

    const existing = await prisma.student.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Student not found' });

    const gate = await assertCanEditStudent(req, existing);
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });

    const isTeacher = req.user.role === 'TEACHER';
    if (isTeacher && (classId !== undefined || isActive !== undefined)) {
      return res.status(403).json({
        message: 'Only administrators can change class assignment or active status',
      });
    }

    const fullFirst =
      firstName !== undefined
        ? middleName
          ? `${firstName} ${middleName}`
          : firstName
        : undefined;

    const normParentPhone =
      parentPhone !== undefined ? normalisePhone(parentPhone) || parentPhone || null : undefined;
    const normParent2Phone =
      parent2Phone !== undefined ? normalisePhone(parent2Phone) || parent2Phone || null : undefined;

    const updated = await prisma.student.update({
      where: { id: req.params.id },
      data: {
        ...(fullFirst !== undefined && { firstName: fullFirst }),
        ...(lastName !== undefined && { lastName }),
        ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }),
        ...(gender !== undefined && { gender }),
        ...(address !== undefined && { address: address || null }),
        ...(classId !== undefined && { classId: classId || null }),
        ...(isActive !== undefined && { isActive }),
        ...(photo !== undefined && { photo: photo || null }),
        ...(healthInsuranceCard !== undefined && { healthInsuranceCard: healthInsuranceCard || null }),
        ...(parentName !== undefined && { parentName: parentName || null }),
        ...(normParentPhone !== undefined && { parentPhone: normParentPhone }),
        ...(parent2Name !== undefined && { parent2Name: parent2Name || null }),
        ...(normParent2Phone !== undefined && { parent2Phone: normParent2Phone }),
      },
      include: { class: { select: { id: true, name: true } } },
    });

    await syncStudentGuardians(prisma, req.params.id);

    if (classId !== undefined && classId !== existing.classId) {
      if (existing.classId) await renumberClassStudentIds(prisma, existing.classId);
      if (classId) await renumberClassStudentIds(prisma, classId);
    } else if (
      (fullFirst !== undefined || lastName !== undefined) &&
      updated.classId
    ) {
      await renumberClassStudentIds(prisma, updated.classId);
    }

    const refreshed = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: { class: { select: { id: true, name: true } } },
    });

    res.json({ message: 'Student updated', student: refreshed });
  } catch (err) {
    console.error('PUT /students/:id', err);
    res.status(500).json({ message: 'Failed to update student' });
  }
});

// ─── DELETE /students/:id (Admin only) ───────────────────────────────────────
router.delete('/:id', authorize('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const student = await prisma.student.findUnique({
      where: { id },
      select: { id: true, firstName: true, lastName: true, studentId: true, classId: true },
    });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const classMeta = student.classId
      ? await prisma.class.findUnique({ where: { id: student.classId }, select: { name: true } })
      : null;

    await prisma.$transaction(async (tx) => {
      await tx.attendance.deleteMany({ where: { studentId: id } });
      await tx.result.deleteMany({ where: { studentId: id } });
      await tx.assessmentScore.deleteMany({ where: { studentId: id } });
      await tx.termRemarks.deleteMany({ where: { studentId: id } });
      await tx.feePayment.deleteMany({ where: { studentId: id } });
      // Cascades: StudentProfile, PaystackIntent, book*, ExamAttempt
      await tx.student.delete({ where: { id } });
    });

    if (student.classId) {
      await renumberClassStudentIds(prisma, student.classId);
    }

    res.json({
      message: 'Student deleted',
      student: {
        id: student.id,
        studentId: student.studentId,
        name: `${student.firstName} ${student.lastName}`,
      },
    });

    notifyStudentDeleted({
      studentName: `${student.firstName} ${student.lastName}`.trim(),
      studentId: student.studentId,
      className: classMeta?.name,
    }).catch((err) => console.error('Student deleted notification failed:', err.message));
  } catch (err) {
    console.error('DELETE /students/:id', err);
    res.status(500).json({ message: 'Failed to delete student' });
  }
});

// ─── POST /students/bulk-import ──────────────────────────────────────────────
router.post('/bulk-import', authorize('ADMIN'), async (req, res) => {
  try {
    const { students } = req.body;
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ message: 'No students provided' });
    }

    const results = { imported: 0, failed: [] };
    const touchedClassIds = new Set();

    for (let i = 0; i < students.length; i++) {
      const row = students[i];
      const rowNum = i + 1;

      if (!row.firstName || !row.lastName) {
        results.failed.push({ row: rowNum, reason: 'Missing first or last name' });
        continue;
      }
      if (!row.gender || !['MALE', 'FEMALE'].includes(String(row.gender).toUpperCase())) {
        results.failed.push({ row: rowNum, reason: 'Invalid gender' });
        continue;
      }

      try {
        if (!row.classId) {
          results.failed.push({ row: rowNum, reason: 'classId or class_name required' });
          continue;
        }

        const fullFirst = row.middleName
          ? `${row.firstName} ${row.middleName}`
          : row.firstName;

        const primary = await resolvePrimaryGuardian(prisma, {
          name: row.guardianName,
          phone: row.guardianPhone,
        });
        const secondary = resolveSecondaryGuardian({
          name: row.guardian2Name,
          phone: row.guardian2Phone,
        });

        const studentId = await generateStudentId(prisma, row.classId, {
          firstName: fullFirst,
          lastName: row.lastName,
        });

        const student = await prisma.student.create({
          data: {
            studentId,
            firstName: fullFirst,
            lastName: row.lastName,
            dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : null,
            gender: String(row.gender).toUpperCase(),
            address: row.address || null,
            classId: row.classId || null,
            parentId: primary.parentId,
            parentName: primary.parentName,
            parentPhone: primary.parentPhone,
            parent2Name: secondary.parent2Name,
            parent2Phone: secondary.parent2Phone,
          },
        });
        await ensureStudentPortal(prisma, student);
        await syncStudentGuardians(prisma, student.id);
        touchedClassIds.add(row.classId);
        results.imported++;
      } catch (rowErr) {
        results.failed.push({ row: rowNum, reason: rowErr.message });
      }
    }

    for (const classId of touchedClassIds) {
      await renumberClassStudentIds(prisma, classId);
    }

    res.json(results);
  } catch (err) {
    console.error('POST /students/bulk-import', err);
    res.status(500).json({ message: 'Failed to bulk import students' });
  }
});

// POST /students/:id/portal/enable — manual fallback for legacy students
router.post('/:id/portal/enable', authorize('ADMIN', 'TEACHER'), async (req, res) => {
  try {
    const { pin } = req.body;

    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: { studentProfile: true },
    });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const portal = await ensureStudentPortal(prisma, student, { pin });

    if (!portal.created) {
      return res.status(400).json({ message: 'Portal access already enabled' });
    }

    res.status(201).json({
      message: 'Student portal enabled',
      studentId: portal.studentId,
      defaultPin: portal.defaultPin,
      profileId: student.studentProfile?.id,
    });
  } catch (err) {
    console.error('POST /students/:id/portal/enable', err);
    res.status(500).json({ message: 'Failed to enable portal' });
  }
});

// POST /students/:id/portal/reset-pin
router.post('/:id/portal/reset-pin', authorize('ADMIN', 'TEACHER'), async (req, res) => {
  try {
    const { pin } = req.body;
    const newPin = pin ? String(pin) : DEFAULT_STUDENT_PIN;

    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: { studentProfile: { include: { user: true } } },
    });
    if (!student?.studentProfile) {
      return res.status(404).json({ message: 'Student portal not enabled' });
    }

    const hashed = await bcrypt.hash(newPin, 10);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: student.studentProfile.userId },
        data: { password: hashed },
      }),
      prisma.studentProfile.update({
        where: { id: student.studentProfile.id },
        data: { mustChangePin: true },
      }),
    ]);

    res.json({ message: 'PIN reset successfully', defaultPin: pin ? undefined : newPin });
  } catch (err) {
    console.error('POST /students/:id/portal/reset-pin', err);
    res.status(500).json({ message: 'Failed to reset PIN' });
  }
});

module.exports = router;
