const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../config/db');

const router = Router();
router.use(authenticate);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** GES grading scale */
function gesGrade(score) {
  if (score >= 80) return { grade: 'A1', remark: 'Excellent' };
  if (score >= 70) return { grade: 'B2', remark: 'Very Good' };
  if (score >= 65) return { grade: 'B3', remark: 'Good' };
  if (score >= 60) return { grade: 'C4', remark: 'Credit' };
  if (score >= 55) return { grade: 'C5', remark: 'Credit' };
  if (score >= 50) return { grade: 'C6', remark: 'Credit' };
  if (score >= 45) return { grade: 'D7', remark: 'Pass' };
  if (score >= 40) return { grade: 'E8', remark: 'Pass' };
  return { grade: 'F9', remark: 'Fail' };
}

/** Standard ranking: ties share rank, next rank skips (1,2,2,4) */
function assignPositions(items, scoreKey) {
  const sorted = [...items].sort((a, b) => b[scoreKey] - a[scoreKey]);
  let pos = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i][scoreKey] < sorted[i - 1][scoreKey]) {
      pos = i + 1;
    }
    sorted[i]._position = pos;
  }
  return sorted;
}

// ─── GET /results/status ─────────────────────────────────────────────────────
// Query: ?termId=
// Returns publish status for each class in the term
router.get('/status', async (req, res) => {
  try {
    const { termId } = req.query;
    if (!termId) return res.status(400).json({ message: 'termId is required' });

    const termResults = await prisma.termResult.findMany({
      where: { termId },
      select: { classId: true, isPublished: true, publishedAt: true },
    });

    res.json({ statuses: termResults });
  } catch (err) {
    console.error('GET /results/status', err);
    res.status(500).json({ message: 'Failed to fetch result statuses' });
  }
});

// ─── GET /results/assessments ─────────────────────────────────────────────────
// Query: ?classId=&termId=
// Returns assessments grouped by subject, with score counts
router.get('/assessments', async (req, res) => {
  try {
    const { classId, termId } = req.query;
    if (!classId || !termId) {
      return res.status(400).json({ message: 'classId and termId are required' });
    }

    // Teachers can only view their own class
    if (req.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: req.user.id, classTeacherOf: { id: classId } },
      });
      if (!teacher) return res.status(403).json({ message: 'You can only view your own class' });
    }

    const assessments = await prisma.assessment.findMany({
      where: { classId, termId },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        _count: { select: { scores: true } },
      },
      orderBy: [{ subject: { name: 'asc' } }, { createdAt: 'asc' }],
    });

    // Get student count for the class
    const studentCount = await prisma.student.count({ where: { classId, isActive: true } });

    res.json({ assessments, studentCount });
  } catch (err) {
    console.error('GET /results/assessments', err);
    res.status(500).json({ message: 'Failed to fetch assessments' });
  }
});

// ─── POST /results/assessments ────────────────────────────────────────────────
// Class teacher creates a new assessment
router.post('/assessments', async (req, res) => {
  try {
    if (req.user.role === 'PARENT') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { name, type, date, totalMark, classId, subjectId, termId } = req.body;
    if (!name || !type || !totalMark || !classId || !subjectId || !termId) {
      return res.status(400).json({ message: 'name, type, totalMark, classId, subjectId, and termId are required' });
    }
    if (!['TEST', 'EXAM'].includes(type)) {
      return res.status(400).json({ message: 'type must be TEST or EXAM' });
    }

    // Teachers can only add to their own class
    if (req.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: req.user.id, classTeacherOf: { id: classId } },
      });
      if (!teacher) return res.status(403).json({ message: 'You can only create assessments for your own class' });
    }

    const assessment = await prisma.assessment.create({
      data: {
        name,
        type,
        date: date ? new Date(date) : null,
        totalMark: parseFloat(totalMark),
        classId,
        subjectId,
        termId,
        createdById: req.user.id,
      },
      include: { subject: { select: { id: true, name: true, code: true } } },
    });

    res.status(201).json({ message: 'Assessment created', assessment });
  } catch (err) {
    console.error('POST /results/assessments', err);
    res.status(500).json({ message: 'Failed to create assessment' });
  }
});

