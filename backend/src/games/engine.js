const {
  pickWord,
  pickScribbleWord,
  dealQuestions,
  dealWordSmith,
  isValidWordSmithWord,
  wordScore,
  generateTargetMath,
  evalTargetExpression,
} = require('./content');

function maskWord(word, revealed) {
  const set = new Set((revealed || []).map((c) => c.toUpperCase()));
  return String(word || '')
    .toUpperCase()
    .split('')
    .map((ch) => (ch === ' ' ? ' ' : set.has(ch) ? ch : '_'))
    .join(' ');
}

function hangmanWon(word, revealed) {
  const letters = String(word || '').toUpperCase().replace(/[^A-Z]/g, '');
  const set = new Set((revealed || []).map((c) => c.toUpperCase()));
  return [...letters].every((ch) => set.has(ch));
}

function tttWinner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  if (board.every(Boolean)) return 'DRAW';
  return null;
}

const WORD_SMITH_TIMES = [30, 45, 60, 90, 120];

function clampWordSmithTime(n) {
  const v = Number(n);
  return WORD_SMITH_TIMES.includes(v) ? v : 60;
}

function createSeedAndState(gameType, level, options = {}) {
  if (gameType === 'HANGMAN') {
    const item = options.word
      ? { word: String(options.word).toUpperCase().replace(/[^A-Z ]/g, ''), hint: options.hint || '', subject: options.subject || 'Custom' }
      : pickWord(level, options.subject);
    const word = item.word.toUpperCase();
    return {
      seed: { subject: item.subject, hint: item.hint },
      state: {
        word,
        hint: item.hint,
        hintUsed: false,
        revealedLetters: [],
        remainingLives: 6,
        wrongLetters: [],
      },
      turn: 'GUEST',
    };
  }

  if (gameType === 'KNOWLEDGE_TOWER') {
    const questions = dealQuestions(level, 40);
    return {
      seed: { questions },
      state: {
        roundNumber: 1,
        turnIndex: 0,
        player1Floors: 0,
        player2Floors: 0,
        answersThisTurn: 0,
        turnStartedAt: null,
        currentQuestionIndex: 0,
      },
      turn: 'HOST',
    };
  }

  if (gameType === 'WORD_SMITH') {
    const durationSec = clampWordSmithTime(options.durationSec);
    const dealt = options.wordSmith && options.wordSmith.letterSeed
      ? options.wordSmith
      : dealWordSmith();
    const letterSeed = String(dealt.letterSeed || '').toUpperCase();
    const answers = Array.isArray(dealt.answers) ? dealt.answers : [];
    const pangram = String(dealt.pangram || '').toUpperCase();
    return {
      seed: { letterSeed, durationSec, answers, pangram },
      state: {
        letterSeed,
        durationSec,
        answers,
        pangram,
        host: { submittedWords: [], totalScore: 0, finished: false, timeMs: null },
        guest: { submittedWords: [], totalScore: 0, finished: false, timeMs: null },
      },
      turn: 'HOST',
    };
  }

  if (gameType === 'TIC_TAC_TRIVIA') {
    const questions = dealQuestions(level, 36, options.subject);
    return {
      seed: { questions, subject: options.subject || 'All' },
      state: {
        board: Array(9).fill(null),
        questionCursor: 0,
        pendingCell: null,
        currentQuestion: null,
        lastQuestionResult: null,
        subject: options.subject || 'All',
      },
      turn: 'HOST',
    };
  }

  if (gameType === 'TARGET_MATH') {
    const durationSec = [0, 30, 45, 60].includes(Number(options.durationSec))
      ? Number(options.durationSec)
      : 60;
    const puzzle = generateTargetMath(options.difficulty);
    return {
      seed: {
        tiles: puzzle.tiles,
        target: puzzle.target,
        maxSteps: puzzle.maxSteps,
        difficulty: puzzle.difficulty,
        hint: puzzle.hint,
        durationSec,
      },
      state: {
        numberTiles: puzzle.tiles,
        targetValue: puzzle.target,
        maxSteps: puzzle.maxSteps,
        difficulty: puzzle.difficulty,
        hint: puzzle.hint,
        durationSec,
        host: { expression: null, steps: null, timeMs: null, value: null, hit: false },
        guest: { expression: null, steps: null, timeMs: null, value: null, hit: false },
      },
      turn: 'HOST',
    };
  }

  if (gameType === 'SCRIBBLE') {
    const item = pickScribbleWord(level, options.subject);
    return {
      seed: { subject: item.subject },
      state: {
        targetWord: item.word.toUpperCase(),
        hint: item.hint,
        subject: item.subject,
        pathCoordinates: [],
        guessHistory: [],
        isGuessed: false,
        drawingSubmitted: false,
      },
      turn: 'HOST',
    };
  }

  throw new Error('Unknown game type');
}

