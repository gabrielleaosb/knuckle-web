// knucklebones-bot.js
// Bot AI logic — completely isolated from the main game code.
//
// Only one function is meant to be called from outside:
//
//   botChooseColumn(myBoard, oppBoard, dieValue, difficulty)
//     returns the column index (0, 1 or 2) the bot wants to play in
//
// Parameters:
//   myBoard    — the bot's own 3x3 board (array of 3 columns, each with 3 slots)
//   oppBoard   — the board of the bot's direct opponent
//   dieValue   — the die that was already rolled (1–6)
//   difficulty — "easy" | "medium" | "hard"
//
// The function is pure: it doesn't read or write any global game variables,
// so it works the same in 1v1, 2v2, King of the Table, or any future mode.

const BOT_COLS = 3;
const BOT_ROWS = 3;


// ------------------------------------------------------------
// Public entry point
// ------------------------------------------------------------

function botChooseColumn(myBoard, oppBoard, dieValue, difficulty) {
  switch (difficulty) {
    case "easy": return _botEasy(myBoard);
    case "hard":  return _botHard(myBoard, oppBoard, dieValue);
    default:      return _botMedium(myBoard, oppBoard, dieValue);
  }
}


// ------------------------------------------------------------
// Easy — just pick a random open column, nothing fancy
// ------------------------------------------------------------

function _botEasy(myBoard) {
  const available = _availableCols(myBoard);
  return available[Math.floor(Math.random() * available.length)];
}


// ------------------------------------------------------------
// Medium — simple heuristic, scores each column by 3 things:
//   1. how much it increases the bot's own score
//   2. how many opponent dice it cancels (weighted by die value)
//   3. whether it completes or builds toward a triple multiplier
// ------------------------------------------------------------

function _botMedium(myBoard, oppBoard, dieValue) {
  const available = _availableCols(myBoard);
  let bestCol = available[0];
  let bestScore = -Infinity;

  for (const col of available) {
    let score = 0;

    // how much does placing here actually gain us?
    const simCol = [...myBoard[col]];
    const emptySlot = simCol.findIndex(r => r === null);
    simCol[emptySlot] = dieValue;
    score += _calcColScore(simCol) - _calcColScore(myBoard[col]);

    // bonus for wiping opponent dice — higher value die = bigger reward
    const cancelCount = oppBoard[col].filter(d => d === dieValue).length;
    score += cancelCount * dieValue * 1.5;

    // bonus for building a multiplier
    const sameInCol = myBoard[col].filter(d => d === dieValue).length;
    if (sameInCol === 2) score += dieValue * 4;
    else if (sameInCol === 1) score += dieValue;

    if (score > bestScore) {
      bestScore = score;
      bestCol = col;
    }
  }

  return bestCol;
}


// ------------------------------------------------------------
// Hard — minimax with 2-ply lookahead
// ------------------------------------------------------------

function _botHard(myBoard, oppBoard, dieValue) {
  const available = _availableCols(myBoard);
  let bestCol = available[0];
  let bestScore = -Infinity;

  for (const col of available) {
    const [simMine, simOpp] = _simulatePlace(myBoard, oppBoard, col, dieValue);
    const score = _minimax(simMine, simOpp, 2, false);

    if (score > bestScore) {
      bestScore = score;
      bestCol = col;
    }
  }

  return bestCol;
}

function _minimax(myBoard, oppBoard, depth, isMaximizing) {
  if (depth === 0 || _isBoardFull(myBoard) || _isBoardFull(oppBoard)) {
    return _calcTotalScore(myBoard) - _calcTotalScore(oppBoard);
  }

  if (isMaximizing) {
    const available = _availableCols(myBoard);
    if (!available.length) return _calcTotalScore(myBoard) - _calcTotalScore(oppBoard);

    let totalExpected = 0;
    for (let die = 1; die <= 6; die++) {
      let best = -Infinity;
      for (const col of available) {
        const [simMine, simOpp] = _simulatePlace(myBoard, oppBoard, col, die);
        const val = _minimax(simMine, simOpp, depth - 1, false);
        if (val > best) best = val;
      }
      totalExpected += best;
    }
    return totalExpected / 6;

  } else {
    const available = _availableCols(oppBoard);
    if (!available.length) return _calcTotalScore(myBoard) - _calcTotalScore(oppBoard);

    let totalExpected = 0;
    for (let die = 1; die <= 6; die++) {
      let worst = Infinity;
      for (const col of available) {
        const [simOpp, simMine] = _simulatePlace(oppBoard, myBoard, col, die);
        const val = _minimax(simMine, simOpp, depth - 1, true);
        if (val < worst) worst = val;
      }
      totalExpected += worst;
    }
    return totalExpected / 6;
  }
}


// ------------------------------------------------------------
// Internal helpers
// ------------------------------------------------------------

function _availableCols(board) {
  const cols = [];
  for (let i = 0; i < BOT_COLS; i++) {
    if (board[i].some(r => r === null)) cols.push(i);
  }
  return cols;
}

function _simulatePlace(boardA, boardB, col, dieValue) {
  const newA = boardA.map(c => [...c]);
  const newB = boardB.map(c => [...c]);

  const slot = newA[col].findIndex(r => r === null);
  if (slot !== -1) newA[col][slot] = dieValue;

  newB[col] = newB[col].map(d => d === dieValue ? null : d);
  _compactCol(newB[col]);

  return [newA, newB];
}

function _calcColScore(col) {
  const filled = col.filter(v => v !== null);
  if (!filled.length) return 0;

  const count = {};
  for (const v of filled) count[v] = (count[v] || 0) + 1;

  return Object.entries(count).reduce(
    (sum, [v, n]) => sum + parseInt(v) * n * n,
    0
  );
}

function _calcTotalScore(board) {
  return board.reduce((sum, col) => sum + _calcColScore(col), 0);
}

function _compactCol(col) {
  const values = col.filter(v => v !== null);
  for (let i = 0; i < BOT_ROWS; i++) {
    col[i] = values[i] ?? null;
  }
}

function _isBoardFull(board) {
  return board.every(col => col.every(cell => cell !== null));
}