// ─── PUT /results/assessments/:id ─────────────────────────────────────────────
// Update assessment metadata; blocks totalMark change if scores already entered
router.put('/assessments/:id', async (req, res) => {
  try {
    if (req.user.role === 'PARENT') return res.status(403).json({ message: 'Access denied' });

    const existing = await prisma.assessment.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { scores: true } } },
    });
    if (!existing) return res.status(404).json({ message: 'Assessment not found' });

    const { name, type, date, totalMark } = req.body;

    if (totalMark !== undefined && parseFloat(totalMark) !== existing.totalMark) {
      if (existing._count.scores > 0) {
        return res.status(400).json({
          message: 'Cannot change total mark after scores have been entered. Delete all scores first.',
        });
      }
    }

    const updated = await prisma.assessment.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        date: date !== undefined ? (date ? new Date(date) : null) : undefined,
        ...(totalMark !== undefined && { totalMark: parseFloat(totalMark) }),
      },
      include: { subject: { select: { id: true, name: true, code: true } } },
    });

    res.json({ message: 'Assessment updated', assessment: updated });
  } catch (err) {
    console.error('PUT /results/assessments/:id', err);
    res.status(500).json({ message: 'Failed to update assessment' });
  }
});

// ─── DELETE /results/assessments/:id ──────────────────────────────────────────
router.delete('/assessments/:id', async (req, res) => {
  try {
    if (req.user.role === 'PARENT') return res.status(403).json({ message: 'Access denied' });

    const existing = await prisma.assessment.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { scores: true } } },
    });
    if (!existing) return res.status(404).json({ message: 'Assessment not found' });

    if (existing._count.scores > 0) {
      return res.status(400).json({
        message: 'Cannot delete assessment with existing scores. Remove scores first.',
      });
    }

    await prisma.assessment.delete({ where: { id: req.params.id } });
    res.json({ message: 'Assessment deleted' });
  } catch (err) {
    console.error('DELETE /results/assessments/:id', err);
    res.status(500).json({ message: 'Failed to delete assessment' });
  }
});

// ─── GET /results/assessments/:id/scores ──────────────────────────────────────
// Returns all students in the class with their score for this assessment
router.get('/assessments/:id/scores', async (req, res) => {
  try {
    const assessment = await prisma.assessment.findUnique({
      where: { id: req.params.id },
      include: {
        subject: { select: { id: true, name: true } },
        scores: { include: { student: { select: { id: true, firstName: true, lastName: true, studentId: true } } } },
        class: { include: { students: { where: { isActive: true }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], select: { id: true, firstName: true, lastName: true, studentId: true } } } },
      },
    });
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    // Teachers: only their class
    if (req.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: req.user.id, classTeacherOf: { id: assessment.classId } },
      });
      if (!teacher) return res.status(403).json({ message: 'Access denied' });
    }

    const scoreMap = {};
    assessment.scores.forEach((s) => { scoreMap[s.studentId] = s; });

    const students = assessment.class.students.map((st) => {
      const record = scoreMap[st.id];
      return {
        id: st.id,
        studentId: st.studentId,
        name: `${st.firstName} ${st.lastName}`,
        score: record?.score ?? null,   // null = absent
        scoreId: record?.id ?? null,
      };
    });

    res.json({
      assessment: {
        id: assessment.id,
        name: assessment.name,
        type: assessment.type,
        totalMark: assessment.totalMark,
        date: assessment.date,
        subject: assessment.subject,
        classId: assessment.classId,
        termId: assessment.termId,
      },
      students,
    });
  } catch (err) {
    console.error('GET /results/assessments/:id/scores', err);
    res.status(500).json({ message: 'Failed to fetch scores' });
  }
});

