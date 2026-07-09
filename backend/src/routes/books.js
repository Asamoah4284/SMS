const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../config/db');
const { getStudentBookLines } = require('../utils/studentBooks');

const router = Router();
router.use(authenticate);

// GET / — list all books in catalog
router.get('/', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const books = await prisma.book.findMany({
      where: { isActive: true },
      orderBy: { title: 'asc' },
      include: {
        _count: { select: { assignments: true, payments: true } },
      },
    });
    res.json(books);
  } catch (err) {
    next(err);
  }
});

// POST / — create book
router.post('/', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const { title, author, isbn, description, priceGhs, coverUrl } = req.body;
    if (!title || priceGhs == null) {
      return res.status(400).json({ message: 'title and priceGhs are required' });
    }
    const price = parseFloat(priceGhs);
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ message: 'priceGhs must be a non-negative number' });
    }

    const book = await prisma.book.create({
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
    res.status(201).json(book);
  } catch (err) {
    next(err);
  }
});

// PUT /:id — update book
router.put('/:id', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, author, isbn, description, priceGhs, coverUrl, isActive } = req.body;

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

    const book = await prisma.book.update({ where: { id }, data });
    res.json(book);
  } catch (err) {
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
    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
