const EMPTY = 0
const WHITE = 1
const BLACK = 2
const BURNED = 3

const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
]

const INF = 1e9

const getOpponent = (player) => (player === WHITE ? BLACK : WHITE)

const inBounds = (size, r, c) => r >= 0 && r < size && c >= 0 && c < size

const getPieces = (board, player) => {
  const out = []
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board.length; c++) {
      if (board[r][c] === player) out.push({ r, c })
    }
  }
  return out
}

const getQueenRays = (board, fromR, fromC) => {
  const size = board.length
  const squares = []
  for (const [dr, dc] of DIRECTIONS) {
    let r = fromR + dr
    let c = fromC + dc
    while (inBounds(size, r, c) && board[r][c] === EMPTY) {
      squares.push({ r, c })
      r += dr
      c += dc
    }
  }
  return squares
}

const getArrowRays = (board, fromR, fromC, ignoreR, ignoreC) => {
  const size = board.length
  const squares = []
  for (const [dr, dc] of DIRECTIONS) {
    let r = fromR + dr
    let c = fromC + dc
    while (inBounds(size, r, c) && (board[r][c] === EMPTY || (r === ignoreR && c === ignoreC))) {
      squares.push({ r, c })
      r += dr
      c += dc
    }
  }
  return squares
}

const applyMoveInline = (board, move, player) => {
  board[move.from.r][move.from.c] = EMPTY
  board[move.to.r][move.to.c] = player
  board[move.arrow.r][move.arrow.c] = BURNED
}

const undoMoveInline = (board, move, player) => {
  board[move.arrow.r][move.arrow.c] = EMPTY
  board[move.to.r][move.to.c] = EMPTY
  board[move.from.r][move.from.c] = player
  // Edge case: arrow is on the from square
  if (move.arrow.r === move.from.r && move.arrow.c === move.from.c) {
    board[move.from.r][move.from.c] = player
  }
}

// Optimization: generate moves directly without clones
const generateMoves = (board, player, beamPerPiece = 25) => {
  const pieces = getPieces(board, player)
  const moves = []
  const size = board.length

  for (const piece of pieces) {
    const pieceMoves = []
    const destinations = getQueenRays(board, piece.r, piece.c)

    for (const destination of destinations) {
      const arrows = getArrowRays(board, destination.r, destination.c, piece.r, piece.c)
      for (const arrow of arrows) {
        pieceMoves.push({
          from: { r: piece.r, c: piece.c },
          to: { r: destination.r, c: destination.c },
          arrow: { r: arrow.r, c: arrow.c },
        })
      }
    }

    if (pieceMoves.length > beamPerPiece) {
      pieceMoves.sort((a, b) => {
        // Quick heuristic to sort moves: favor moves closer to the center
        const aCenter = Math.abs(a.to.r - size / 2) + Math.abs(a.to.c - size / 2)
        const bCenter = Math.abs(b.to.r - size / 2) + Math.abs(b.to.c - size / 2)
        return aCenter - bCenter
      })
      moves.push(...pieceMoves.slice(0, beamPerPiece))
    } else {
      moves.push(...pieceMoves)
    }
  }

  return moves
}

const queenDistanceMap = (board, player) => {
  const size = board.length
  const dist = Array.from({ length: size }, () => Array(size).fill(INF))
  const queue = []

  const pieces = getPieces(board, player)
  for (const p of pieces) {
    dist[p.r][p.c] = 0
    queue.push({ r: p.r, c: p.c })
  }

  let head = 0
  while (head < queue.length) {
    const { r, c } = queue[head]
    head += 1

    const nextDistance = dist[r][c] + 1
    for (const [dr, dc] of DIRECTIONS) {
      let rr = r + dr
      let cc = c + dc

      while (inBounds(size, rr, cc) && board[rr][cc] === EMPTY) {
        if (dist[rr][cc] > nextDistance) {
          dist[rr][cc] = nextDistance
          queue.push({ r: rr, c: cc })
        }
        rr += dr
        cc += dc
      }
    }
  }

  return dist
}

const mobilityScore = (board, player) => {
  const pieces = getPieces(board, player)
  let score = 0
  for (const p of pieces) {
    score += getQueenRays(board, p.r, p.c).length
  }
  return score
}

const evaluate = (board, maxPlayer) => {
  const opponent = getOpponent(maxPlayer)

  const distMax = queenDistanceMap(board, maxPlayer)
  const distOpp = queenDistanceMap(board, opponent)

  let territory = 0
  let reach = 0

  for (let r = 0; r < board.length; r += 1) {
    for (let c = 0; c < board.length; c += 1) {
      if (board[r][c] !== EMPTY) continue

      const a = distMax[r][c]
      const b = distOpp[r][c]

      if (a < b) territory += 1
      if (b < a) territory -= 1

      if (a < INF) reach += 1 / (a + 1)
      if (b < INF) reach -= 1 / (b + 1)
    }
  }

  const mobility = mobilityScore(board, maxPlayer) - mobilityScore(board, opponent)

  return territory * 35 + mobility * 8 + reach * 6
}

