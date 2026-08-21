const { Router } = require('express');
const prisma = require('../config/db');
const { authenticateParent, parentPhoneVariants, parentHasAccessToStudent } = require('../middleware/parentPortalAuth');
const { GAME_TYPES, pickWord, pickScribbleWord, dealQuestions, generateTargetMath, listWords, listScribbleWords, listWordSmithWords, dealWordSmith } = require('../games/content');
const { createSeedAndState, applyAction, sanitizeMatch } = require('../games/engine');

const router = Router();
router.use(authenticateParent);

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function loadAccessibleStudent(req, schoolStudentId) {
  if (!schoolStudentId) return { error: { status: 400, message: 'studentId is required' } };
  const phoneVariants = parentPhoneVariants(req.parentPhone);
  const student = await prisma.student.findUnique({
    where: { studentId: schoolStudentId },
    include: {
      parent: { include: { user: { select: { phone: true } } } },
      class: { select: { level: true, name: true } },
    },
  });
  if (!student) return { error: { status: 404, message: 'Student not found' } };
  if (!parentHasAccessToStudent(student, phoneVariants)) {
    return { error: { status: 403, message: 'Access denied' } };
  }
  return { student };
}

function actorFor(match, schoolStudentId) {
  if (match.hostStudentId === schoolStudentId) return 'HOST';
  if (match.guestStudentId === schoolStudentId) return 'GUEST';
  return null;
}

router.get('/packs', async (req, res) => {
  try {
    const loaded = await loadAccessibleStudent(req, req.query.studentId);
    if (loaded.error) return res.status(loaded.error.status).json({ error: loaded.error.message });
    const level = loaded.student.class?.level;
    const gameType = String(req.query.gameType || '').toUpperCase();
    if (gameType === 'HANGMAN') {
      return res.json({ words: listWords(level) });
    }
    if (gameType === 'SCRIBBLE') {
      return res.json({ words: listScribbleWords(level) });
    }
    if (gameType === 'KNOWLEDGE_TOWER') {
      return res.json({ questions: dealQuestions(level, 40) });
    }
    if (gameType === 'TIC_TAC_TRIVIA') {
      return res.json({ questions: dealQuestions(level, 36, req.query.subject) });
    }
    if (gameType === 'WORD_SMITH') {
      return res.json({ rounds: listWordSmithWords() });
    }
    if (gameType === 'TARGET_MATH') {
      return res.json(generateTargetMath(req.query.difficulty));
    }
    return res.status(400).json({ error: 'Unknown gameType' });
  } catch (err) {
    console.error('GET /portal/games/packs', err);
    return res.status(500).json({ error: 'Failed to load packs' });
  }
});

router.get('/deal', async (req, res) => {
  try {
    const loaded = await loadAccessibleStudent(req, req.query.studentId);
    if (loaded.error) return res.status(loaded.error.status).json({ error: loaded.error.message });
    const level = loaded.student.class?.level;
    const gameType = String(req.query.gameType || '').toUpperCase();
    if (gameType === 'HANGMAN') {
      return res.json(pickWord(level, req.query.subject));
    }
    if (gameType === 'SCRIBBLE') {
      return res.json(pickScribbleWord(level, req.query.subject));
    }
    if (gameType === 'KNOWLEDGE_TOWER') {
      return res.json({ questions: dealQuestions(level, 40) });
    }
    if (gameType === 'TIC_TAC_TRIVIA') {
      return res.json({ questions: dealQuestions(level, 36, req.query.subject) });
    }
    if (gameType === 'WORD_SMITH') {
      const deal = await dealWordSmith();
      return res.json(deal);
    }
    if (gameType === 'TARGET_MATH') {
      return res.json(generateTargetMath(req.query.difficulty));
    }
    return res.status(400).json({ error: 'Unknown gameType' });
  } catch (err) {
    console.error('GET /portal/games/deal', err);
    return res.status(500).json({ error: 'Failed to deal puzzle' });
  }
});

