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
const EPS = 1e-9

const getOpponent = (player) => (player === WHITE ? BLACK : WHITE)

const inBounds = (size, r, c) => r >= 0 && r < size && c >= 0 && c < size

const cloneBoard = (board) => board.map((row) => [...row])

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
  const next = cloneBoard(board)
  next[move.from.r][move.from.c] = EMPTY
  next[move.to.r][move.to.c] = player
  next[move.arrow.r][move.arrow.c] = BURNED
  return next
}

const generateMoves = (board, player, beamPerPiece = 16) => {
  const pieces = getPieces(board, player)
  const moves = []

  for (const piece of pieces) {
    const pieceMoves = []
    const destinations = getQueenRays(board, piece.r, piece.c)

    for (const destination of destinations) {
      const moved = cloneBoard(board)
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

const scoreMoveQuick = (board, move, player) => {
  const next = applyMove(board, move, player)
  const centerPull =
    Math.abs(move.to.r - board.length / 2) + Math.abs(move.to.c - board.length / 2) +
    Math.abs(move.arrow.r - board.length / 2) + Math.abs(move.arrow.c - board.length / 2)
  return evaluate(next, player) - centerPull * 0.2
}

const orderMoves = (board, moves, player, cap) => {
  const scored = moves.map((move) => ({ move, score: scoreMoveQuick(board, move, player) }))
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, cap).map((item) => item.move)
}

const makeNode = (board, currentPlayer, rootPlayer, parent = null, move = null) => ({
  board,
  currentPlayer,
  rootPlayer,
  parent,
  move,
  children: [],
  untriedMoves: null,
  visits: 0,
  valueSum: 0,
  terminal: false,
})

const initNodeMoves = (node, options) => {
  if (node.untriedMoves) return
  const rawMoves = generateMoves(node.board, node.currentPlayer, options.nodeBeamPerPiece)
  // Reverse once so we can pop() best-scored moves first during expansion.
  node.untriedMoves = orderMoves(node.board, rawMoves, node.currentPlayer, options.nodeMoveCap).reverse()
  if (node.untriedMoves.length === 0) node.terminal = true
}

const progressiveWidth = (visits, options) => Math.max(2, Math.floor(options.pwBase * Math.pow(visits + 1, options.pwAlpha)))

const uctScore = (parent, child, exploration) => {
  const exploitation = child.valueSum / (child.visits + EPS)
  // Always maximize from side-to-move perspective at the parent node.
  const perspectiveValue = parent.currentPlayer === parent.rootPlayer ? exploitation : -exploitation
  const explorationBonus = exploration * Math.sqrt(Math.log(parent.visits + 1) / (child.visits + EPS))
  return perspectiveValue + explorationBonus
}

const selectBestUctChild = (node, exploration) => {
  let best = node.children[0]
  let bestScore = -INF
  for (const child of node.children) {
    const score = uctScore(node, child, exploration)
    if (score > bestScore) {
      bestScore = score
      best = child
    }
  }
  return best
}

const rolloutPolicy = (board, currentPlayer, options) => {
  const moves = generateMoves(board, currentPlayer, options.rolloutBeamPerPiece)
  if (!moves.length) return null

  const ordered = orderMoves(board, moves, currentPlayer, options.rolloutTopK)
  if (!ordered.length) return null

  if (Math.random() < options.rolloutGreedyChance) return ordered[0]

  const sampleK = Math.min(ordered.length, 3)
  return ordered[Math.floor(Math.random() * sampleK)]
}

const simulate = (node, options, stats) => {
  let board = cloneBoard(node.board)
  let player = node.currentPlayer
  let depth = 0
  if (stats) stats.rollouts += 1

  while (depth < options.rolloutDepth) {
    const move = rolloutPolicy(board, player, options)
    if (!move) {
      if (stats) stats.rolloutPlies += depth
      const winner = getOpponent(player)
      return winner === node.rootPlayer ? 1 : -1
    }

    board = applyMove(board, move, player)
    player = getOpponent(player)
    depth += 1
  }

  if (stats) stats.rolloutPlies += depth
  const heuristic = evaluate(board, node.rootPlayer)
  return Math.tanh(heuristic / 160)
}

const backpropagate = (node, value) => {
  let current = node
  while (current) {
    current.visits += 1
    current.valueSum += value
    current = current.parent
  }
}

export const findBestMoveCarlo = (board, aiPlayer, options = {}) => {
  const returnAnalysis = options.returnAnalysis ?? false
  const opts = {
    timeMs: options.timeMs ?? 2200,
    maxIterations: options.maxIterations ?? 4500,
    exploration: options.exploration ?? 1.05,
    nodeBeamPerPiece: options.nodeBeamPerPiece ?? 16,
    nodeMoveCap: options.nodeMoveCap ?? 32,
    rolloutBeamPerPiece: options.rolloutBeamPerPiece ?? 10,
    rolloutTopK: options.rolloutTopK ?? 10,
    rolloutDepth: options.rolloutDepth ?? 12,
    rolloutGreedyChance: options.rolloutGreedyChance ?? 0.75,
    pwBase: options.pwBase ?? 2.5,
    pwAlpha: options.pwAlpha ?? 0.52,
  }

  const deadline = Date.now() + opts.timeMs
  const root = makeNode(cloneBoard(board), aiPlayer, aiPlayer)
  const stats = { iterations: 0, expansions: 0, rollouts: 0, rolloutPlies: 0 }
  initNodeMoves(root, opts)

  if (!root.untriedMoves.length) return null

  let iterations = 0
  while (Date.now() < deadline && iterations < opts.maxIterations) {
    iterations += 1
    stats.iterations += 1
    let node = root

    while (true) {
      initNodeMoves(node, opts)
      if (node.terminal) break

      const canExpand =
        node.untriedMoves.length > 0 && node.children.length < progressiveWidth(node.visits, opts)

      if (canExpand) {
        const move = node.untriedMoves.pop()
        const nextBoard = applyMove(node.board, move, node.currentPlayer)
        const child = makeNode(nextBoard, getOpponent(node.currentPlayer), root.rootPlayer, node, move)
        node.children.push(child)
        stats.expansions += 1
        node = child
        break
      }

      if (!node.children.length) break
      node = selectBestUctChild(node, opts.exploration)
    }

    const value = simulate(node, opts, stats)
    backpropagate(node, value)
  }

  if (!root.children.length) {
    const fallbackMove = root.untriedMoves.at(-1) ?? null
    if (!returnAnalysis) return fallbackMove
    return {
      move: fallbackMove,
      analysis: {
        engine: 'carlo',
        iterations: stats.iterations,
        expansions: stats.expansions,
        rollouts: stats.rollouts,
        avgRolloutDepth: stats.rollouts > 0 ? stats.rolloutPlies / stats.rollouts : 0,
        rootBranches: 0,
        selectedVisits: 0,
        selectedMeanValue: 0,
        candidates: [],
      },
    }
  }

  root.children.sort((a, b) => {
    const av = a.valueSum / (a.visits + EPS)
    const bv = b.valueSum / (b.visits + EPS)
    if (Math.abs(bv - av) > 0.02) return bv - av
    if (b.visits !== a.visits) return b.visits - a.visits
    return bv - av
  })

  const selected = root.children[0]
  if (!returnAnalysis) return selected.move

  const candidates = root.children.slice(0, 3).map((child) => ({
    move: child.move,
    visits: child.visits,
    meanValue: child.valueSum / (child.visits + EPS),
  }))

  return {
    move: selected.move,
    analysis: {
      engine: 'carlo',
      iterations: stats.iterations,
      expansions: stats.expansions,
      rollouts: stats.rollouts,
      avgRolloutDepth: stats.rollouts > 0 ? stats.rolloutPlies / stats.rollouts : 0,
      rootBranches: root.children.length,
      selectedVisits: selected.visits,
      selectedMeanValue: selected.valueSum / (selected.visits + EPS),
      candidates,
    },
  }

}
