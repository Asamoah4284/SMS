const prisma = require('../config/db');

function academicYearLabel(year) {
  if (!year) return '';
  return `${year}/${year + 1}`;
}

function formatLongDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

/**
 * Build report card payload for a student + term.
 * @param {string} studentId Internal student id (cuid)
 * @param {string} termId
 * @param {{ requirePublished?: boolean }} [opts]
 */
async function fetchReportCardData(studentId, termId, opts = {}) {
  const { requirePublished = false } = opts;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      class: {
        include: {
          classTeacher: {
            include: { user: { select: { firstName: true, lastName: true } } },
          },
        },
      },
      parent: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
    },
  });
  if (!student) return { ok: false, status: 404, message: 'Student not found' };

  const term = await prisma.term.findUnique({ where: { id: termId } });
  if (!term) return { ok: false, status: 404, message: 'Term not found' };

  if (requirePublished && student.classId) {
    const termResult = await prisma.termResult.findUnique({
      where: { classId_termId: { classId: student.classId, termId } },
    });
    if (!termResult?.isPublished) {
      return { ok: false, status: 403, message: 'Results not yet published' };
    }
  }

  const results = await prisma.result.findMany({
    where: { studentId, termId },
    include: { subject: { select: { id: true, name: true, code: true } } },
    orderBy: { subject: { name: 'asc' } },
  });

  const remarks = await prisma.termRemarks.findUnique({
    where: { studentId_termId: { studentId, termId } },
  });

  const attendance = await prisma.attendance.groupBy({
    by: ['status'],
    where: { studentId, termId },
    _count: { status: true },
  });
  const attSummary = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
  attendance.forEach((a) => {
    attSummary[a.status] = a._count.status;
  });

  const classSize = await prisma.student.count({
    where: { classId: student.classId, isActive: true },
  });

  const mappedResults = results.map((r) => ({
    subjectId: r.subjectId,
    subjectName: r.subject.name,
    subjectCode: r.subject.code,
    classScore: r.classScore,
    examScore: r.examScore,
    totalScore: r.totalScore,
    grade: r.grade,
    position: r.position,
    remarks: r.remarks,
  }));

  const classTotal = mappedResults.reduce((s, r) => s + (r.classScore ?? 0), 0);
  const examTotal = mappedResults.reduce((s, r) => s + (r.examScore ?? 0), 0);
  const grandTotal = mappedResults.reduce((s, r) => s + (r.totalScore ?? 0), 0);

  const scores = mappedResults.map((r) => r.totalScore).filter((s) => s !== null);
  const average = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
    : null;
  const isJHS = student.class?.level?.startsWith('JHS');
  let aggregate = null;
  if (isJHS) {
    const positions = mappedResults
      .map((r) => r.position)
      .filter((p) => p !== null)
      .sort((a, b) => a - b);
    aggregate = positions.slice(0, 6).reduce((s, p) => s + p, 0);
  }

  const isPromoted = results.some((r) => r.isPromoted);
  const daysPresent = attSummary.PRESENT + attSummary.LATE;
  const totalDays = Object.values(attSummary).reduce((a, b) => a + b, 0);

  return {
    ok: true,
    data: {
      student: {
        id: student.id,
        studentId: student.studentId,
        name: `${student.firstName} ${student.lastName}`.trim(),
        gender: student.gender,
        className: student.class?.name ?? null,
        classTeacher: student.class?.classTeacher
          ? `${student.class.classTeacher.user.firstName} ${student.class.classTeacher.user.lastName}`
          : null,
        parentName: student.parent
          ? `${student.parent.user.firstName} ${student.parent.user.lastName}`
          : student.parentName,
        classSize,
        photo: student.photo,
      },
      term: {
        id: term.id,
        name: term.name,
        year: term.year,
        academicYear: academicYearLabel(term.year),
        vacationDate: formatLongDate(term.endDate),
        endDate: term.endDate,
      },
      results: mappedResults,
      totals: { classScore: classTotal, examScore: examTotal, totalScore: grandTotal },
      average,
      aggregate,
      isPromoted,
      attendance: attSummary,
      daysPresent,
      totalDays,
      teacherRemarks: remarks?.teacherRemarks ?? null,
      headmasterRemarks: remarks?.headmasterRemarks ?? null,
      conduct: remarks?.conduct ?? null,
      interest: remarks?.interest ?? null,
      nextTermBegins: remarks?.nextTermBegins ?? null,
      nextTermBeginsLabel: formatLongDate(remarks?.nextTermBegins),
    },
  };
}

module.exports = { fetchReportCardData, academicYearLabel, formatLongDate };