function currentQuestion(match) {
  const qs = match.seed?.questions || [];
  const idx = match.state.currentQuestionIndex ?? match.state.questionCursor ?? 0;
  return qs[idx] || null;
}

function otherTurn(turn) {
  return turn === 'HOST' ? 'GUEST' : 'HOST';
}

function applyAction(match, actor, action) {
  const { type, payload = {} } = action || {};
  const isHost = actor === 'HOST';
  const state = JSON.parse(JSON.stringify(match.state));
  let { turn, status, winnerStudentId } = match;
  const hostId = match.hostStudentId;
  const guestId = match.guestStudentId;

  if (status === 'FINISHED') {
    const err = new Error('Match already finished');
    err.status = 400;
    throw err;
  }

  if (match.gameType === 'HANGMAN') {
    if (actor !== 'GUEST') {
      const err = new Error('Only the joining player guesses');
      err.status = 403;
      throw err;
    }
    if (type === 'USE_HINT') {
      state.hintUsed = true;
    } else if (type === 'GUESS_LETTER') {
      const letter = String(payload.letter || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1);
      if (!letter) {
        const err = new Error('Letter required');
        err.status = 400;
        throw err;
      }
      if (state.revealedLetters.includes(letter) || state.wrongLetters.includes(letter)) {
        const err = new Error('Letter already guessed');
        err.status = 400;
        throw err;
      }
      if (state.word.includes(letter)) {
        state.revealedLetters.push(letter);
      } else {
        state.wrongLetters.push(letter);
        state.remainingLives -= 1;
      }
      if (hangmanWon(state.word, state.revealedLetters)) {
        status = 'FINISHED';
        winnerStudentId = guestId;
      } else if (state.remainingLives <= 0) {
        status = 'FINISHED';
        winnerStudentId = hostId;
      }
    } else {
      const err = new Error('Unknown action');
      err.status = 400;
      throw err;
    }
  }

  else if (match.gameType === 'KNOWLEDGE_TOWER') {
    if (actor !== turn) {
      const err = new Error('Not your turn');
      err.status = 403;
      throw err;
    }
    if (type === 'START_TURN') {
      if (!state.turnStartedAt) state.turnStartedAt = Date.now();
      state.answersThisTurn = state.answersThisTurn || 0;
    } else if (type === 'SUBMIT_ANSWER') {
      const q = currentQuestion({ ...match, state });
      if (!q) {
        const err = new Error('No question');
        err.status = 400;
        throw err;
      }
      const correct = Number(payload.choiceIndex) === q.answerIndex;
      if (correct) {
        if (isHost) state.player1Floors += 1;
        else state.player2Floors += 1;
      }
      state.answersThisTurn += 1;
      state.currentQuestionIndex = (state.currentQuestionIndex || 0) + 1;
      const elapsed = state.turnStartedAt ? Date.now() - state.turnStartedAt : 0;
      if (state.answersThisTurn >= 5 || elapsed >= 45000) {
        return finishTowerTurn(match, state, actor);
      }
    } else if (type === 'END_TURN') {
      return finishTowerTurn(match, state, actor);
    } else {
      const err = new Error('Unknown action');
      err.status = 400;
      throw err;
    }
  }

  else if (match.gameType === 'WORD_SMITH') {
    const bucket = isHost ? state.host : state.guest;
    if (bucket.finished) {
      const err = new Error('Turn already submitted');
      err.status = 400;
      throw err;
    }
    if (type === 'SUBMIT_WORD') {
      const word = String(payload.word || '').toUpperCase().replace(/[^A-Z]/g, '');
      if (!isValidWordSmithWord(word, state.letterSeed, match.seed?.answers || state.answers)) {
        const err = new Error('Not a valid word for these tiles');
        err.status = 400;
        throw err;
      }
      if (bucket.submittedWords.includes(word)) {
        const err = new Error('Word already used');
        err.status = 400;
        throw err;
      }
      bucket.submittedWords.push(word);
      bucket.totalScore += wordScore(word);
    } else if (type === 'FINISH_TURN') {
      const incoming = Array.isArray(payload.words) ? payload.words : [];
      for (const raw of incoming) {
        const word = String(raw || '').toUpperCase().replace(/[^A-Z]/g, '');
        if (!word || bucket.submittedWords.includes(word)) continue;
        if (!isValidWordSmithWord(word, state.letterSeed, match.seed?.answers || state.answers)) continue;
        bucket.submittedWords.push(word);
        bucket.totalScore += wordScore(word);
      }
      bucket.finished = true;
      bucket.timeMs = Number(payload.timeMs) || 0;
      if (!state.host.finished) turn = 'HOST';
      else if (!state.guest.finished) turn = 'GUEST';
      if (state.host.finished && state.guest.finished) {
        status = 'FINISHED';
        if (state.host.totalScore > state.guest.totalScore) winnerStudentId = hostId;
        else if (state.guest.totalScore > state.host.totalScore) winnerStudentId = guestId;
        else winnerStudentId = null;
      }
    } else {
      const err = new Error('Unknown action');
      err.status = 400;
      throw err;
    }
  }

  else if (match.gameType === 'TIC_TAC_TRIVIA') {
    if (actor !== turn) {
      const err = new Error('Not your turn');
      err.status = 403;
      throw err;
    }
    const mark = isHost ? 'X' : 'O';
    if (type === 'SELECT_CELL') {
      const index = Number(payload.index);
      if (index < 0 || index > 8 || state.board[index]) {
        const err = new Error('Invalid cell');
        err.status = 400;
        throw err;
      }
      const qs = match.seed.questions || [];
      const q = qs[state.questionCursor % Math.max(qs.length, 1)];
      if (!q) {
        const err = new Error('No questions left');
        err.status = 400;
        throw err;
      }
      state.pendingCell = index;
      state.lastQuestionResult = null;
      state.currentQuestion = {
        id: q.id,
        prompt: q.prompt,
        choices: q.choices,
        subject: q.subject,
        answerIndex: q.answerIndex,
      };
    } else if (type === 'ANSWER') {
      if (state.pendingCell == null || !state.currentQuestion) {
        const err = new Error('Select a cell first');
        err.status = 400;
        throw err;
      }
      const correct = Number(payload.choiceIndex) === state.currentQuestion.answerIndex;
      state.lastQuestionResult = { correct, cell: state.pendingCell, player: actor };
      if (correct) state.board[state.pendingCell] = mark;
      state.pendingCell = null;
      state.currentQuestion = null;
      state.questionCursor += 1;
      const win = tttWinner(state.board);
      if (win === 'X') {
        status = 'FINISHED';
        winnerStudentId = hostId;
      } else if (win === 'O') {
        status = 'FINISHED';
        winnerStudentId = guestId;
      } else if (win === 'DRAW') {
        status = 'FINISHED';
        winnerStudentId = null;
      } else {
        turn = otherTurn(turn);
      }
    } else {
      const err = new Error('Unknown action');
      err.status = 400;
      throw err;
    }
  }

  else if (match.gameType === 'TARGET_MATH') {
    const bucket = isHost ? state.host : state.guest;
    if (bucket.expression) {
      const err = new Error('Solution already submitted');
      err.status = 400;
      throw err;
    }
    if (type !== 'SUBMIT_SOLUTION') {
      const err = new Error('Unknown action');
      err.status = 400;
      throw err;
    }
    const tokens = payload.tokens;
    if (!Array.isArray(tokens)) {
      const err = new Error('Expression required');
      err.status = 400;
      throw err;
    }
    if (!tokens.length) {
      bucket.expression = [];
      bucket.steps = 99;
      bucket.timeMs = Number(payload.timeMs) || 0;
      bucket.value = null;
      bucket.hit = false;
    } else {
      let result;
      try {
        result = evalTargetExpression(tokens, state.numberTiles);
      } catch {
        const err = new Error('Invalid solution');
        err.status = 400;
        throw err;
      }
      bucket.expression = tokens;
      bucket.steps = result.steps;
      bucket.timeMs = Number(payload.timeMs) || 0;
      bucket.value = result.value;
      bucket.hit = result.value === state.targetValue;
    }
    if (!state.host.expression) turn = 'HOST';
    else if (!state.guest.expression) turn = 'GUEST';
    if (state.host.expression && state.guest.expression) {
      status = 'FINISHED';
      winnerStudentId = decideMathWinner(state, hostId, guestId);
    }
  }

  else if (match.gameType === 'SCRIBBLE') {
    if (type === 'SUBMIT_DRAWING') {
      if (actor !== 'HOST') {
        const err = new Error('Host draws first');
        err.status = 403;
        throw err;
      }
      const paths = Array.isArray(payload.pathCoordinates) ? payload.pathCoordinates : [];
      state.pathCoordinates = simplifyPaths(paths);
      state.drawingSubmitted = true;
      turn = 'GUEST';
    } else if (type === 'GUESS') {
      if (actor !== 'GUEST') {
        const err = new Error('Guest guesses');
        err.status = 403;
        throw err;
      }
      if (!state.drawingSubmitted) {
        const err = new Error('Waiting for drawing');
        err.status = 400;
        throw err;
      }
      const guess = String(payload.text || '').toUpperCase().replace(/[^A-Z]/g, '');
      const target = String(state.targetWord || '').toUpperCase().replace(/[^A-Z]/g, '');
      if (!guess) {
        const err = new Error('Guess required');
        err.status = 400;
        throw err;
      }
      state.guessHistory.push(guess);
      if (guess === target) {
        state.isGuessed = true;
        status = 'FINISHED';
        winnerStudentId = guestId;
      } else if (state.guessHistory.length >= 5) {
        status = 'FINISHED';
        winnerStudentId = hostId;
      }
    } else {
      const err = new Error('Unknown action');
      err.status = 400;
      throw err;
    }
  }

  return { state, turn, status, winnerStudentId };
}