// ─── POST /results/assessments/:id/scores ─────────────────────────────────────
// Body: { scores: [{ studentId, score }] }  — score=null means absent
router.post('/assessments/:id/scores', async (req, res) => {
  try {
    if (req.user.role === 'PARENT') return res.status(403).json({ message: 'Access denied' });

    const assessment = await prisma.assessment.findUnique({ where: { id: req.params.id } });
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    // Teachers: only their class
    if (req.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: req.user.id, classTeacherOf: { id: assessment.classId } },
      });
      if (!teacher) return res.status(403).json({ message: 'Access denied' });
    }

    const { scores } = req.body;
    if (!Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({ message: 'scores array is required' });
    }

    // Validate scores don't exceed totalMark
    for (const s of scores) {
      if (s.score !== null && s.score !== undefined) {
        const val = parseFloat(s.score);
        if (isNaN(val) || val < 0 || val > assessment.totalMark) {
          return res.status(400).json({
            message: `Score ${val} exceeds total mark of ${assessment.totalMark} for this assessment`,
          });
        }
      }
    }

    const upserts = scores.map((s) =>
      prisma.assessmentScore.upsert({
        where: { assessmentId_studentId: { assessmentId: assessment.id, studentId: s.studentId } },
        create: { assessmentId: assessment.id, studentId: s.studentId, score: s.score ?? null },
        update: { score: s.score ?? null },
      })
    );
    await prisma.$transaction(upserts);

    res.json({ message: 'Scores saved', count: scores.length });
  } catch (err) {
    console.error('POST /results/assessments/:id/scores', err);
    res.status(500).json({ message: 'Failed to save scores' });
  }
});

