const { Router } = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const prisma = require('../config/db');
const { authenticateParent, parentPhoneVariants, parentHasAccessToStudent } = require('../middleware/parentPortalAuth');

const router = Router();
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const SYSTEM_PROMPT = `You are a friendly, encouraging educational assistant for a school student. Your name is EduBot.

IMPORTANT RULES:
1. You have access to the student's class information, subjects, grades, timetable, and attendance. Use this context to personalize your help.
2. You MUST NOT solve homework, assignments, or test questions for the student. Instead:
   - Guide them through the problem-solving process step by step
   - Ask leading questions that help them think critically
   - Explain underlying concepts and principles
   - Give hints, not answers
   - Encourage them to try on their own first
3. If a student asks you to directly solve an assignment or homework, politely decline and offer to help them understand the concepts instead.
4. You CAN:
   - Explain concepts from their subjects
   - Help them study and review material
   - Create practice questions (different from their actual assignments)
   - Help them understand their grades and how to improve
   - Suggest study strategies and time management tips
   - Quiz them on topics they're studying
   - Explain things in simpler terms
5. Be warm, patient, and age-appropriate in your responses.
6. Keep responses concise but helpful. Use simple language.
7. If asked about something outside academics, you can have a brief friendly chat but gently redirect to educational topics.`;

async function getStudentContext(studentId) {
  const student = await prisma.student.findUnique({
    where: { studentId },
    include: {
      class: {
        include: {
          classTeacher: {
            include: { user: { select: { firstName: true, lastName: true } } },
          },
          subjects: {
            include: { subject: true },
          },
        },
      },
      results: {
        include: {
          subject: { select: { name: true } },
          term: { select: { name: true, year: true } },
        },
        orderBy: [{ term: { year: 'desc' } }, { subject: { name: 'asc' } }],
      },
      attendances: {
        orderBy: { date: 'desc' },
        take: 30,
        select: { status: true, date: true },
      },
    },
  });

  if (!student) return null;

  const total = student.attendances.length;
  const present = student.attendances.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
  const attendanceRate = total > 0 ? Math.round((present / total) * 100) : null;

  const subjects = student.class?.subjects?.map(cs => cs.subject.name) || [];

  const recentGrades = student.results.slice(0, 20).map(r => ({
    subject: r.subject.name,
    term: `${r.term.name} ${r.term.year}`,
    classScore: r.classScore,
    examScore: r.examScore,
    totalScore: r.totalScore,
    grade: r.grade,
  }));

  const timetable = await prisma.timetable.findMany({
    where: { classId: student.classId },
    include: { subject: { select: { name: true } } },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });

  return {
    name: `${student.firstName} ${student.lastName}`,
    className: student.class?.name || 'Unknown',
    classLevel: student.class?.level || 'Unknown',
    classTeacher: student.class?.classTeacher
      ? `${student.class.classTeacher.user.firstName} ${student.class.classTeacher.user.lastName}`
      : 'Unknown',
    subjects,
    attendanceRate,
    recentGrades,
    timetable: timetable.map(e => ({
      day: ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][e.dayOfWeek] || `Day ${e.dayOfWeek}`,
      subject: e.subject?.name || 'Unknown',
      startTime: e.startTime,
      endTime: e.endTime,
    })),
  };
}

// POST /portal/ai/chat
router.post('/ai/chat', authenticateParent, async (req, res) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'AI assistant is not configured' });
    }

    const { studentId: schoolStudentId, messages, images = [] } = req.body || {};
    if (!schoolStudentId || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'studentId and messages are required' });
    }

    const phoneVariants = parentPhoneVariants(req.parentPhone);
    const student = await prisma.student.findUnique({
      where: { studentId: schoolStudentId },
      include: { parent: { include: { user: { select: { phone: true } } } } },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const hasAccess = parentHasAccessToStudent(student, phoneVariants);
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    const context = await getStudentContext(schoolStudentId);
    if (!context) return res.status(404).json({ error: 'Could not load student data' });

    const contextBlock = `
STUDENT CONTEXT:
- Name: ${context.name}
- Class: ${context.className} (${context.classLevel})
- Class Teacher: ${context.classTeacher}
- Subjects: ${context.subjects.join(', ') || 'None listed'}
- Attendance Rate: ${context.attendanceRate !== null ? `${context.attendanceRate}%` : 'No data'}
- Recent Grades: ${context.recentGrades.length > 0
  ? context.recentGrades.map(g => `${g.subject}: ${g.grade} (${g.totalScore}%) - ${g.term}`).join('; ')
  : 'No grades yet'}
- Timetable: ${context.timetable.length > 0
  ? context.timetable.map(t => `${t.day} ${t.startTime}-${t.endTime}: ${t.subject}`).join('; ')
  : 'No timetable'}
`;

    const anthropic = new Anthropic({ apiKey });

    const safeImages = Array.isArray(images)
      ? images
          .filter((img) => img && typeof img === 'object')
          .slice(0, 3)
          .filter((img) => SUPPORTED_IMAGE_TYPES.has(img.mediaType) && typeof img.base64 === 'string')
          .map((img) => ({ mediaType: img.mediaType, base64: img.base64 }))
      : [];

    const chatMessages = messages.slice(-20).map((m, idx, arr) => {
      const role = m.role === 'user' ? 'user' : 'assistant';
      const isLastUser = role === 'user' && idx === arr.length - 1;
      const contentText = typeof m.content === 'string' ? m.content : '';

      if (!isLastUser || safeImages.length === 0) {
        return { role, content: contentText };
      }

      return {
        role,
        content: [
          { type: 'text', text: contentText || 'Please help me understand this question from the attached image.' },
          ...safeImages.map((img) => ({
            type: 'image',
            source: {
              type: 'base64',
              media_type: img.mediaType,
              data: img.base64,
            },
          })),
        ],
      };
    });

    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT + '\n\n' + contextBlock,
      messages: chatMessages,
    });

    const reply = response.content?.[0]?.text || 'Sorry, I could not generate a response.';

    res.json({ reply });
  } catch (error) {
    console.error('POST /portal/ai/chat error:', error);
    if (error?.status === 401) {
      return res.status(503).json({ error: 'AI service authentication failed' });
    }
    if (error?.status === 404) {
      return res.status(503).json({ error: 'Configured AI model is unavailable for this API key' });
    }
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

module.exports = router;
