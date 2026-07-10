const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../config/db');
const { getStudentBookLines } = require('../utils/studentBooks');
const { notifyBookPaymentReceived } = require('../services/inAppNotifications');

const router = Router();
router.use(authenticate);

const uploadDir = path.join(__dirname, '../../uploads');
const coverUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `book-cover-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed'));
  },
});

// POST /upload-cover — book cover image (multipart field: cover)
router.post('/upload-cover', authorize('ADMIN', 'TEACHER'), (req, res, next) => {
  coverUpload.single('cover')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }
    const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ url });
  });
});

// GET / — list all books in catalog (?termId= includes assigned class for that term)
router.get('/', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const { termId } = req.query;
    const books = await prisma.book.findMany({
      where: { isActive: true },
      orderBy: { title: 'asc' },
      include: {
        _count: { select: { assignments: true, payments: true } },
      },
    });

    if (!termId) {
      return res.json(books.map((b) => ({ ...b, assignedClass: null })));
    }

    const classAssignments = await prisma.bookAssignment.findMany({
      where: {
        termId: String(termId),
        studentId: null,
        classId: { not: null },
        bookId: { in: books.map((b) => b.id) },
      },
      include: { class: { select: { id: true, name: true } } },
    });

    const classByBookId = new Map();
    for (const row of classAssignments) {
      if (!classByBookId.has(row.bookId) && row.class) {
        classByBookId.set(row.bookId, row.class);
      }
    }

    res.json(
      books.map((b) => ({
        ...b,
        assignedClass: classByBookId.get(b.id) ?? null,
      })),
    );
  } catch (err) {
    next(err);
  }
});

/** One class-level assignment per book per term (no individual student). */
async function syncBookClassAssignment(tx, bookId, classId, termId) {
  if (!termId) {
    throw Object.assign(new Error('termId is required'), { status: 400 });
  }
  if (!classId) {
    throw Object.assign(new Error('classId is required'), { status: 400 });
  }

  const duplicate = await tx.bookAssignment.findFirst({
    where: {
      bookId,
      termId,
      classId,
      studentId: null,
    },
  });
  if (duplicate) {
    return duplicate;
  }

  const existing = await tx.bookAssignment.findFirst({
    where: { bookId, termId, studentId: null },
  });

  if (existing) {
    if (existing.classId === classId) return existing;
    const conflict = await tx.bookAssignment.findFirst({
      where: { bookId, termId, classId, studentId: null, id: { not: existing.id } },
    });
    if (conflict) {
      throw Object.assign(new Error('This book is already assigned to that class for this term'), { status: 400 });
    }
    return tx.bookAssignment.update({
      where: { id: existing.id },
      data: { classId },
    });
  }

  return tx.bookAssignment.create({
    data: { bookId, classId, termId, isRequired: true },
  });
}

// POST / — create book (+ class assignment for term)
router.post('/', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const { title, author, isbn, description, priceGhs, coverUrl, classId, termId } = req.body;
    if (!title || priceGhs == null) {
      return res.status(400).json({ message: 'title and priceGhs are required' });
    }
    if (!classId || !termId) {
      return res.status(400).json({ message: 'classId and termId are required' });
    }
    const price = parseFloat(priceGhs);
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ message: 'priceGhs must be a non-negative number' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const book = await tx.book.create({
        data: {
          title: String(title).trim(),
          author: author ? String(author).trim() : null,
          isbn: isbn ? String(isbn).trim() : null,
          description: description ? String(description).trim() : null,
          priceGhs: price,
          coverUrl: coverUrl || null,
          createdById: req.user.id,
        },
      });

      await syncBookClassAssignment(tx, book.id, classId, termId);

      const cls = await tx.class.findUnique({
        where: { id: classId },
        select: { id: true, name: true },
      });

      return { ...book, assignedClass: cls };
    });

    res.status(201).json(result);
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ message: err.message });
    next(err);
  }
});

// PUT /:id — update book
router.put('/:id', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, author, isbn, description, priceGhs, coverUrl, isActive, classId, termId } = req.body;

    const data = {};
    if (title != null) data.title = String(title).trim();
    if (author !== undefined) data.author = author ? String(author).trim() : null;
    if (isbn !== undefined) data.isbn = isbn ? String(isbn).trim() : null;
    if (description !== undefined) data.description = description ? String(description).trim() : null;
    if (coverUrl !== undefined) data.coverUrl = coverUrl || null;
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (priceGhs != null) {
      const price = parseFloat(priceGhs);
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ message: 'priceGhs must be a non-negative number' });
      }
      data.priceGhs = price;
    }

    const result = await prisma.$transaction(async (tx) => {
      const book = await tx.book.update({ where: { id }, data });

      let assignedClass = null;
      if (classId !== undefined && termId) {
        await syncBookClassAssignment(tx, id, classId, termId);
        assignedClass = await tx.class.findUnique({
          where: { id: classId },
          select: { id: true, name: true },
        });
      } else if (termId) {
        const row = await tx.bookAssignment.findFirst({
          where: { bookId: id, termId, studentId: null },
          include: { class: { select: { id: true, name: true } } },
        });
        assignedClass = row?.class ?? null;
      }

      return { ...book, assignedClass };
    });

    res.json(result);
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ message: err.message });
    if (err.code === 'P2025') return res.status(404).json({ message: 'Book not found' });
    next(err);
  }
});

// DELETE /:id — soft-delete
router.delete('/:id', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    await prisma.book.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ message: 'Book removed' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Book not found' });
    next(err);
  }
});

// POST /assign — assign book to class or student for a term
router.post('/assign', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const { bookId, classId, studentId, termId, isRequired } = req.body;
    if (!bookId || !termId) {
      return res.status(400).json({ message: 'bookId and termId are required' });
    }
    if (!classId && !studentId) {
      return res.status(400).json({ message: 'classId or studentId is required' });
    }

    const existing = await prisma.bookAssignment.findFirst({
      where: {
        bookId,
        termId,
        classId: classId || null,
        studentId: studentId || null,
      },
    });
    if (existing) {
      return res.status(400).json({ message: 'This book is already assigned for this target and term' });
    }

    const assignment = await prisma.bookAssignment.create({
      data: {
        bookId,
        classId: classId || null,
        studentId: studentId || null,
        termId,
        isRequired: isRequired !== false,
      },
      include: {
        book: true,
        class: { select: { id: true, name: true } },
        student: { select: { id: true, studentId: true, firstName: true, lastName: true } },
        term: { select: { id: true, name: true, year: true } },
      },
    });
    res.status(201).json(assignment);
  } catch (err) {
    next(err);
  }
});

// DELETE /assign/:id
router.delete('/assign/:id', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    await prisma.bookAssignment.delete({ where: { id: req.params.id } });
    res.json({ message: 'Assignment removed' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Assignment not found' });
    next(err);
  }
});

// GET /class/:classId — assignments + payment status for class in current or given term
router.get('/class/:classId', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const { classId } = req.params;
    const { termId: termIdQuery } = req.query;

    let termId = termIdQuery;
    if (!termId) {
      const current = await prisma.term.findFirst({ where: { isCurrent: true } });
      if (!current) return res.json({ term: null, assignments: [], students: [] });
      termId = current.id;
    }

    const term = await prisma.term.findUnique({ where: { id: termId } });
    const assignments = await prisma.bookAssignment.findMany({
      where: { classId, termId, studentId: null },
      include: { book: true },
      orderBy: { book: { title: 'asc' } },
    });

    const students = await prisma.student.findMany({
      where: { classId, isActive: true },
      select: { id: true, studentId: true, firstName: true, lastName: true },
      orderBy: { firstName: 'asc' },
    });

    const studentStatuses = [];
    for (const st of students) {
      const lines = await getStudentBookLines(prisma, st.id, termId);
      studentStatuses.push({
        student: st,
        books: lines.books,
        totalDue: lines.totalDue,
        totalPaid: lines.totalPaid,
        balance: lines.balance,
      });
    }

    res.json({ term, assignments, students: studentStatuses });
  } catch (err) {
    next(err);
  }
});

// GET /assignments — list assignments (optional filters)
router.get('/assignments/list', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const { termId, classId } = req.query;
    const where = {};
    if (termId) where.termId = termId;
    if (classId) where.classId = classId;

    const assignments = await prisma.bookAssignment.findMany({
      where,
      include: {
        book: true,
        class: { select: { id: true, name: true } },
        student: { select: { id: true, studentId: true, firstName: true, lastName: true } },
        term: { select: { id: true, name: true, year: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(assignments);
  } catch (err) {
    next(err);
  }
});

// POST /payments/manual — record cash/momo book payment (admin)
router.post('/payments/manual', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { studentId, bookId, termId, amountPaid, paymentMethod } = req.body;
    if (!studentId || !bookId || !termId || amountPaid == null) {
      return res.status(400).json({ message: 'studentId, bookId, termId, amountPaid are required' });
    }

    const amount = parseFloat(amountPaid);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'amountPaid must be positive' });
    }

    const payment = await prisma.bookPayment.upsert({
      where: {
        studentId_bookId_termId: { studentId, bookId, termId },
      },
      create: {
        studentId,
        bookId,
        termId,
        amountPaid: amount,
        paymentStatus: 'FULLY_PAID',
        paymentMethod: paymentMethod || 'cash',
        paidAt: new Date(),
      },
      update: {
        amountPaid: { increment: amount },
        paymentStatus: 'FULLY_PAID',
        paymentMethod: paymentMethod || 'cash',
        paidAt: new Date(),
      },
    });

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { firstName: true, lastName: true },
    });
    const studentName = student
      ? `${student.firstName} ${student.lastName}`.trim()
      : 'A student';
    notifyBookPaymentReceived({
      studentName,
      amountGhs: amount,
      method: paymentMethod || 'cash',
      excludeUserId: req.user?.id,
    }).catch((err) => console.error('Book payment notification failed:', err.message));

    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