// ==== Zobrist and TT ====
const ZOBRIST = { table: [], initialized: false }
const initZobrist = (size) => {
  if (ZOBRIST.initialized && ZOBRIST.table.length === size) return
  ZOBRIST.table = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => [
      0,
      Math.random() * 0x100000000 | 0,
      Math.random() * 0x100000000 | 0,
      Math.random() * 0x100000000 | 0
    ])
  )
  ZOBRIST.playerTurn = Math.random() * 0x100000000 | 0
  ZOBRIST.initialized = true
}

const computeHash = (board, player) => {
  let h = 0
  initZobrist(board.length)
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board.length; c++) {
      h ^= ZOBRIST.table[r][c][board[r][c]]
    }
  }
  if (player === BLACK) h ^= ZOBRIST.playerTurn
  return h
}

const updateHash = (hash, move, beforePlayer) => {
  let h = hash
  h ^= ZOBRIST.playerTurn // Switch turn

  h ^= ZOBRIST.table[move.from.r][move.from.c][beforePlayer]
  h ^= ZOBRIST.table[move.to.r][move.to.c][EMPTY]

  if (move.arrow.r === move.from.r && move.arrow.c === move.from.c) {
    h ^= ZOBRIST.table[move.from.r][move.from.c][BURNED]
    h ^= ZOBRIST.table[move.to.r][move.to.c][beforePlayer]
  } else {
    h ^= ZOBRIST.table[move.from.r][move.from.c][EMPTY]
    h ^= ZOBRIST.table[move.to.r][move.to.c][beforePlayer]
    h ^= ZOBRIST.table[move.arrow.r][move.arrow.c][EMPTY]
    h ^= ZOBRIST.table[move.arrow.r][move.arrow.c][BURNED]
  }
  return h
}

const TT = new Map()
const FLAG_EXACT = 0
const FLAG_LOWERBOUND = 1
const FLAG_UPPERBOUND = 2

const isSameMove = (a, b) => {
  if (!a || !b) return false
  return a.from.r === b.from.r && a.from.c === b.from.c &&
         a.to.r === b.to.r && a.to.c === b.to.c &&
         a.arrow.r === b.arrow.r && a.arrow.c === b.arrow.c
}

// ==== Search ====

const minimax = (board, currentPlayer, maxPlayer, depth, alpha, beta, deadline, stats, hash) => {
  stats.nodes += 1

  if (Date.now() >= deadline) {
    return { score: 0, timedOut: true }
  }

  // TT Check
  const ttEntry = TT.get(hash)
  let pvMove = null
  if (ttEntry && ttEntry.depth >= depth) {
    if (ttEntry.flag === FLAG_EXACT) {
      return { score: ttEntry.score, timedOut: false, move: ttEntry.move }
    } else if (ttEntry.flag === FLAG_LOWERBOUND && ttEntry.score > alpha) {
      alpha = ttEntry.score
    } else if (ttEntry.flag === FLAG_UPPERBOUND && ttEntry.score < beta) {
      beta = ttEntry.score
    }
    if (alpha >= beta) {
      stats.cutoffs += 1
      return { score: ttEntry.score, timedOut: false, move: ttEntry.move }
    }
  }
  if (ttEntry) {
    pvMove = ttEntry.move
  }

  if (depth === 0) {
    stats.evaluations += 1
    const score = evaluate(board, maxPlayer)
    // Evaluate is a terminal node score, don't store in TT unless you want perfectly clean leaf eval cache,
    // but typically no move is returned. Let's store it anyway for transpositions.
    TT.set(hash, { depth: 0, flag: FLAG_EXACT, score, move: null })
    return { score, timedOut: false }
  }

  // Narrow beam slightly at deeper depths to allow further search.
  const beam = depth >= 3 ? 12 : 22
  const rawMoves = generateMoves(board, currentPlayer, beam)
  
  if (rawMoves.length === 0) {
    const isMaxSide = (currentPlayer === maxPlayer)
    return { score: isMaxSide ? -100000 : 100000, timedOut: false }
  }

  // Only run an in-depth heuristic order on the top node if we are shallow,
  // otherwise just put the PV move first.
  let moves = rawMoves
  if (pvMove) {
    const pvIndex = moves.findIndex((m) => isSameMove(m, pvMove))
    if (pvIndex !== -1) {
      moves.splice(pvIndex, 1)
      moves.unshift(pvMove)
    }
  }

  const maximizing = (currentPlayer === maxPlayer)
  let bestVal = maximizing ? -INF : INF
  let bestMove = moves[0]
  const originalAlpha = alpha

  for (const move of moves) {
    const nextHash = updateHash(hash, move, currentPlayer)
    applyMoveInline(board, move, currentPlayer)
    
    // We pass -beta and -alpha... NO wait, my minimax uses maximizing flag, not negamax!
    const child = minimax(board, getOpponent(currentPlayer), maxPlayer, depth - 1, alpha, beta, deadline, stats, nextHash)
    
    undoMoveInline(board, move, currentPlayer)

    if (child.timedOut) return { score: bestVal, timedOut: true }

    if (maximizing) {
      if (child.score > bestVal) {
        bestVal = child.score
        bestMove = move
      }
      if (bestVal > alpha) alpha = bestVal
      if (beta <= alpha) {
        stats.cutoffs += 1
        break
      }
    } else {
      if (child.score < bestVal) {
        bestVal = child.score
        bestMove = move
      }
      if (bestVal < beta) beta = bestVal
      if (beta <= alpha) {
        stats.cutoffs += 1
        break
      }
    }
  }

  let flag = FLAG_EXACT
  if (bestVal <= originalAlpha && maximizing) flag = FLAG_UPPERBOUND // wait, it's alpha for maximizing
  // Normal exact bounds logic:
  if (maximizing && bestVal <= originalAlpha) flag = FLAG_UPPERBOUND
  if (maximizing && bestVal >= beta) flag = FLAG_LOWERBOUND
  if (!maximizing && bestVal <= alpha) flag = FLAG_LOWERBOUND // Lower score, lower alphabeta bound
  if (!maximizing && bestVal >= originalAlpha && bestVal <= beta) flag = FLAG_EXACT // Not correct, let's simplify flags:

  // Proper AlphaBeta bounds:
  if (bestVal <= originalAlpha) flag = maximizing ? FLAG_UPPERBOUND : FLAG_LOWERBOUND
  else if (bestVal >= beta) flag = maximizing ? FLAG_LOWERBOUND : FLAG_UPPERBOUND
  else flag = FLAG_EXACT

  TT.set(hash, {
    depth,
    flag,
    score: bestVal,
    move: bestMove,
  })

  return { score: bestVal, timedOut: false, move: bestMove }
}

