const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../config/db');
const { recalculateAttemptScore } = require('../services/examGrading');

const router = Router();
router.use(authenticate);

function computeTotalMarks(questions) {
  return questions.reduce((sum, q) => sum + (q.marks || 0), 0);
}

// GET / — list online exams (filter by classId, termId, status)
router.get('/', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const { classId, termId, status } = req.query;
    const where = {};
    if (classId) where.classId = classId;
    if (termId) where.termId = termId;
    if (status) where.status = status;

    const exams = await prisma.onlineExam.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        term: { select: { id: true, name: true, year: true } },
        _count: { select: { questions: true, attempts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(exams);
  } catch (err) {
    next(err);
  }
});

// GET /:id — exam detail with questions (teacher view includes correct answers)
router.get('/:id', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const exam = await prisma.onlineExam.findUnique({
      where: { id: req.params.id },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        term: { select: { id: true, name: true, year: true } },
        questions: {
          orderBy: { order: 'asc' },
          include: { options: { orderBy: { id: 'asc' } } },
        },
        attempts: {
          include: {
            student: { select: { id: true, studentId: true, firstName: true, lastName: true } },
          },
          orderBy: { startedAt: 'desc' },
        },
      },
    });
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    res.json(exam);
  } catch (err) {
    next(err);
  }
});

// POST / — create exam
router.post('/', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const {
      title,
      description,
      instructions,
      durationMinutes,
      startAt,
      endAt,
      classId,
      subjectId,
      termId,
    } = req.body;

    if (!title || !durationMinutes || !classId || !subjectId || !termId) {
      return res.status(400).json({
        message: 'title, durationMinutes, classId, subjectId, termId are required',
      });
    }

    const exam = await prisma.onlineExam.create({
      data: {
        title: String(title).trim(),
        description: description ? String(description).trim() : null,
        instructions: instructions ? String(instructions).trim() : null,
        durationMinutes: parseInt(durationMinutes, 10),
        startAt: startAt ? new Date(startAt) : null,
        endAt: endAt ? new Date(endAt) : null,
        classId,
        subjectId,
        termId,
        createdById: req.user.id,
        status: 'DRAFT',
      },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        term: { select: { id: true, name: true, year: true } },
      },
    });
    res.status(201).json(exam);
  } catch (err) {
    next(err);
  }
});

// PUT /:id — update exam metadata
router.put('/:id', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const {
      title,
      description,
      instructions,
      durationMinutes,
      startAt,
      endAt,
      status,
    } = req.body;

    const data = {};
    if (title != null) data.title = String(title).trim();
    if (description !== undefined) data.description = description ? String(description).trim() : null;
    if (instructions !== undefined) data.instructions = instructions ? String(instructions).trim() : null;
    if (durationMinutes != null) data.durationMinutes = parseInt(durationMinutes, 10);
    if (startAt !== undefined) data.startAt = startAt ? new Date(startAt) : null;
    if (endAt !== undefined) data.endAt = endAt ? new Date(endAt) : null;
    if (status != null) data.status = status;

    const exam = await prisma.onlineExam.update({
      where: { id: req.params.id },
      data,
    });
    res.json(exam);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Exam not found' });
    next(err);
  }
});

// DELETE /:id
router.delete('/:id', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    await prisma.onlineExam.delete({ where: { id: req.params.id } });
    res.json({ message: 'Exam deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Exam not found' });
    next(err);
  }
});

// POST /:id/questions — add question with options
router.post('/:id/questions', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const { type, text, marks, order, modelAnswer, options } = req.body;
    if (!type || !text || marks == null) {
      return res.status(400).json({ message: 'type, text, marks are required' });
    }

    const exam = await prisma.onlineExam.findUnique({
      where: { id: req.params.id },
      include: { questions: true },
    });
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    if (exam.status === 'CLOSED') {
      return res.status(400).json({ message: 'Cannot edit a closed exam' });
    }

    const questionOrder = order != null ? parseInt(order, 10) : exam.questions.length;

    const question = await prisma.$transaction(async (tx) => {
      const q = await tx.examQuestion.create({
        data: {
          examId: exam.id,
          type,
          text: String(text).trim(),
          marks: parseFloat(marks),
          order: questionOrder,
          modelAnswer: modelAnswer ? String(modelAnswer).trim() : null,
        },
      });

      if (options && Array.isArray(options) && options.length > 0) {
        await tx.examOption.createMany({
          data: options.map((o) => ({
            questionId: q.id,
            text: String(o.text).trim(),
            isCorrect: Boolean(o.isCorrect),
          })),
        });
      } else if (type === 'TRUE_FALSE') {
        await tx.examOption.createMany({
          data: [
            { questionId: q.id, text: 'True', isCorrect: options?.[0]?.isCorrect ?? true },
            { questionId: q.id, text: 'False', isCorrect: options?.[1]?.isCorrect ?? false },
          ],
        });
      }

      const allQuestions = await tx.examQuestion.findMany({ where: { examId: exam.id } });
      const totalMarks = computeTotalMarks(allQuestions);
      await tx.onlineExam.update({
        where: { id: exam.id },
        data: { totalMarks },
      });

      return tx.examQuestion.findUnique({
        where: { id: q.id },
        include: { options: true },
      });
    });

    res.status(201).json(question);
  } catch (err) {
    next(err);
  }
});