function finishTowerTurn(match, state, actor) {
  const hostId = match.hostStudentId;
  const guestId = match.guestStudentId;
  state.turnIndex = (state.turnIndex || 0) + 1;
  state.answersThisTurn = 0;
  state.turnStartedAt = null;
  state.roundNumber = Math.floor(state.turnIndex / 2) + 1;
  if (state.turnIndex >= 6) {
    let winnerStudentId = null;
    if (state.player1Floors > state.player2Floors) winnerStudentId = hostId;
    else if (state.player2Floors > state.player1Floors) winnerStudentId = guestId;
    return { state, turn: actor, status: 'FINISHED', winnerStudentId };
  }
  const turn = state.turnIndex % 2 === 0 ? 'HOST' : 'GUEST';
  return { state, turn, status: 'ACTIVE', winnerStudentId: null };
}

function decideMathWinner(state, hostId, guestId) {
  const score = (b) => {
    if (!b.hit) return { ok: 0, steps: 99, time: 9e12 };
    return { ok: 1, steps: b.steps, time: b.timeMs };
  };
  const h = score(state.host);
  const g = score(state.guest);
  if (h.ok !== g.ok) return h.ok > g.ok ? hostId : guestId;
  if (!h.ok && !g.ok) return null;
  if (h.steps !== g.steps) return h.steps < g.steps ? hostId : guestId;
  if (h.time !== g.time) return h.time < g.time ? hostId : guestId;
  return null;
}