export const findBestMoveMax = (board, aiPlayer, options = {}) => {
  const maxDepth = options.maxDepth ?? 5 // Increased possible max depth due to TT and no allocations
  const timeMs = options.timeMs ?? 1700
  const returnAnalysis = options.returnAnalysis ?? false
  const deadline = Date.now() + timeMs
  const stats = { nodes: 0, evaluations: 0, cutoffs: 0 }

  if (TT.size > 1000000) TT.clear() // Prevent memory leak

  initZobrist(board.length)
  let currentHash = computeHash(board, aiPlayer)

  // Use a mutatable copy for the entire search! (one allocation)
  const searchBoard = board.map(row => [...row])

  let bestMove = null
  let bestScore = -INF
  let depthReached = 0
  let topCandidates = []

  let iterativeBestMove = null

  // Fast initial shallow evaluation to ensure we have a fallback move immediately
  // and we also sort the root moves by score.
  let rootMoves = generateMoves(searchBoard, aiPlayer, 28)
  if (!rootMoves.length) return null

  // Evaluate directly once for ordering root
  const scoredMoves = rootMoves.map(move => {
    applyMoveInline(searchBoard, move, aiPlayer)
    const score = evaluate(searchBoard, aiPlayer)
    undoMoveInline(searchBoard, move, aiPlayer)
    return { move, score }
  })
  scoredMoves.sort((a,b) => b.score - a.score)
  rootMoves = scoredMoves.map(item => item.move)
  
  bestMove = rootMoves[0]

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    if (Date.now() >= deadline) break

    // Push PV move to front
    if (iterativeBestMove) {
      const idx = rootMoves.findIndex(m => isSameMove(m, iterativeBestMove))
      if (idx !== -1) {
        rootMoves.splice(idx, 1)
        rootMoves.unshift(iterativeBestMove)
      }
    }

    let roundBestMove = rootMoves[0]
    let roundBestScore = -INF
    let timedOut = false
    const roundCandidates = []

    // Alpha-beta on root
    let alpha = -INF
    let beta = INF

    for (const move of rootMoves) {
      if (Date.now() >= deadline) {
        timedOut = true
        break
      }

      const nextHash = updateHash(currentHash, move, aiPlayer)
      applyMoveInline(searchBoard, move, aiPlayer)
      
      const child = minimax(searchBoard, getOpponent(aiPlayer), aiPlayer, depth - 1, alpha, beta, deadline, stats, nextHash)
      
      undoMoveInline(searchBoard, move, aiPlayer)

      if (child.timedOut) {
        timedOut = true
        break
      }

      roundCandidates.push({ move, score: child.score })

      if (child.score > roundBestScore) {
        roundBestScore = child.score
        roundBestMove = move
      }
      
      if (roundBestScore > alpha) {
        alpha = roundBestScore
      }
    }

    if (!timedOut && roundBestScore > -INF) {
      bestMove = roundBestMove
      iterativeBestMove = roundBestMove
      bestScore = roundBestScore
      depthReached = depth
      roundCandidates.sort((a, b) => b.score - a.score)
      topCandidates = roundCandidates.slice(0, 3)
    }

    if (timedOut) {
      break
    }
  }

  if (!returnAnalysis) return bestMove

  return {
    move: bestMove,
    analysis: {
      engine: 'max',
      depthReached,
      nodesSearched: stats.nodes,
      evaluations: stats.evaluations,
      alphaBetaCutoffs: stats.cutoffs,
      selectedScore: bestScore > -INF ? bestScore : null,
      candidates: topCandidates,
    },
  }
}

export const findBestMove = findBestMoveMax