// ─── GET /results/config/:classId/:termId ─────────────────────────────────────
// Returns TermResult config (components + weights) for a class+term, if it exists
router.get('/config/:classId/:termId', async (req, res) => {
  try {
    const { classId, termId } = req.params;

    const config = await prisma.termResult.findUnique({
      where: { classId_termId: { classId, termId } },
      include: {
        components: {
          include: {
            assessment: {
              include: { subject: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    res.json({ config }); // null if not yet configured
  } catch (err) {
    console.error('GET /results/config', err);
    res.status(500).json({ message: 'Failed to fetch result config' });
  }
});

// ─── POST /results/generate ───────────────────────────────────────────────────
// Body: { classId, termId, components: [{ assessmentId, weight }] }
// components must be grouped by subject; weights per subject must sum to 100
// Creates/updates TermResult + generates Result records for all students
router.post('/generate', async (req, res) => {
  try {
    if (req.user.role === 'PARENT') return res.status(403).json({ message: 'Access denied' });

    const { classId, termId, components } = req.body;
    if (!classId || !termId || !Array.isArray(components) || components.length === 0) {
      return res.status(400).json({ message: 'classId, termId, and components are required' });
    }

    // Teachers: only their class
    if (req.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: req.user.id, classTeacherOf: { id: classId } },
      });
      if (!teacher) return res.status(403).json({ message: 'Access denied' });
    }

    // Verify results aren't already published
    const existing = await prisma.termResult.findUnique({
      where: { classId_termId: { classId, termId } },
    });
    if (existing?.isPublished) {
      return res.status(400).json({ message: 'Results are already published. Unpublish first to regenerate.' });
    }

    // Fetch all assessments with their scores
    const assessmentIds = components.map((c) => c.assessmentId);
    const assessments = await prisma.assessment.findMany({
      where: { id: { in: assessmentIds } },
      include: {
        scores: true,
        subject: { select: { id: true, name: true } },
        _count: { select: { scores: true } },
      },
    });

    // Guard: all assessments must have at least some scores entered
    const emptyAssessments = assessments.filter((a) => a._count.scores === 0);
    if (emptyAssessments.length > 0) {
      return res.status(400).json({
        message: `Some assessments have no scores entered: ${emptyAssessments.map((a) => a.name).join(', ')}`,
      });
    }

    // Build assessment map
    const assessmentMap = {};
    assessments.forEach((a) => { assessmentMap[a.id] = a; });

    // Group components by subjectId and validate weights sum to 100
    const bySubject = {};
    for (const comp of components) {
      const a = assessmentMap[comp.assessmentId];
      if (!a) return res.status(400).json({ message: `Assessment ${comp.assessmentId} not found` });
      if (a.classId !== classId || a.termId !== termId) {
        return res.status(400).json({ message: `Assessment ${a.name} does not belong to this class/term` });
      }
      const sid = a.subjectId;
      if (!bySubject[sid]) bySubject[sid] = { subject: a.subject, components: [] };
      bySubject[sid].components.push({ ...comp, assessment: a });
    }

    for (const [sid, data] of Object.entries(bySubject)) {
      const total = data.components.reduce((s, c) => s + parseFloat(c.weight), 0);
      if (Math.abs(total - 100) > 0.01) {
        return res.status(400).json({
          message: `Weights for subject "${data.subject.name}" sum to ${total.toFixed(1)}, must equal 100`,
        });
      }
    }

    // Get all active students in class
    const students = await prisma.student.findMany({
      where: { classId, isActive: true },
      select: { id: true, firstName: true, lastName: true },
    });

    // Build score map: { assessmentId: { studentId: score|null } }
    const scoresByAssessment = {};
    assessments.forEach((a) => {
      scoresByAssessment[a.id] = {};
      a.scores.forEach((s) => { scoresByAssessment[a.id][s.studentId] = s.score; });
    });

    // Calculate final score per student per subject
    const resultData = []; // { studentId, subjectId, totalScore, grade, remark }

    for (const [sid, data] of Object.entries(bySubject)) {
      const studentScores = students.map((st) => {
        let total = 0;
        for (const comp of data.components) {
          const rawScore = scoresByAssessment[comp.assessmentId][st.id] ?? null;
          const effective = rawScore === null ? 0 : rawScore; // ABS = 0
          const scaled = (effective / comp.assessment.totalMark) * parseFloat(comp.weight);
          total += scaled;
        }
        total = Math.round(total * 100) / 100; // round to 2dp
        const { grade, remark } = gesGrade(total);
        return { studentId: st.id, subjectId: sid, totalScore: total, grade, remark, _score: total };
      });

      // Assign positions for this subject
      const ranked = assignPositions(studentScores, '_score');
      ranked.forEach((item) => {
        resultData.push({
          studentId: item.studentId,
          subjectId: item.subjectId,
          totalScore: item.totalScore,
          grade: item.grade,
          remarks: item.remark,
          position: item._position,
        });
      });
    }

    // Compute average per student for promotion suggestion (avg >= 50)
    const avgByStudent = {};
    resultData.forEach((r) => {
      if (!avgByStudent[r.studentId]) avgByStudent[r.studentId] = { total: 0, count: 0 };
      avgByStudent[r.studentId].total += r.totalScore;
      avgByStudent[r.studentId].count += 1;
    });

    // Upsert TermResult (config) + TermResultComponents in a transaction
    const termResultUpsert = await prisma.$transaction(async (tx) => {
      // Create/update TermResult
      const tr = await tx.termResult.upsert({
        where: { classId_termId: { classId, termId } },
        create: { classId, termId },
        update: { updatedAt: new Date() },
      });

      // Replace all components
      await tx.termResultComponent.deleteMany({ where: { termResultId: tr.id } });
      await tx.termResultComponent.createMany({
        data: components.map((c) => ({
          termResultId: tr.id,
          assessmentId: c.assessmentId,
          weight: parseFloat(c.weight),
        })),
      });

      return tr;
    });

    // Upsert all Result records
    const resultUpserts = resultData.map((r) => {
      const avg = avgByStudent[r.studentId];
      const isPromoted = avg ? avg.total / avg.count >= 50 : false;
      return prisma.result.upsert({
        where: { studentId_subjectId_termId: { studentId: r.studentId, subjectId: r.subjectId, termId } },
        create: {
          studentId: r.studentId,
          subjectId: r.subjectId,
          termId,
          totalScore: r.totalScore,
          grade: r.grade,
          position: r.position,
          remarks: r.remarks,
          isPromoted,
        },
        update: {
          totalScore: r.totalScore,
          grade: r.grade,
          position: r.position,
          remarks: r.remarks,
          isPromoted,
        },
      });
    });
    await prisma.$transaction(resultUpserts);

    res.json({
      message: 'Results generated successfully',
      subjects: Object.keys(bySubject).length,
      students: students.length,
      records: resultData.length,
    });
  } catch (err) {
    console.error('POST /results/generate', err);
    res.status(500).json({ message: 'Failed to generate results' });
  }
});

// ─── GET /results/:classId/:termId ────────────────────────────────────────────
// Returns generated results for a class+term, grouped by student
router.get('/:classId/:termId', async (req, res) => {
  try {
    const { classId, termId } = req.params;

    // Teachers: only their class
    if (req.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: req.user.id, classTeacherOf: { id: classId } },
      });
      if (!teacher) return res.status(403).json({ message: 'Access denied' });
    }

    const termResult = await prisma.termResult.findUnique({
      where: { classId_termId: { classId, termId } },
      include: {
        components: {
          include: { assessment: { include: { subject: { select: { id: true, name: true } } } } },
        },
      },
    });

    const results = await prisma.result.findMany({
      where: { termId, student: { classId } },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, studentId: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ student: { lastName: 'asc' } }, { subject: { name: 'asc' } }],
    });

    const term = await prisma.term.findUnique({ where: { id: termId } });
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      include: { classTeacher: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });

    // Group by student
    const byStudent = {};
    results.forEach((r) => {
      if (!byStudent[r.studentId]) {
        byStudent[r.studentId] = {
          student: r.student,
          subjects: [],
          isPromoted: r.isPromoted,
        };
      }
      byStudent[r.studentId].subjects.push({
        subjectId: r.subjectId,
        subjectName: r.subject.name,
        subjectCode: r.subject.code,
        totalScore: r.totalScore,
        grade: r.grade,
        position: r.position,
        remarks: r.remarks,
        isPromoted: r.isPromoted,
      });
    });

    // Fetch remarks for all students in class+term
    const studentIds = Object.keys(byStudent);
    const allRemarks = studentIds.length
      ? await prisma.termRemarks.findMany({ where: { studentId: { in: studentIds }, termId } })
      : [];
    const remarksMap = {};
    allRemarks.forEach((r) => { remarksMap[r.studentId] = r; });

    // Compute overall avg per student, JHS aggregate (best 6 positions)
    const isJHS = cls?.level?.startsWith('JHS');
    Object.values(byStudent).forEach((data) => {
      const scores = data.subjects.map((s) => s.totalScore).filter((s) => s !== null);
      data.average = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : null;
      if (isJHS) {
        const positions = data.subjects.map((s) => s.position).filter((p) => p !== null).sort((a, b) => a - b);
        data.aggregate = positions.slice(0, 6).reduce((s, p) => s + p, 0);
      }
      const rem = remarksMap[data.student.id];
      data.teacherRemarks = rem?.teacherRemarks ?? null;
      data.headmasterRemarks = rem?.headmasterRemarks ?? null;
      data.nextTermBegins = rem?.nextTermBegins ?? null;
    });

    res.json({
      classId,
      className: cls?.name,
      classTeacher: cls?.classTeacher
        ? { name: `${cls.classTeacher.user.firstName} ${cls.classTeacher.user.lastName}` }
        : null,
      term: term ? { id: term.id, name: term.name, year: term.year } : null,
      isPublished: termResult?.isPublished ?? false,
      publishedAt: termResult?.publishedAt ?? null,
      config: termResult,
      students: Object.values(byStudent),
    });
  } catch (err) {
    console.error('GET /results/:classId/:termId', err);
    res.status(500).json({ message: 'Failed to fetch results' });
  }
});