router.post('/matches', async (req, res) => {
  try {
    const { studentId, gameType, word, hint, subject, durationSec, difficulty } = req.body || {};
    const loaded = await loadAccessibleStudent(req, studentId);
    if (loaded.error) return res.status(loaded.error.status).json({ error: loaded.error.message });
    const type = String(gameType || '').toUpperCase();
    if (!GAME_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid gameType' });

    const extras = { word, hint, subject, durationSec, difficulty };
    if (type === 'WORD_SMITH') {
      extras.wordSmith = await dealWordSmith();
    }
    const { seed, state, turn } = createSeedAndState(type, loaded.student.class?.level, extras);
    let code = makeCode();
    for (let i = 0; i < 6; i += 1) {
      const exists = await prisma.gameMatch.findUnique({ where: { code } });
      if (!exists) break;
      code = makeCode();
    }

    const match = await prisma.gameMatch.create({
      data: {
        code,
        gameType: type,
        status: 'WAITING',
        hostStudentId: loaded.student.studentId,
        hostName: `${loaded.student.firstName} ${loaded.student.lastName}`.trim(),
        seed,
        state,
        turn,
      },
    });
    res.status(201).json({ match: sanitizeMatch(match, loaded.student.studentId) });
  } catch (err) {
    console.error('POST /portal/games/matches', err);
    res.status(500).json({ error: 'Failed to create match' });
  }
});

router.post('/matches/join', async (req, res) => {
  try {
    const { studentId, code } = req.body || {};
    const loaded = await loadAccessibleStudent(req, studentId);
    if (loaded.error) return res.status(loaded.error.status).json({ error: loaded.error.message });
    const match = await prisma.gameMatch.findUnique({
      where: { code: String(code || '').trim().toUpperCase() },
    });
    if (!match) return res.status(404).json({ error: 'Match not found' });
    if (match.status !== 'WAITING') return res.status(400).json({ error: 'Match already started' });
    if (match.hostStudentId === loaded.student.studentId) {
      return res.status(400).json({ error: 'You cannot join your own match' });
    }

    const updated = await prisma.gameMatch.update({
      where: { id: match.id },
      data: {
        guestStudentId: loaded.student.studentId,
        guestName: `${loaded.student.firstName} ${loaded.student.lastName}`.trim(),
        status: 'ACTIVE',
      },
    });
    res.json({ match: sanitizeMatch(updated, loaded.student.studentId) });
  } catch (err) {
    console.error('POST /portal/games/matches/join', err);
    res.status(500).json({ error: 'Failed to join match' });
  }
});

router.get('/matches/:id', async (req, res) => {
  try {
    const loaded = await loadAccessibleStudent(req, req.query.studentId);
    if (loaded.error) return res.status(loaded.error.status).json({ error: loaded.error.message });
    const match = await prisma.gameMatch.findUnique({ where: { id: req.params.id } });
    if (!match) return res.status(404).json({ error: 'Match not found' });
    if (!actorFor(match, loaded.student.studentId)) return res.status(403).json({ error: 'Access denied' });
    res.json({ match: sanitizeMatch(match, loaded.student.studentId) });
  } catch (err) {
    console.error('GET /portal/games/matches/:id', err);
    res.status(500).json({ error: 'Failed to load match' });
  }
});

router.post('/matches/:id/actions', async (req, res) => {
  try {
    const loaded = await loadAccessibleStudent(req, req.body?.studentId);
    if (loaded.error) return res.status(loaded.error.status).json({ error: loaded.error.message });
    const match = await prisma.gameMatch.findUnique({ where: { id: req.params.id } });
    if (!match) return res.status(404).json({ error: 'Match not found' });
    const actor = actorFor(match, loaded.student.studentId);
    if (!actor) return res.status(403).json({ error: 'Access denied' });
    if (match.status === 'WAITING') return res.status(400).json({ error: 'Waiting for opponent' });

    const next = applyAction(match, actor, { type: req.body?.type, payload: req.body?.payload });
    const updated = await prisma.gameMatch.update({
      where: { id: match.id },
      data: {
        state: next.state,
        turn: next.turn,
        status: next.status,
        winnerStudentId: next.winnerStudentId,
      },
    });
    res.json({ match: sanitizeMatch(updated, loaded.student.studentId) });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('POST /portal/games/matches/:id/actions', err);
    res.status(status).json({ error: err.message || 'Action failed' });
  }
});

module.exports = router;
