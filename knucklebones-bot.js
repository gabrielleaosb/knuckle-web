/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              KNUCKLEBONES — LÓGICA DE BOT                    ║
 * ║                                                              ║
 * ║  API pública (única coisa que o jogo precisa chamar):        ║
 * ║                                                              ║
 * ║  botChooseColumn(myBoard, oppBoard, dieValue, difficulty)    ║
 * ║    → retorna índice da coluna (0, 1 ou 2)                    ║
 * ║                                                              ║
 * ║  Parâmetros:                                                 ║
 * ║    myBoard    — Array 3×3 do próprio bot (colunas × linhas)  ║
 * ║    oppBoard   — Array 3×3 do oponente direto do bot          ║
 * ║    dieValue   — Valor do dado já rolado (1–6)                ║
 * ║    difficulty — "easy" | "medium" | "hard"                   ║
 * ║                                                              ║
 * ║  A função é PURA: não lê nem escreve nenhuma variável        ║
 * ║  global do jogo. Pode ser usada em qualquer modo             ║
 * ║  (1v1, 2v2, Rei da Mesa) sem modificação.                    ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── Constantes (espelham o jogo principal) ─────────────────────
const BOT_COLS = 3;
const BOT_ROWS = 3;

// ══════════════════════════════════════════════════════════════
// PONTO DE ENTRADA ÚNICO
// ══════════════════════════════════════════════════════════════

/**
 * Escolhe a melhor coluna para o bot jogar.
 *
 * @param {Array}  myBoard    - Tabuleiro do bot  [[...],[...],[...]]
 * @param {Array}  oppBoard   - Tabuleiro do oponente direto
 * @param {number} dieValue   - Valor do dado (1–6)
 * @param {string} difficulty - "easy" | "medium" | "hard"
 * @returns {number} Índice da coluna escolhida (0, 1 ou 2)
 */
function botChooseColumn(myBoard, oppBoard, dieValue, difficulty) {
  switch (difficulty) {
    case "easy":   return _botEasy(myBoard);
    case "hard":   return _botHard(myBoard, oppBoard, dieValue);
    default:       return _botMedium(myBoard, oppBoard, dieValue); // "medium"
  }
}

// ══════════════════════════════════════════════════════════════
// DIFICULDADE FÁCIL
// Escolha completamente aleatória entre colunas disponíveis.
// Não tenta pontuar, não tenta cancelar — só não joga em
// coluna cheia.
// ══════════════════════════════════════════════════════════════

function _botEasy(myBoard) {
  const available = _availableCols(myBoard);
  // Pega uma coluna aleatória da lista de colunas não-cheias
  return available[Math.floor(Math.random() * available.length)];
}

// ══════════════════════════════════════════════════════════════
// DIFICULDADE MÉDIA
// Heurística baseada em três fatores por coluna:
//   1. Ganho de pontuação própria ao colocar o dado lá
//   2. Bônus por cancelar dados do oponente (dados iguais)
//   3. Bônus extra por estar construindo um multiplicador
//      (2 dados iguais já na coluna → colocar o 3º vale muito)
//
// Cada fator tem um peso diferente. A coluna com maior
// pontuação total é escolhida.
// ══════════════════════════════════════════════════════════════

function _botMedium(myBoard, oppBoard, dieValue) {
  const available = _availableCols(myBoard);
  let bestCol = available[0];
  let bestScore = -Infinity;

  for (const col of available) {
    let score = 0;

    // ── Fator 1: ganho de pontuação própria ──────────────────
    // Simula colocar o dado nessa coluna e calcula quanto a
    // pontuação da coluna aumenta.
    const simCol = [...myBoard[col]];
    const emptySlot = simCol.findIndex(r => r === null);
    simCol[emptySlot] = dieValue;
    const gainAfter  = _calcColScore(simCol);
    const gainBefore = _calcColScore(myBoard[col]);
    score += (gainAfter - gainBefore) * 1.0;

    // ── Fator 2: cancelar dados do oponente ──────────────────
    // Quantos dados iguais ao dado atual existem na mesma
    // coluna do oponente? Cada um cancelado vale o seu valor.
    const cancelCount = oppBoard[col].filter(d => d === dieValue).length;
    score += cancelCount * dieValue * 1.5;

    // ── Fator 3: progresso em direção a um multiplicador ─────
    // Se já há 2 dados iguais ao atual nessa coluna do bot,
    // colocar o 3º vai triplicar todos — isso vale muito.
    const sameInCol = myBoard[col].filter(d => d === dieValue).length;
    if (sameInCol === 2) score += dieValue * 4;      // fecha tripla!
    else if (sameInCol === 1) score += dieValue * 1; // está construindo

    if (score > bestScore) {
      bestScore = score;
      bestCol   = col;
    }
  }

  return bestCol;
}

// ══════════════════════════════════════════════════════════════
// DIFICULDADE DIFÍCIL
// Minimax com lookahead de 3 meios-turnos.
//
// Como o dado JÁ foi rolado antes da escolha de coluna,
// o espaço de busca é pequeno:
//   Turno bot  → max 3 colunas
//   Turno opp  → max 3 colunas × 6 valores de dado possíveis
//   Turno bot  → max 3 colunas
// = no pior caso ~162 nós por decisão → roda em < 1ms.
//
// A função de avaliação é:
//   score(botBoard) - score(oppBoard)
// O bot quer maximizar essa diferença.
// ══════════════════════════════════════════════════════════════