// ─── PUT /results/promotion/:studentId/:termId ────────────────────────────────
// Admin/teacher override of promotion decision for a student
router.put('/promotion/:studentId/:termId', async (req, res) => {
  try {
    if (req.user.role === 'PARENT') return res.status(403).json({ message: 'Access denied' });

    const { studentId, termId } = req.params;
    const { isPromoted } = req.body;
    if (isPromoted === undefined) return res.status(400).json({ message: 'isPromoted is required' });

    // Update all result records for this student+term
    await prisma.result.updateMany({
      where: { studentId, termId },
      data: { isPromoted: Boolean(isPromoted) },
    });

    res.json({ message: 'Promotion status updated' });
  } catch (err) {
    console.error('PUT /results/promotion', err);
    res.status(500).json({ message: 'Failed to update promotion status' });
  }
});

// ─── PUT /results/remarks/:studentId/:termId ──────────────────────────────────
// Class teacher writes teacher remarks; admin writes headmaster remarks
router.put('/remarks/:studentId/:termId', async (req, res) => {
  try {
    if (req.user.role === 'PARENT') return res.status(403).json({ message: 'Access denied' });

    const { studentId, termId } = req.params;
    const { teacherRemarks, headmasterRemarks, nextTermBegins, classId } = req.body;

    // Get classId from student if not provided
    let resolvedClassId = classId;
    if (!resolvedClassId) {
      const student = await prisma.student.findUnique({ where: { id: studentId }, select: { classId: true } });
      resolvedClassId = student?.classId;
    }

    const data = {};
    if (req.user.role === 'TEACHER') {
      if (teacherRemarks !== undefined) data.teacherRemarks = teacherRemarks;
    } else {
      // Admin can update both
      if (teacherRemarks !== undefined) data.teacherRemarks = teacherRemarks;
      if (headmasterRemarks !== undefined) data.headmasterRemarks = headmasterRemarks;
      if (nextTermBegins !== undefined) data.nextTermBegins = nextTermBegins ? new Date(nextTermBegins) : null;
    }

    const remarks = await prisma.termRemarks.upsert({
      where: { studentId_termId: { studentId, termId } },
      create: { studentId, termId, classId: resolvedClassId, ...data },
      update: data,
    });

    res.json({ message: 'Remarks updated', remarks });
  } catch (err) {
    console.error('PUT /results/remarks', err);
    res.status(500).json({ message: 'Failed to update remarks' });
  }
});

