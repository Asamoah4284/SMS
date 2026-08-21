const fs = require('fs');
const path = require('path');

const GAME_TYPES = [
  'HANGMAN',
  'KNOWLEDGE_TOWER',
  'WORD_SMITH',
  'TIC_TAC_TRIVIA',
  'TARGET_MATH',
  'SCRIBBLE',
];

const PACK_DIR = path.join(__dirname, 'packs');
const packCache = {};

function loadPack(filename, fallback = { early: [], middle: [], upper: [] }) {
  const file = path.join(PACK_DIR, filename);
  try {
    const stat = fs.statSync(file);
    const hit = packCache[filename];
    if (hit && hit.mtimeMs === stat.mtimeMs) return hit.data;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    packCache[filename] = { mtimeMs: stat.mtimeMs, data };
    return data;
  } catch (err) {
    console.error(`Failed to load game pack ${filename}:`, err.message);
    if (packCache[filename]?.data) return packCache[filename].data;
    return fallback;
  }
}

function wordsPack() {
  return loadPack('hangman.json');
}

function scribblePack() {
  return loadPack('scribble.json');
}

function questionsPack() {
  return loadPack('questions.json');
}

function packTier(level) {
  const lv = String(level || '');
  if (/CRECHE|NURSERY|KG|YEAR_[123]$|BASIC_[123]$/.test(lv)) return 'early';
  if (/JHS|YEAR_[78]$/.test(lv)) return 'upper';
  return 'middle';
}

function cleanWordSmithLetters(raw) {
  if (Array.isArray(raw)) {
    return raw.map((ch) => String(ch).toUpperCase().replace(/[^A-Z]/g, '')).join('');
  }
  return String(raw || '').toUpperCase().replace(/[^A-Z]/g, '');
}

function cleanWordSmithWord(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z]/g, '');
}

function wordSmithRounds() {
  const data = loadPack('word-smith.json', { rounds: [] });
  return Array.isArray(data.rounds) ? data.rounds : [];
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function shuffle(list, rng = Math.random) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickWord(level, subject) {
  const WORDS = wordsPack();
  const tier = packTier(level);
  let pool = WORDS[tier] || WORDS.middle || [];
  if (subject) {
    const filtered = pool.filter((w) => String(w.subject || '').toLowerCase() === String(subject).toLowerCase());
    if (filtered.length) pool = filtered;
  }
  if (!pool.length) return { word: 'SCHOOL', hint: 'Where we learn together', subject: 'English' };
  return clone(pool[Math.floor(Math.random() * pool.length)]);
}

function pickScribbleWord(level, subject) {
  const WORDS = scribblePack();
  const tier = packTier(level);
  let pool = WORDS[tier] || WORDS.middle || WORDS.early || [];
  if (subject && String(subject).toLowerCase() !== 'all') {
    const filtered = pool.filter((w) => String(w.subject || '').toLowerCase() === String(subject).toLowerCase());
    if (filtered.length) pool = filtered;
  }
  if (!pool.length) return pickWord(level, subject);
  return clone(pool[Math.floor(Math.random() * pool.length)]);
}

function listScribbleWords(level) {
  const WORDS = scribblePack();
  const tier = packTier(level);
  return clone(WORDS[tier] || WORDS.middle || WORDS.early || []);
}

function listWords(level) {
  const WORDS = wordsPack();
  const tier = packTier(level);
  return clone(WORDS[tier] || WORDS.middle || []);
}

function listQuestions(level) {
  const QUESTIONS = questionsPack();
  const tier = packTier(level);
  const extra = tier === 'upper' ? (QUESTIONS.middle || []) : [];
  return clone([...(QUESTIONS[tier] || QUESTIONS.middle || []), ...extra]);
}

function shuffleQuestionChoices(q) {
  const src = clone(q);
  const indexed = (src.choices || []).map((text, i) => ({ text, i }));
  const mixed = shuffle(indexed);
  src.choices = mixed.map((x) => x.text);
  const nextIndex = mixed.findIndex((x) => x.i === q.answerIndex);
  src.answerIndex = nextIndex >= 0 ? nextIndex : q.answerIndex;
  return src;
}

function dealQuestions(level, count, subject) {
  let pool = listQuestions(level);
  if (subject && String(subject).toLowerCase() !== 'all') {
    const filtered = pool.filter(
      (q) => String(q.subject || '').toLowerCase() === String(subject).toLowerCase(),
    );
    if (filtered.length) pool = filtered;
  }
  if (!pool.length) {
    pool = [{ prompt: 'What is 1 + 1?', choices: ['1', '2', '3', '4'], answerIndex: 1, subject: 'Maths' }];
  }
  pool = shuffle(pool).map(shuffleQuestionChoices);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const q = pool[i % pool.length];
    out.push({ ...q, id: `q_${i}_${Math.random().toString(36).slice(2, 7)}` });
  }
  return out;
}

