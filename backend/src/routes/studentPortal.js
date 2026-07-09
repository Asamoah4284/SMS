const { Router } = require('express');
const prisma = require('../config/db');
const { authenticateStudent } = require('../middleware/studentPortalAuth');
const { autoGradeAttempt } = require('../services/examGrading');

const router = Router();
router.use(authenticateStudent);

function examIsAvailable(exam, now = new Date()) {
  if (exam.status !== 'PUBLISHED') return false;
  if (exam.startAt && now < new Date(exam.startAt)) return false;
  if (exam.endAt && now > new Date(exam.endAt)) return false;
  return true;
}

function stripCorrectAnswers(exam) {
  const { attempts: _attempts, ...rest } = exam;
  return {
    ...rest,
    questions: (exam.questions || []).map((q) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      marks: q.marks,
      order: q.order,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
    })),
  };
}

/** Students only see scores after staff releases results and attempt is fully graded. */
function studentVisibleScore(attempt, exam) {
  if (!exam?.resultsReleased) return null;
  if (!attempt || attempt.status !== 'GRADED') return null;
  return attempt.score;
}

// GET /dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.studentDbId },
      include: {
        class: { select: { id: true, name: true } },
        examAttempts: {
          include: {
            exam: {
              select: {
                id: true,
                title: true,
                totalMarks: true,
                resultsReleased: true,
                subject: { select: { name: true } },
                term: { select: { name: true, year: true } },
              },
            },
          },
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const now = new Date();
    const availableExams = student.classId
      ? await prisma.onlineExam.findMany({
          where: {
            classId: student.classId,
            status: 'PUBLISHED',
          },
          include: {
            subject: { select: { name: true } },
            term: { select: { name: true, year: true } },
            attempts: { where: { studentId: student.id }, select: { id: true, status: true } },
          },
          orderBy: { startAt: 'asc' },
        })
      : [];

    const exams = availableExams
      .filter((e) => examIsAvailable(e, now))
      .map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        durationMinutes: e.durationMinutes,
        startAt: e.startAt,
        endAt: e.endAt,
        totalMarks: e.totalMarks,
        subject: e.subject.name,
        term: `${e.term.name} ${e.term.year}`,
        hasAttempt: e.attempts.length > 0,
        attemptStatus: e.attempts[0]?.status ?? null,
        resultsReleased: e.resultsReleased,
      }));

    res.json({
      student: {
        studentId: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        class: student.class,
      },
      availableExams: exams,
      recentAttempts: student.examAttempts
        .filter((a) => a.status !== 'IN_PROGRESS')
        .map((a) => ({
          id: a.id,
          examId: a.exam.id,
          title: a.exam.title,
          subject: a.exam.subject.name,
          term: `${a.exam.term.name} ${a.exam.term.year}`,
          score: studentVisibleScore(a, a.exam),
          totalMarks: a.exam.totalMarks,
          status: a.status,
          submittedAt: a.submittedAt,
          resultsReleased: a.exam.resultsReleased,
        })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /exams — list available exams
router.get('/exams', async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.studentDbId },
      select: { classId: true },
    });
    if (!student?.classId) return res.json([]);

    const exams = await prisma.onlineExam.findMany({
      where: { classId: student.classId, status: 'PUBLISHED' },
      include: {
        subject: { select: { name: true } },
        term: { select: { name: true, year: true } },
        attempts: { where: { studentId: req.studentDbId } },
      },
      orderBy: { startAt: 'asc' },
    });

    const now = new Date();
    res.json(
      exams
        .filter((e) => examIsAvailable(e, now))
        .map((e) => ({
          id: e.id,
          title: e.title,
          description: e.description,
          instructions: e.instructions,
          durationMinutes: e.durationMinutes,
          startAt: e.startAt,
          endAt: e.endAt,
          totalMarks: e.totalMarks,
          subject: e.subject.name,
          term: `${e.term.name} ${e.term.year}`,
          attempt: e.attempts[0] ?? null,
        }))
    );
  } catch (err) {
    next(err);
  }
});