// ─── POST /results/publish/:classId/:termId ───────────────────────────────────
// Admin only. Locks the results and makes them visible to parents.
router.post('/publish/:classId/:termId', authorize('ADMIN'), async (req, res) => {
  try {
    const { classId, termId } = req.params;

    const termResult = await prisma.termResult.findUnique({
      where: { classId_termId: { classId, termId } },
    });
    if (!termResult) return res.status(404).json({ message: 'Results not generated yet' });
    if (termResult.isPublished) return res.status(400).json({ message: 'Results are already published' });

    const updated = await prisma.termResult.update({
      where: { classId_termId: { classId, termId } },
      data: { isPublished: true, publishedAt: new Date(), publishedBy: req.user.id },
    });

    res.json({ message: 'Results published', termResult: updated });
  } catch (err) {
    console.error('POST /results/publish', err);
    res.status(500).json({ message: 'Failed to publish results' });
  }
});

// ─── POST /results/unpublish/:classId/:termId ─────────────────────────────────
// Admin only. Reverts to draft so results can be regenerated.
router.post('/unpublish/:classId/:termId', authorize('ADMIN'), async (req, res) => {
  try {
    const { classId, termId } = req.params;

    const updated = await prisma.termResult.update({
      where: { classId_termId: { classId, termId } },
      data: { isPublished: false, publishedAt: null, publishedBy: null },
    });

    res.json({ message: 'Results unpublished', termResult: updated });
  } catch (err) {
    console.error('POST /results/unpublish', err);
    res.status(500).json({ message: 'Failed to unpublish results' });
  }
});