function generateLetterSeed() {
  const fallback = dealWordSmith();
  return fallback.letterSeed;
}

function canMakeWord(word, seed) {
  const counts = {};
  for (const ch of String(seed || '').toUpperCase()) counts[ch] = (counts[ch] || 0) + 1;
  for (const ch of String(word || '').toUpperCase()) {
    if (!counts[ch]) return false;
    counts[ch] -= 1;
  }
  return true;
}

function wordScore(word) {
  const n = String(word || '').length;
  if (n < 3) return 0;
  if (n === 3) return 1;
  if (n === 4) return 2;
  if (n === 5) return 4;
  if (n === 6) return 6;
  return 10;
}

function normalizeWordSmithRound(round) {
  const letters = cleanWordSmithLetters(round?.letters);
  if (letters.length < 3) return null;
  const answers = [...new Set((round?.words || []).map(cleanWordSmithWord))]
    .filter((w) => w.length >= 3 && w.length <= letters.length && canMakeWord(w, letters))
    .sort((a, b) => b.length - a.length || a.localeCompare(b));
  if (!answers.length) return null;
  const sortedLetters = [...letters].sort().join('');
  const pangram = answers.find((w) => [...w].sort().join('') === sortedLetters) || letters;
  return { letterSeed: shuffle(letters.split('')).join(''), pangram, answers };
}

function dealWordSmith() {
  const pool = shuffle(wordSmithRounds().map(normalizeWordSmithRound).filter(Boolean));
  if (pool.length) return pool[0];
  return normalizeWordSmithRound({
    letters: 'TEACHER',
    words: ['ACE', 'ACT', 'ATE', 'CAT', 'EAT', 'HAT', 'TEA', 'THE', 'EACH', 'HEAT', 'TEACH', 'TEACHER'],
  });
}

function listWordSmithWords() {
  return wordSmithRounds();
}

function isValidWordSmithWord(word, seed, answers) {
  const letters = String(seed || '').toUpperCase();
  const w = cleanWordSmithWord(word);
  if (w.length < 3 || w.length > letters.length) return false;
  if (!canMakeWord(w, letters)) return false;
  if (!Array.isArray(answers) || !answers.length) return false;
  return answers.some((a) => cleanWordSmithWord(a) === w);
}

function applyOp(a, b, op) {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '×' || op === '*') return a * b;
  if (op === '÷' || op === '/') {
    if (b === 0 || a % b !== 0) return null;
    return a / b;
  }
  return null;
}