// GET /exams/:id — exam for taking (no correct answers)
router.get('/exams/:id', async (req, res, next) => {
  try {
    const exam = await prisma.onlineExam.findUnique({
      where: { id: req.params.id },
      include: {
        subject: { select: { name: true } },
        questions: { orderBy: { order: 'asc' }, include: { options: true } },
        attempts: { where: { studentId: req.studentDbId } },
      },
    });
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    const student = await prisma.student.findUnique({
      where: { id: req.studentDbId },
      select: { classId: true },
    });
    if (exam.classId !== student?.classId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const attempt = exam.attempts[0];
    const payload = stripCorrectAnswers(exam);
    res.json({
      ...payload,
      subject: exam.subject.name,
      attempt: attempt
        ? {
            id: attempt.id,
            status: attempt.status,
            startedAt: attempt.startedAt,
            submittedAt: attempt.submittedAt,
            score: studentVisibleScore(attempt, exam),
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

// POST /exams/:id/start
router.post('/exams/:id/start', async (req, res, next) => {
  try {
    const exam = await prisma.onlineExam.findUnique({
      where: { id: req.params.id },
      include: { questions: true },
    });
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (!examIsAvailable(exam)) {
      return res.status(400).json({ error: 'Exam is not available' });
    }

    const student = await prisma.student.findUnique({
      where: { id: req.studentDbId },
      select: { classId: true },
    });
    if (exam.classId !== student?.classId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const existing = await prisma.examAttempt.findUnique({
      where: { examId_studentId: { examId: exam.id, studentId: req.studentDbId } },
    });
    if (existing) {
      return res.json({
        attemptId: existing.id,
        startedAt: existing.startedAt,
        durationMinutes: exam.durationMinutes,
        status: existing.status,
      });
    }

    const attempt = await prisma.examAttempt.create({
      data: {
        examId: exam.id,
        studentId: req.studentDbId,
        status: 'IN_PROGRESS',
      },
    });

    res.status(201).json({
      attemptId: attempt.id,
      startedAt: attempt.startedAt,
      durationMinutes: exam.durationMinutes,
      status: attempt.status,
    });
  } catch (err) {
    next(err);
  }
});

// POST /exams/:id/submit
router.post('/exams/:id/submit', async (req, res, next) => {
  try {
    const { answers } = req.body;
    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: 'answers array is required' });
    }

    const exam = await prisma.onlineExam.findUnique({
      where: { id: req.params.id },
      include: { questions: true },
    });
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    const attempt = await prisma.examAttempt.findUnique({
      where: { examId_studentId: { examId: exam.id, studentId: req.studentDbId } },
    });
    if (!attempt) return res.status(400).json({ error: 'Exam not started' });
    if (attempt.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Exam already submitted' });
    }

    const now = new Date();
    const deadline = new Date(attempt.startedAt.getTime() + exam.durationMinutes * 60 * 1000);
    if (now > deadline && exam.endAt && now > new Date(exam.endAt)) {
      return res.status(400).json({ error: 'Exam window has closed' });
    }

    await prisma.$transaction(async (tx) => {
      for (const ans of answers) {
        const { questionId, selectedOptionIds, textAnswer } = ans;
        if (!questionId) continue;

        await tx.examAnswer.upsert({
          where: {
            attemptId_questionId: {
              attemptId: attempt.id,
              questionId,
            },
          },
          create: {
            attemptId: attempt.id,
            questionId,
            selectedOptionIds: selectedOptionIds || [],
            textAnswer: textAnswer ? String(textAnswer) : null,
          },
          update: {
            selectedOptionIds: selectedOptionIds || [],
            textAnswer: textAnswer ? String(textAnswer) : null,
          },
        });
      }

      await tx.examAttempt.update({
        where: { id: attempt.id },
        data: { submittedAt: now, status: 'SUBMITTED' },
      });
    });

    await autoGradeAttempt(attempt.id);
    const updated = await prisma.examAttempt.findUnique({ where: { id: attempt.id } });

    res.json({
      attemptId: attempt.id,
      status: updated.status,
      message: 'Your answers have been submitted. Your teacher will release results when ready.',
    });
  } catch (err) {
    next(err);
  }
});

// GET /exams/:id/result — view own result
router.get('/exams/:id/result', async (req, res, next) => {
  try {
    const attempt = await prisma.examAttempt.findUnique({
      where: {
        examId_studentId: { examId: req.params.id, studentId: req.studentDbId },
      },
      include: {
        exam: {
          include: {
            subject: { select: { name: true } },
            questions: { orderBy: { order: 'asc' }, include: { options: true } },
          },
        },
        answers: true,
      },
    });
    if (!attempt) return res.status(404).json({ error: 'No attempt found' });
    if (attempt.status === 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Exam not yet submitted' });
    }

    const details = attempt.exam.questions.map((q) => {
      const answer = attempt.answers.find((a) => a.questionId === q.id);
      return {
        questionId: q.id,
        text: q.text,
        type: q.type,
        marks: q.marks,
        marksAwarded: answer?.marksAwarded ?? null,
        feedback: answer?.feedback ?? null,
        selectedOptionIds: answer?.selectedOptionIds ?? [],
        textAnswer: answer?.textAnswer ?? null,
      };
    });

    res.json({
      exam: {
        id: attempt.exam.id,
        title: attempt.exam.title,
        subject: attempt.exam.subject.name,
        totalMarks: attempt.exam.totalMarks,
        resultsReleased: attempt.exam.resultsReleased,
      },
      attempt: {
        id: attempt.id,
        status: attempt.status,
        score: studentVisibleScore(attempt, attempt.exam),
        submittedAt: attempt.submittedAt,
      },
      questions: attempt.exam.resultsReleased && attempt.status === 'GRADED'
        ? details
        : details.map((q) => ({
            questionId: q.questionId,
            text: q.text,
            type: q.type,
            marks: q.marks,
            marksAwarded: null,
            feedback: null,
            selectedOptionIds: [],
            textAnswer: null,
          })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