// ─── GET /results/reportcard/:studentId/:termId ───────────────────────────────
// Returns all data needed to render a single student's report card
router.get('/reportcard/:studentId/:termId', async (req, res) => {
  try {
    const { studentId, termId } = req.params;

    // Parent: only their own child
    if (req.user.role === 'PARENT') {
      const parent = await prisma.parent.findFirst({
        where: { userId: req.user.id, children: { some: { id: studentId } } },
      });
      if (!parent) return res.status(403).json({ message: 'Access denied' });

      // Check published
      const student = await prisma.student.findUnique({ where: { id: studentId }, select: { classId: true } });
      const termResult = await prisma.termResult.findUnique({
        where: { classId_termId: { classId: student.classId, termId } },
      });
      if (!termResult?.isPublished) return res.status(403).json({ message: 'Results not yet published' });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        class: {
          include: { classTeacher: { include: { user: { select: { firstName: true, lastName: true } } } } },
        },
        parent: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
      },
    });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const term = await prisma.term.findUnique({ where: { id: termId } });
    if (!term) return res.status(404).json({ message: 'Term not found' });

    const results = await prisma.result.findMany({
      where: { studentId, termId },
      include: { subject: { select: { id: true, name: true, code: true } } },
      orderBy: { subject: { name: 'asc' } },
    });

    const remarks = await prisma.termRemarks.findUnique({
      where: { studentId_termId: { studentId, termId } },
    });

    // Attendance summary for the term
    const attendance = await prisma.attendance.groupBy({
      by: ['status'],
      where: { studentId, termId },
      _count: { status: true },
    });
    const attSummary = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    attendance.forEach((a) => { attSummary[a.status] = a._count.status; });

    // Total students in class (for reference)
    const classSize = await prisma.student.count({ where: { classId: student.classId, isActive: true } });

    // Compute average + JHS aggregate
    const scores = results.map((r) => r.totalScore).filter((s) => s !== null);
    const average = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : null;
    const isJHS = student.class?.level?.startsWith('JHS');
    let aggregate = null;
    if (isJHS) {
      const positions = results.map((r) => r.position).filter((p) => p !== null).sort((a, b) => a - b);
      aggregate = positions.slice(0, 6).reduce((s, p) => s + p, 0);
    }

    const isPromoted = results.some((r) => r.isPromoted);

    res.json({
      student: {
        id: student.id,
        studentId: student.studentId,
        name: `${student.firstName} ${student.lastName}`,
        gender: student.gender,
        className: student.class?.name,
        classTeacher: student.class?.classTeacher
          ? `${student.class.classTeacher.user.firstName} ${student.class.classTeacher.user.lastName}`
          : null,
        parentName: student.parent
          ? `${student.parent.user.firstName} ${student.parent.user.lastName}`
          : student.parentName,
        classSize,
      },
      term: { id: term.id, name: term.name, year: term.year },
      results: results.map((r) => ({
        subjectId: r.subjectId,
        subjectName: r.subject.name,
        subjectCode: r.subject.code,
        totalScore: r.totalScore,
        grade: r.grade,
        position: r.position,
        remarks: r.remarks,
      })),
      average,
      aggregate,
      isPromoted,
      attendance: attSummary,
      totalDays: Object.values(attSummary).reduce((a, b) => a + b, 0),
      teacherRemarks: remarks?.teacherRemarks ?? null,
      headmasterRemarks: remarks?.headmasterRemarks ?? null,
      nextTermBegins: remarks?.nextTermBegins ?? null,
    });
  } catch (err) {
    console.error('GET /results/reportcard/:studentId/:termId', err);
    res.status(500).json({ message: 'Failed to fetch report card' });
  }
});

