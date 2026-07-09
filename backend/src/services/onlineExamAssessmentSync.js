const prisma = require('../config/db');

/**
 * Ensure a term Assessment row exists for an online exam (shown under Examinations).
 */
async function ensureAssessmentForOnlineExam(examId) {
  const exam = await prisma.onlineExam.findUnique({ where: { id: examId } });
  if (!exam) return null;

  let assessment = await prisma.assessment.findUnique({
    where: { onlineExamId: examId },
  });

  if (!assessment) {
    assessment = await prisma.assessment.create({
      data: {
        name: exam.title,
        type: exam.assessmentType ?? 'EXAM',
        date: exam.startAt || exam.endAt || new Date(),
        totalMark: exam.totalMarks > 0 ? exam.totalMarks : 100,
        classId: exam.classId,
        subjectId: exam.subjectId,
        termId: exam.termId,
        createdById: exam.createdById,
        onlineExamId: examId,
      },
    });
    return assessment;
  }

  const scoreCount = await prisma.assessmentScore.count({
    where: { assessmentId: assessment.id },
  });

  if (scoreCount === 0) {
    assessment = await prisma.assessment.update({
      where: { id: assessment.id },
      data: {
        name: exam.title,
        type: exam.assessmentType ?? assessment.type,
        totalMark: exam.totalMarks > 0 ? exam.totalMarks : assessment.totalMark,
        date: exam.startAt || exam.endAt || assessment.date,
      },
    });
  }

  return assessment;
}

/**
 * Copy a graded online attempt score into assessment_scores.
 */
async function syncAttemptToAssessment(attemptId) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: { exam: true },
  });
  if (!attempt || attempt.status === 'IN_PROGRESS' || attempt.score == null) return null;

  const assessment = await ensureAssessmentForOnlineExam(attempt.examId);
  if (!assessment) return null;

  const score = Math.min(attempt.score, assessment.totalMark);

  await prisma.assessmentScore.upsert({
    where: {
      assessmentId_studentId: {
        assessmentId: assessment.id,
        studentId: attempt.studentId,
      },
    },
    create: {
      assessmentId: assessment.id,
      studentId: attempt.studentId,
      score,
    },
    update: { score },
  });

  return assessment;
}

/** Sync all submitted/graded attempts for one online exam. */
async function syncAllAttemptsForOnlineExam(examId) {
  const attempts = await prisma.examAttempt.findMany({
    where: {
      examId,
      status: { not: 'IN_PROGRESS' },
      score: { not: null },
    },
    select: { id: true },
  });

  for (const { id } of attempts) {
    await syncAttemptToAssessment(id);
  }
}

/** Ensure assessments exist for all published online exams in a class+term. */
async function ensureOnlineExamsSyncedForClass(classId, termId) {
  const exams = await prisma.onlineExam.findMany({
    where: {
      classId,
      termId,
      status: { in: ['PUBLISHED', 'CLOSED'] },
    },
    select: { id: true },
  });

  for (const { id } of exams) {
    await ensureAssessmentForOnlineExam(id);
    await syncAllAttemptsForOnlineExam(id);
  }
}

module.exports = {
  ensureAssessmentForOnlineExam,
  syncAttemptToAssessment,
  syncAllAttemptsForOnlineExam,
  ensureOnlineExamsSyncedForClass,
};
