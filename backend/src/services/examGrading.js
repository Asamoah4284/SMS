const prisma = require('../config/db');
const { syncAttemptToAssessment } = require('./onlineExamAssessmentSync');

function normalizeFillAnswer(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Accept model answers separated by | , or ; */
function fillInBlankMatches(studentAnswer, modelAnswer) {
  if (!modelAnswer) return false;
  const normalized = normalizeFillAnswer(studentAnswer);
  if (!normalized) return false;
  const acceptable = modelAnswer
    .split(/[|,;]/)
    .map(normalizeFillAnswer)
    .filter(Boolean);
  return acceptable.includes(normalized);
}

/**
 * Grade objective answers for an attempt. Theory questions stay null until manually graded.
 */
async function autoGradeAttempt(attemptId) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: { include: { questions: { include: { options: true } } } },
      answers: true,
    },
  });
  if (!attempt) return null;

  let totalScore = 0;
  let hasTheoryPending = false;

  for (const question of attempt.exam.questions) {
    const answer = attempt.answers.find((a) => a.questionId === question.id);
    if (!answer) continue;

    if (question.type === 'THEORY') {
      hasTheoryPending = true;
      continue;
    }

    if (question.type === 'FILL_IN_BLANK') {
      const marks = fillInBlankMatches(answer.textAnswer, question.modelAnswer)
        ? question.marks
        : 0;
      await prisma.examAnswer.update({
        where: { id: answer.id },
        data: { marksAwarded: marks },
      });
      totalScore += marks;
      continue;
    }

    const correctIds = question.options.filter((o) => o.isCorrect).map((o) => o.id).sort();
    const selected = [...(answer.selectedOptionIds || [])].sort();
    let marks = 0;

    if (question.type === 'MCQ_SINGLE' || question.type === 'TRUE_FALSE') {
      if (selected.length === 1 && correctIds.length === 1 && selected[0] === correctIds[0]) {
        marks = question.marks;
      }
    } else if (question.type === 'MCQ_MULTIPLE') {
      const match =
        selected.length === correctIds.length &&
        selected.every((id, i) => id === correctIds[i]);
      if (match) marks = question.marks;
    }

    await prisma.examAnswer.update({
      where: { id: answer.id },
      data: { marksAwarded: marks },
    });
    totalScore += marks;
  }

  const theoryQuestions = attempt.exam.questions.filter((q) => q.type === 'THEORY');
  for (const q of theoryQuestions) {
    const answer = attempt.answers.find((a) => a.questionId === q.id);
    if (answer?.marksAwarded != null) {
      totalScore += answer.marksAwarded;
    }
  }

  const allTheoryGraded = theoryQuestions.every((q) => {
    const answer = attempt.answers.find((a) => a.questionId === q.id);
    return answer && answer.marksAwarded != null;
  });

  const status = hasTheoryPending && !allTheoryGraded ? 'SUBMITTED' : 'GRADED';

  await prisma.examAttempt.update({
    where: { id: attemptId },
    data: {
      score: totalScore,
      status,
      submittedAt: attempt.submittedAt || new Date(),
    },
  });

  if (status !== 'IN_PROGRESS') {
    await syncAttemptToAssessment(attemptId);
  }

  return { totalScore, status };
}

/**
 * Recalculate attempt score after manual theory grading.
 */
async function recalculateAttemptScore(attemptId) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: { include: { questions: true } },
      answers: true,
    },
  });
  if (!attempt) return null;

  let totalScore = 0;
  let pendingTheory = false;

  for (const question of attempt.exam.questions) {
    const answer = attempt.answers.find((a) => a.questionId === question.id);
    if (!answer) {
      if (question.type === 'THEORY') pendingTheory = true;
      continue;
    }
    if (answer.marksAwarded == null) {
      if (question.type === 'THEORY') pendingTheory = true;
      continue;
    }
    totalScore += answer.marksAwarded;
  }

  const status = pendingTheory ? 'SUBMITTED' : 'GRADED';

  await prisma.examAttempt.update({
    where: { id: attemptId },
    data: { score: totalScore, status },
  });

  if (status !== 'IN_PROGRESS') {
    await syncAttemptToAssessment(attemptId);
  }

  return { totalScore, status };
}

module.exports = { autoGradeAttempt, recalculateAttemptScore };