// PUT /:examId/questions/:questionId
router.put('/:examId/questions/:questionId', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const { type, text, marks, order, modelAnswer, options } = req.body;

    const question = await prisma.$transaction(async (tx) => {
      const data = {};
      if (type != null) data.type = type;
      if (text != null) data.text = String(text).trim();
      if (marks != null) data.marks = parseFloat(marks);
      if (order != null) data.order = parseInt(order, 10);
      if (modelAnswer !== undefined) data.modelAnswer = modelAnswer ? String(modelAnswer).trim() : null;

      const q = await tx.examQuestion.update({
        where: { id: req.params.questionId },
        data,
      });

      if (options && Array.isArray(options)) {
        await tx.examOption.deleteMany({ where: { questionId: q.id } });
        if (options.length > 0) {
          await tx.examOption.createMany({
            data: options.map((o) => ({
              questionId: q.id,
              text: String(o.text).trim(),
              isCorrect: Boolean(o.isCorrect),
            })),
          });
        }
      }

      const allQuestions = await tx.examQuestion.findMany({ where: { examId: req.params.examId } });
      await tx.onlineExam.update({
        where: { id: req.params.examId },
        data: { totalMarks: computeTotalMarks(allQuestions) },
      });

      return tx.examQuestion.findUnique({
        where: { id: q.id },
        include: { options: true },
      });
    });

    res.json(question);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Question not found' });
    next(err);
  }
});

// DELETE /:examId/questions/:questionId
router.delete('/:examId/questions/:questionId', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.examQuestion.delete({ where: { id: req.params.questionId } });
      const allQuestions = await tx.examQuestion.findMany({ where: { examId: req.params.examId } });
      await tx.onlineExam.update({
        where: { id: req.params.examId },
        data: { totalMarks: computeTotalMarks(allQuestions) },
      });
    });
    res.json({ message: 'Question deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Question not found' });
    next(err);
  }
});

// POST /:id/publish
router.post('/:id/publish', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const exam = await prisma.onlineExam.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { questions: true } } },
    });
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    if (exam._count.questions === 0) {
      return res.status(400).json({ message: 'Add at least one question before publishing' });
    }

    const updated = await prisma.onlineExam.update({
      where: { id: req.params.id },
      data: { status: 'PUBLISHED' },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /:id/close
router.post('/:id/close', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const updated = await prisma.onlineExam.update({
      where: { id: req.params.id },
      data: { status: 'CLOSED' },
    });
    res.json(updated);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Exam not found' });
    next(err);
  }
});

// GET /:id/results — all attempts with answers
router.get('/:id/results', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const exam = await prisma.onlineExam.findUnique({
      where: { id: req.params.id },
      include: {
        questions: { orderBy: { order: 'asc' }, include: { options: true } },
        attempts: {
          include: {
            student: { select: { id: true, studentId: true, firstName: true, lastName: true } },
            answers: true,
          },
          orderBy: [{ score: 'desc' }, { submittedAt: 'asc' }],
        },
      },
    });
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    const pendingManual = exam.attempts.filter((a) =>
      a.answers.some((ans) => {
        const q = exam.questions.find((qq) => qq.id === ans.questionId);
        return q?.type === 'THEORY' && ans.marksAwarded == null && ans.textAnswer;
      })
    ).length;

    res.json({ exam, pendingManualCount: pendingManual });
  } catch (err) {
    next(err);
  }
});

// PUT /:examId/attempts/:attemptId/grade — manual grade theory answer
router.put('/:examId/attempts/:attemptId/grade', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const { answers } = req.body;
    if (!Array.isArray(answers)) {
      return res.status(400).json({ message: 'answers array is required' });
    }

    for (const item of answers) {
      const { questionId, marksAwarded, feedback } = item;
      if (!questionId || marksAwarded == null) continue;

      await prisma.examAnswer.updateMany({
        where: {
          attemptId: req.params.attemptId,
          questionId,
        },
        data: {
          marksAwarded: parseFloat(marksAwarded),
          feedback: feedback ? String(feedback).trim() : null,
          gradedById: req.user.id,
        },
      });
    }

    const result = await recalculateAttemptScore(req.params.attemptId);
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: req.params.attemptId },
      include: {
        student: { select: { id: true, studentId: true, firstName: true, lastName: true } },
        answers: true,
      },
    });

    res.json({ attempt, grading: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