function evalTargetExpression(tokens, tiles) {
  const remaining = [...tiles];
  let value = null;
  let pendingOp = null;
  let steps = 0;
  for (const raw of tokens) {
    if (typeof raw === 'number') {
      const idx = remaining.indexOf(raw);
      if (idx < 0) {
        const err = new Error('You already used that tile.');
        throw err;
      }
      remaining.splice(idx, 1);
      if (value == null) {
        value = raw;
      } else {
        if (!pendingOp) throw new Error('Put an operation between numbers.');
        const next = applyOp(value, raw, pendingOp);
        if (next == null || !Number.isFinite(next)) {
          throw new Error('That ÷ does not make a whole number.');
        }
        value = next;
        pendingOp = null;
        steps += 1;
      }
    } else if ('+-×*÷/'.includes(raw)) {
      if (value == null) throw new Error('Start with a number.');
      if (pendingOp) throw new Error('One operation at a time.');
      pendingOp = raw;
    } else {
      throw new Error('Bad token');
    }
  }
  if (value == null) throw new Error('Build an expression first.');
  if (pendingOp) throw new Error('Finish with a number.');
  return { value, steps, leftover: remaining };
}

function clampMathDifficulty(raw) {
  const v = String(raw || '').toLowerCase();
  return v === 'easy' || v === 'hard' ? v : 'medium';
}

function targetMathPuzzles() {
  const data = loadPack('target-math.json', { puzzles: [] });
  return Array.isArray(data.puzzles) ? data.puzzles : [];
}

function normalizeMathPuzzle(puzzle, difficulty) {
  const tiles = (puzzle.tiles || []).map((n) => Number(n)).filter((n) => Number.isFinite(n));
  const target = Number(puzzle.target);
  if (tiles.length < 3 || !Number.isFinite(target)) return null;
  return {
    tiles: shuffle(tiles),
    target,
    maxSteps: 5,
    difficulty,
    hint: String(puzzle.hint || ''),
  };
}

function synthesizePuzzle(difficulty) {
  const pools = {
    easy: [1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 7, 8, 9, 10],
    medium: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 12, 15, 20, 25],
    hard: [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 50, 75, 100],
  };
  const opSets = {
    easy: ['+', '+', '-'],
    medium: ['+', '-', '×', '+'],
    hard: ['+', '-', '×', '÷'],
  };
  const range = { easy: [5, 20], medium: [12, 80], hard: [18, 200] }[difficulty] || [10, 60];
  const useCount = difficulty === 'easy' ? 2 : difficulty === 'hard' ? 3 : (Math.random() < 0.45 ? 3 : 2);
  for (let n = 0; n < 50; n += 1) {
    const tiles = shuffle(pools[difficulty] || pools.medium).slice(0, 5);
    const picked = shuffle(tiles).slice(0, useCount);
    const ops = opSets[difficulty];
    const tokens = [picked[0]];
    for (let i = 1; i < picked.length; i += 1) {
      tokens.push(ops[Math.floor(Math.random() * ops.length)], picked[i]);
    }
    try {
      const { value } = evalTargetExpression(tokens, tiles);
      if (value >= range[0] && value <= range[1] && value !== picked[0]) {
        return {
          tiles: shuffle(tiles),
          target: value,
          maxSteps: 5,
          difficulty,
          hint: `One path starts with ${picked[0]}.`,
        };
      }
    } catch {
      // try another mix
    }
  }
  return {
    tiles: [1, 2, 3, 4, 5],
    target: 10,
    maxSteps: 5,
    difficulty,
    hint: '5 × 2',
  };
}

function dealTargetMath(difficulty) {
  const diff = clampMathDifficulty(difficulty);
  const pool = shuffle(
    targetMathPuzzles().filter((p) => clampMathDifficulty(p.difficulty) === diff),
  );
  for (const raw of pool) {
    const next = normalizeMathPuzzle(raw, diff);
    if (next) return next;
  }
  return synthesizePuzzle(diff);
}

function generateTargetMath(difficulty) {
  return dealTargetMath(difficulty);
}

module.exports = {
  GAME_TYPES,
  packTier,
  pickWord,
  pickScribbleWord,
  listScribbleWords,
  listWords,
  listQuestions,
  dealQuestions,
  generateLetterSeed,
  wordSmithRounds,
  listWordSmithWords,
  dealWordSmith,
  canMakeWord,
  isValidWordSmithWord,
  wordScore,
  generateTargetMath,
  dealTargetMath,
  evalTargetExpression,
};
