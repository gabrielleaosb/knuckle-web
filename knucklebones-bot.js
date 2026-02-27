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
    // two matching dice already there means placing the third triples everything
    const sameInCol = myBoard[col].filter(d => d === dieValue).length;
    if (sameInCol === 2) score += dieValue * 4; // completing the triple is huge
    else if (sameInCol === 1) score += dieValue; // already started, keep it going

    if (score > bestScore) {
      bestScore = score;
      bestCol = col;
    }
  }

  return bestCol;
}


// ------------------------------------------------------------
// Hard — minimax with 2-ply lookahead
//
// The die is rolled before the column choice, so the branching
// factor is small (max 3 columns per turn). For the opponent's
// future turn we don't know the die value, so we average over
// all 6 possibilities (expected value). Worst case is around
// 162 nodes per decision, runs in under 1ms.
//
// Evaluation: bot's total score minus opponent's total score.
// The bot tries to maximize that difference.
// ------------------------------------------------------------

function _botHard(myBoard, oppBoard, dieValue) {
  const available = _availableCols(myBoard);
  let bestCol = available[0];
  let bestScore = -Infinity;

  for (const col of available) {
    const [simMine, simOpp] = _simulatePlace(myBoard, oppBoard, col, dieValue);

    // after our move, it's the opponent's turn — so we minimize from here
    const score = _minimax(simMine, simOpp, 2, false);

    if (score > bestScore) {
      bestScore = score;
      bestCol = col;
    }
  }

  return bestCol;
}

// recursive minimax
// isMaximizing = true means it's the bot's turn, false means opponent's turn
function _minimax(myBoard, oppBoard, depth, isMaximizing) {
  if (depth === 0 || _isBoardFull(myBoard) || _isBoardFull(oppBoard)) {
    return _calcTotalScore(myBoard) - _calcTotalScore(oppBoard);
  }

  if (isMaximizing) {
    const available = _availableCols(myBoard);
    if (!available.length) return _calcTotalScore(myBoard) - _calcTotalScore(oppBoard);

    // we don't know the next die, so average best play over all 6 values
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

    // same idea but opponent is trying to minimize our advantage
    let totalExpected = 0;
    for (let die = 1; die <= 6; die++) {
      let worst = Infinity;
      for (const col of available) {
        // opponent plays on their board and cancels our dice
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
// Internal helpers — all pure, never mutate the original arrays
// ------------------------------------------------------------

// returns the indices of columns that still have at least one open slot
function _availableCols(board) {
  const cols = [];
  for (let i = 0; i < BOT_COLS; i++) {
    if (board[i].some(r => r === null)) cols.push(i);
  }
  return cols;
}

// simulates placing dieValue in boardA[col] and canceling matching dice in boardB[col]
// returns deep copies of both boards — originals are untouched
function _simulatePlace(boardA, boardB, col, dieValue) {
  const newA = boardA.map(c => [...c]);
  const newB = boardB.map(c => [...c]);

  const slot = newA[col].findIndex(r => r === null);
  if (slot !== -1) newA[col][slot] = dieValue;

  // game rule: placing a die removes all matching dice from the same column on the opponent's board
  newB[col] = newB[col].map(d => d === dieValue ? null : d);
  _compactCol(newB[col]);

  return [newA, newB];
}

// column score: duplicate dice multiply — n dice of value v are worth v * n^2
// mirrors calcColScore() in the main game
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

// total score across all columns
function _calcTotalScore(board) {
  return board.reduce((sum, col) => sum + _calcColScore(col), 0);
}

// after a cancellation there are gaps (nulls) in the middle of a column
// this shifts all remaining dice down to fill them, same as the main game
function _compactCol(col) {
  const values = col.filter(v => v !== null);
  for (let i = 0; i < BOT_ROWS; i++) {
    col[i] = values[i] ?? null;
  }
}

// checks if every slot on the board is filled
function _isBoardFull(board) {
  return board.every(col => col.every(cell => cell !== null));
}