function simplifyPaths(paths) {
  return (paths || []).slice(0, 48).map((stroke) => {
    const pts = Array.isArray(stroke?.points) ? stroke.points : (Array.isArray(stroke) ? stroke : []);
    const slim = [];
    for (const p of pts) {
      if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') continue;
      const pt = {
        x: Math.max(0, Math.min(1, p.x)),
        y: Math.max(0, Math.min(1, p.y)),
      };
      const prev = slim[slim.length - 1];
      if (!prev || Math.hypot(pt.x - prev.x, pt.y - prev.y) > 0.003) slim.push(pt);
      if (slim.length >= 400) break;
    }
    return {
      color: String(stroke?.color || '#1B4480'),
      width: Math.max(2, Math.min(10, Number(stroke?.width) || 4)),
      points: slim,
    };
  }).filter((s) => s.points.length > 1);
}

function sanitizeMatch(match, viewerStudentId) {
  const role = match.hostStudentId === viewerStudentId ? 'HOST' : 'GUEST';
  const state = JSON.parse(JSON.stringify(match.state || {}));
  const seed = JSON.parse(JSON.stringify(match.seed || {}));

  if (match.gameType === 'HANGMAN') {
    const word = state.word;
    state.maskedWord = maskWord(word, state.revealedLetters);
    state.hintText = state.hintUsed ? state.hint : null;
    if (role === 'GUEST' && match.status !== 'FINISHED') delete state.word;
  }

  if (match.gameType === 'KNOWLEDGE_TOWER' || match.gameType === 'TIC_TAC_TRIVIA') {
    const q = match.gameType === 'KNOWLEDGE_TOWER'
      ? (seed.questions || [])[state.currentQuestionIndex || 0]
      : state.currentQuestion;
    if (match.gameType === 'KNOWLEDGE_TOWER') {
      state.currentQuestion = q
        ? { id: q.id, prompt: q.prompt, choices: q.choices, subject: q.subject }
        : null;
    } else if (state.currentQuestion) {
      const { answerIndex, ...rest } = state.currentQuestion;
      state.currentQuestion = match.turn === role ? rest : null;
    }
    delete seed.questions;
  }

  if (match.gameType === 'SCRIBBLE') {
    if (role === 'GUEST' && match.status !== 'FINISHED') {
      delete state.targetWord;
    }
  }

  return {
    id: match.id,
    code: match.code,
    gameType: match.gameType,
    status: match.status,
    turn: match.turn,
    hostStudentId: match.hostStudentId,
    guestStudentId: match.guestStudentId,
    hostName: match.hostName,
    guestName: match.guestName,
    winnerStudentId: match.winnerStudentId,
    role,
    seed,
    state,
    updatedAt: match.updatedAt,
  };
}

module.exports = {
  createSeedAndState,
  applyAction,
  sanitizeMatch,
  maskWord,
};