function _botHard(myBoard, oppBoard, dieValue) {
  const available = _availableCols(myBoard);
  let bestCol = available[0];
  let bestScore = -Infinity;

  for (const col of available) {
    // Simula a jogada do bot nessa coluna
    const [simMine, simOpp] = _simulatePlace(myBoard, oppBoard, col, dieValue);

    // Chama minimax como oponente (minimizando)
    const score = _minimax(
      simMine, simOpp,
      /*depth*/ 2,
      /*isMaximizing*/ false
    );

    if (score > bestScore) {
      bestScore = score;
      bestCol   = col;
    }
  }

  return bestCol;
}

/**
 * Minimax recursivo.
 * @param {Array}   myBoard       - Tabuleiro do bot
 * @param {Array}   oppBoard      - Tabuleiro do oponente
 * @param {number}  depth         - Profundidade restante
 * @param {boolean} isMaximizing  - true = turno do bot, false = turno do oponente
 * @returns {number} Pontuação estimada do estado
 */
function _minimax(myBoard, oppBoard, depth, isMaximizing) {
  // Condição de parada: profundidade zero ou tabuleiro cheio
  if (depth === 0 || _isBoardFull(myBoard) || _isBoardFull(oppBoard)) {
    return _calcTotalScore(myBoard) - _calcTotalScore(oppBoard);
  }

  if (isMaximizing) {
    // Turno do bot: tenta maximizar a diferença de pontuação.
    // Como não sabemos o dado futuro, testamos todos os 6 valores
    // e fazemos a média (valor esperado).
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
    // Retorna o valor esperado médio sobre todos os dados possíveis
    return totalExpected / 6;

  } else {
    // Turno do oponente: tenta minimizar a diferença (ou seja, maximizar
    // a pontuação dele em relação ao bot). Mesma lógica de valor esperado.
    const available = _availableCols(oppBoard);
    if (!available.length) return _calcTotalScore(myBoard) - _calcTotalScore(oppBoard);

    let totalExpected = 0;
    for (let die = 1; die <= 6; die++) {
      let worst = Infinity;
      for (const col of available) {
        // Aqui o oponente joga em oppBoard, e cancela dados de myBoard
        const [simOpp, simMine] = _simulatePlace(oppBoard, myBoard, col, die);
        const val = _minimax(simMine, simOpp, depth - 1, true);
        if (val < worst) worst = val;
      }
      totalExpected += worst;
    }
    return totalExpected / 6;
  }
}

// ══════════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES INTERNAS
// (todas puras — não modificam os arrays originais)
// ══════════════════════════════════════════════════════════════

/**
 * Retorna lista de índices de colunas que ainda têm espaço.
 */
function _availableCols(board) {
  const cols = [];
  for (let i = 0; i < BOT_COLS; i++) {
    if (board[i].some(r => r === null)) cols.push(i);
  }
  return cols;
}

/**
 * Simula colocar dieValue na coluna col do boardA,
 * cancelando dados iguais na mesma coluna do boardB.
 * Retorna cópias profundas dos dois tabuleiros modificados.
 * NÃO modifica os originais.
 */
function _simulatePlace(boardA, boardB, col, dieValue) {
  // Copia profunda dos dois tabuleiros
  const newA = boardA.map(c => [...c]);
  const newB = boardB.map(c => [...c]);

  // Coloca o dado na primeira posição vazia de boardA[col]
  const slot = newA[col].findIndex(r => r === null);
  if (slot !== -1) newA[col][slot] = dieValue;

  // Cancela dados iguais em boardB[col] (regra do jogo)
  newB[col] = newB[col].map(d => d === dieValue ? null : d);
  _compactCol(newB[col]);

  return [newA, newB];
}

/**
 * Calcula a pontuação de uma coluna.
 * Dados iguais multiplicam: n dados de valor v valem v × n²
 * Espelha calcColScore() do jogo principal.
 */
function _calcColScore(col) {
  const filled = col.filter(v => v !== null);
  if (!filled.length) return 0;

  // Conta quantos de cada valor existem
  const count = {};
  for (const v of filled) count[v] = (count[v] || 0) + 1;

  // Cada grupo: valor × quantidade²
  return Object.entries(count).reduce(
    (sum, [v, n]) => sum + parseInt(v) * n * n,
    0
  );
}

/**
 * Soma a pontuação de todas as colunas de um tabuleiro.
 */
function _calcTotalScore(board) {
  return board.reduce((sum, col) => sum + _calcColScore(col), 0);
}

/**
 * Remove os "buracos" (nulls) que ficam após cancelamentos,
 * compactando os dados para o início da coluna.
 * Espelha compactCol() do jogo principal.
 */
function _compactCol(col) {
  const values = col.filter(v => v !== null);
  for (let i = 0; i < BOT_ROWS; i++) {
    col[i] = values[i] ?? null;
  }
}

/**
 * Verifica se todas as posições do tabuleiro estão preenchidas.
 */
function _isBoardFull(board) {
  return board.every(col => col.every(cell => cell !== null));
}