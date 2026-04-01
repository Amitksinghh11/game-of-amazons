const EMPTY = 0
const WHITE = 1
const BLACK = 2
const BURNED = 3

const DIRECTIONS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
]

const INF = 1e9

const getOpponent = (player) => (player === WHITE ? BLACK : WHITE)

const inBounds = (size, r, c) => r >= 0 && r < size && c >= 0 && c < size

const getPieces = (board, player) => {
  const out = []
  for (let r = 0; r < board.length; r += 1) {
    for (let c = 0; c < board.length; c += 1) {
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

const applyMove = (board, move, player) => {
  const next = board.map((row) => [...row])
  next[move.from.r][move.from.c] = EMPTY
  next[move.to.r][move.to.c] = player
  next[move.arrow.r][move.arrow.c] = BURNED
  return next
}

const generateMoves = (board, player, beamPerPiece = 22) => {
  const pieces = getPieces(board, player)
  const moves = []

  for (const piece of pieces) {
    const pieceMoves = []
    const destinations = getQueenRays(board, piece.r, piece.c)

    for (const destination of destinations) {
      const moved = board.map((row) => [...row])
      moved[piece.r][piece.c] = EMPTY
      moved[destination.r][destination.c] = player

      const arrows = getQueenRays(moved, destination.r, destination.c)
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
        const aCenter = Math.abs(a.to.r - board.length / 2) + Math.abs(a.to.c - board.length / 2)
        const bCenter = Math.abs(b.to.r - board.length / 2) + Math.abs(b.to.c - board.length / 2)
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

const orderMoves = (board, moves, player, maxPlayer, cap) => {
  const scored = moves.map((move) => {
    const next = applyMove(board, move, player)
    return { move, score: evaluate(next, maxPlayer) }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, cap).map((item) => item.move)
}

const minimax = (board, currentPlayer, maxPlayer, depth, alpha, beta, deadline, stats) => {
  if (stats) stats.nodes += 1

  if (Date.now() >= deadline) {
    if (stats) stats.evaluations += 1
    return { score: evaluate(board, maxPlayer), timedOut: true }
  }

  if (depth === 0) {
    if (stats) stats.evaluations += 1
    return { score: evaluate(board, maxPlayer), timedOut: false }
  }

  const moves = generateMoves(board, currentPlayer, 16)
  if (moves.length === 0) {
    const isMaxSide = currentPlayer === maxPlayer
    return { score: isMaxSide ? -100000 : 100000, timedOut: false }
  }

  const cappedMoves = orderMoves(
    board,
    moves,
    currentPlayer,
    maxPlayer,
    depth >= 2 ? 14 : 24,
  )

  const maximizing = currentPlayer === maxPlayer

  if (maximizing) {
    let best = -INF
    for (const move of cappedMoves) {
      const next = applyMove(board, move, currentPlayer)
      const child = minimax(next, getOpponent(currentPlayer), maxPlayer, depth - 1, alpha, beta, deadline, stats)
      if (child.timedOut) return child

      if (child.score > best) best = child.score
      if (best > alpha) alpha = best
      if (beta <= alpha) {
        if (stats) stats.cutoffs += 1
        break
      }
    }
    return { score: best, timedOut: false }
  }

  let best = INF
  for (const move of cappedMoves) {
    const next = applyMove(board, move, currentPlayer)
    const child = minimax(next, getOpponent(currentPlayer), maxPlayer, depth - 1, alpha, beta, deadline, stats)
    if (child.timedOut) return child

    if (child.score < best) best = child.score
    if (best < beta) beta = best
    if (beta <= alpha) {
      if (stats) stats.cutoffs += 1
      break
    }
  }
  return { score: best, timedOut: false }
}

export const findBestMoveMax = (board, aiPlayer, options = {}) => {
  const maxDepth = options.maxDepth ?? 3
  const timeMs = options.timeMs ?? 1700
  const returnAnalysis = options.returnAnalysis ?? false
  const deadline = Date.now() + timeMs
  const stats = { nodes: 0, evaluations: 0, cutoffs: 0 }

  const rootMoves = generateMoves(board, aiPlayer, 24)
  if (!rootMoves.length) return null

  const candidateMoves = orderMoves(board, rootMoves, aiPlayer, aiPlayer, 30)

  let bestMove = candidateMoves[0]
  let bestScore = -INF
  let depthReached = 0
  let topCandidates = []

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    if (Date.now() >= deadline) break

    let roundBestMove = bestMove
    let roundBestScore = -INF
    let timedOut = false
    const roundCandidates = []

    for (const move of candidateMoves) {
      if (Date.now() >= deadline) break

      const next = applyMove(board, move, aiPlayer)
      const child = minimax(next, getOpponent(aiPlayer), aiPlayer, depth - 1, -INF, INF, deadline, stats)
      if (child.timedOut) {
        timedOut = true
        break
      }

      roundCandidates.push({ move, score: child.score })

      if (child.score > roundBestScore) {
        roundBestScore = child.score
        roundBestMove = move
      }
    }

    if (!timedOut && roundBestScore > -INF) {
      bestMove = roundBestMove
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