// ─── GET /results/reportcard/class/:classId/term/:termId ──────────────────────
// Returns report card data for ALL students in a class (bulk print)
router.get('/reportcard/class/:classId/term/:termId', async (req, res) => {
  try {
    if (req.user.role === 'PARENT') return res.status(403).json({ message: 'Access denied' });

    const { classId, termId } = req.params;

    const cls = await prisma.class.findUnique({
      where: { id: classId },
      include: { classTeacher: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });
    if (!cls) return res.status(404).json({ message: 'Class not found' });

    const term = await prisma.term.findUnique({ where: { id: termId } });
    const termResult = await prisma.termResult.findUnique({
      where: { classId_termId: { classId, termId } },
    });

    const students = await prisma.student.findMany({
      where: { classId, isActive: true },
      include: {
        parent: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const studentIds = students.map((s) => s.id);

    const [allResults, allRemarks, allAttendance] = await Promise.all([
      prisma.result.findMany({
        where: { studentId: { in: studentIds }, termId },
        include: { subject: { select: { id: true, name: true, code: true } } },
      }),
      prisma.termRemarks.findMany({
        where: { studentId: { in: studentIds }, termId },
      }),
      prisma.attendance.groupBy({
        by: ['studentId', 'status'],
        where: { studentId: { in: studentIds }, termId },
        _count: { status: true },
      }),
    ]);

    // Index by studentId
    const resultsByStudent = {};
    allResults.forEach((r) => {
      if (!resultsByStudent[r.studentId]) resultsByStudent[r.studentId] = [];
      resultsByStudent[r.studentId].push(r);
    });

    const remarksByStudent = {};
    allRemarks.forEach((r) => { remarksByStudent[r.studentId] = r; });

    const attByStudent = {};
    allAttendance.forEach((a) => {
      if (!attByStudent[a.studentId]) attByStudent[a.studentId] = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
      attByStudent[a.studentId][a.status] = a._count.status;
    });

    const classSize = students.length;
    const isJHS = cls.level?.startsWith('JHS');

    const cards = students.map((st) => {
      const results = resultsByStudent[st.id] ?? [];
      const remarks = remarksByStudent[st.id];
      const att = attByStudent[st.id] ?? { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };

      const scores = results.map((r) => r.totalScore).filter((s) => s !== null);
      const average = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : null;

      let aggregate = null;
      if (isJHS) {
        const positions = results.map((r) => r.position).filter((p) => p !== null).sort((a, b) => a - b);
        aggregate = positions.slice(0, 6).reduce((s, p) => s + p, 0);
      }

      return {
        student: {
          id: st.id,
          studentId: st.studentId,
          name: `${st.firstName} ${st.lastName}`,
          gender: st.gender,
          parentName: st.parent
            ? `${st.parent.user.firstName} ${st.parent.user.lastName}`
            : st.parentName,
          classSize,
        },
        results: results.map((r) => ({
          subjectId: r.subjectId,
          subjectName: r.subject.name,
          subjectCode: r.subject.code,
          totalScore: r.totalScore,
          grade: r.grade,
          position: r.position,
          remarks: r.remarks,
        })),
        average,
        aggregate,
        isPromoted: results.some((r) => r.isPromoted),
        attendance: att,
        totalDays: Object.values(att).reduce((a, b) => a + b, 0),
        teacherRemarks: remarks?.teacherRemarks ?? null,
        headmasterRemarks: remarks?.headmasterRemarks ?? null,
        nextTermBegins: remarks?.nextTermBegins ?? null,
      };
    });

    res.json({
      class: {
        id: cls.id,
        name: cls.name,
        level: cls.level,
        classTeacher: cls.classTeacher
          ? `${cls.classTeacher.user.firstName} ${cls.classTeacher.user.lastName}`
          : null,
      },
      term: term ? { id: term.id, name: term.name, year: term.year } : null,
      isPublished: termResult?.isPublished ?? false,
      cards,
    });
  } catch (err) {
    console.error('GET /results/reportcard/class', err);
    res.status(500).json({ message: 'Failed to fetch class report cards' });
  }
});

module.exports = router;
