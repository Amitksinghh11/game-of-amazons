import { useEffect, useMemo, useState } from 'react'
import { Crown, Flame, Settings, X } from 'lucide-react'
import { findBestMoveMax } from './aiEngine'
import { findBestMoveCarlo } from './aiCarlo'
import './App.css'

const DEFAULT_BOARD_SIZE = 10
const EMPTY = 0
const WHITE = 1
const BLACK = 2
const BURNED = 3

const SELECT_PIECE = 'select_piece'
const MOVE_PIECE = 'move_piece'
const SHOOT_ARROW = 'shoot_arrow'

const PLAYER_LABELS = {
  [WHITE]: 'White',
  [BLACK]: 'Black',
}

const GAME_MODES = {
  PVP: 'pvp',
  VS_AI_AS_WHITE: 'vs_ai_as_white',
  VS_AI_AS_BLACK: 'vs_ai_as_black',
  AI_VS_AI: 'ai_vs_ai',
}

const AI_CONTROLLERS = {
  HUMAN: 'human',
  MAX: 'max',
  CARLO: 'carlo',
}

const CONTROLLER_LABELS = {
  [AI_CONTROLLERS.HUMAN]: 'Human',
  [AI_CONTROLLERS.MAX]: 'Max',
  [AI_CONTROLLERS.CARLO]: 'Carlo',
}

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

const cloneBoard = (board) => board.map((row) => [...row])

const toCoordLabel = (row, col) => `${String.fromCharCode(65 + col)}${row + 1}`

const createInitialBoard = (size) => {
  const board = Array.from({ length: size }, () => Array(size).fill(EMPTY))

  const indexA = Math.max(0, Math.floor(size * 0.3))
  const indexB = Math.min(size - 1, size - 1 - indexA)

  const blackStarts = [
    [0, indexA],
    [0, indexB],
    [indexA, 0],
    [indexA, size - 1],
  ]
  const whiteStarts = [
    [size - 1, indexA],
    [size - 1, indexB],
    [indexB, 0],
    [indexB, size - 1],
  ]

  for (const [r, c] of blackStarts) board[r][c] = BLACK
  for (const [r, c] of whiteStarts) board[r][c] = WHITE

  return board
}

const Square = ({ cell, highlight, selected, onClick, isDark, showDot, marker }) => {
  let bgClass = isDark ? 'tile-dark' : 'tile-light'
  if (selected) bgClass = 'tile-selected-bg'
  if (highlight === 'move') bgClass = 'tile-move'
  if (highlight === 'shoot') bgClass = 'tile-shoot'

  const hasFrom = Boolean(marker?.from)
  const hasTo = Boolean(marker?.to)
  const hasArrow = Boolean(marker?.arrow)

  return (
    <button
      type="button"
      onClick={onClick}
      className={`tile-button relative flex items-center justify-center rounded-sm transition-all duration-150 ${bgClass} h-11 w-11 sm:h-14 sm:w-14 ${selected ? 'tile-selected' : ''}`}
    >
      {cell === WHITE && <Crown size={26} className="piece-white" fill="white" />}
      {cell === BLACK && <Crown size={26} className="piece-black" fill="currentColor" />}
      {cell === BURNED && <Flame size={25} className="text-orange-600" fill="currentColor" />}
      {showDot && <div className="absolute h-2.5 w-2.5 rounded-full dot-target" />}
      {hasFrom && (
        <>
          <div className="marker-from" />
          <div className="marker-badge marker-badge-from">FROM</div>
        </>
      )}
      {hasTo && (
        <>
          <div className="marker-to" />
          <div className="marker-badge marker-badge-to">TO</div>
        </>
      )}
      {hasArrow && (
        <>
          <div className="marker-arrow" />
          <div className="marker-badge marker-badge-arrow">SHOT</div>
        </>
      )}
    </button>
  )
}

const Board = ({ board, selectedPiece, validMoves, phase, onSquareClick, lastAction }) => {
  const boardSize = board.length

  const validSet = useMemo(
    () => new Set(validMoves.map((m) => `${m.r}-${m.c}`)),
    [validMoves],
  )

  const columnLabels = useMemo(
    () => Array.from({ length: boardSize }, (_, c) => String.fromCharCode(65 + c)),
    [boardSize],
  )

  const rowLabels = useMemo(
    () => Array.from({ length: boardSize }, (_, r) => String(r + 1)),
    [boardSize],
  )

  const markerSet = useMemo(() => {
    if (!lastAction) return new Map()

    const markerMap = new Map()
    const upsertMarker = (key, type) => {
      const current = markerMap.get(key) ?? { from: false, to: false, arrow: false }
      current[type] = true
      markerMap.set(key, current)
    }

    upsertMarker(`${lastAction.from.r}-${lastAction.from.c}`, 'from')
    upsertMarker(`${lastAction.to.r}-${lastAction.to.c}`, 'to')
    upsertMarker(`${lastAction.arrow.r}-${lastAction.arrow.c}`, 'arrow')

    return markerMap
  }, [lastAction])

  return (
    <div className="board-with-labels">
      <div
        className="board-top-labels grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))` }}
      >
        {columnLabels.map((label) => (
          <span key={label} className="coord-label coord-col-label">
            {label}
          </span>
        ))}
      </div>

      <div className="board-main-row">
        <div className="board-left-labels">
          {rowLabels.map((label) => (
            <span key={label} className="coord-label coord-row-label h-11 sm:h-14">
              {label}
            </span>
          ))}
        </div>

        <div
          className="board-grid grid gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))` }}
        >
          {board.map((row, r) =>
            row.map((cell, c) => {
              const selected = selectedPiece?.r === r && selectedPiece?.c === c
              const key = `${r}-${c}`
              const isValid = validSet.has(key)
              const highlight = isValid ? (phase === SHOOT_ARROW ? 'shoot' : 'move') : null
              const marker = markerSet.get(key)

              return (
                <Square
                  key={key}
                  cell={cell}
                  highlight={highlight}
                  selected={selected}
                  onClick={() => onSquareClick(r, c)}
                  isDark={(r + c) % 2 === 1}
                  showDot={isValid && cell === EMPTY}
                  marker={marker}
                />
              )
            }),
          )}
        </div>
      </div>
    </div>
  )
}

function App() {
  const [boardSize, setBoardSize] = useState(DEFAULT_BOARD_SIZE)
  const [gameMode, setGameMode] = useState(GAME_MODES.PVP)
  const [board, setBoard] = useState(() => createInitialBoard(DEFAULT_BOARD_SIZE))
  const [turn, setTurn] = useState(WHITE)
  const [phase, setPhase] = useState(SELECT_PIECE)
  const [selectedPiece, setSelectedPiece] = useState(null)
  const [movedFrom, setMovedFrom] = useState(null)
  const [validMoves, setValidMoves] = useState([])
  const [winner, setWinner] = useState(null)
  const [isAiThinking, setIsAiThinking] = useState(false)
  const [lastAction, setLastAction] = useState(null)
  const [turnNumber, setTurnNumber] = useState(1)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [humanVsAiController, setHumanVsAiController] = useState(AI_CONTROLLERS.MAX)
  const [aiWhiteController, setAiWhiteController] = useState(AI_CONTROLLERS.MAX)
  const [aiBlackController, setAiBlackController] = useState(AI_CONTROLLERS.CARLO)
  const [spectatorDelayMs, setSpectatorDelayMs] = useState(900)
  const [showAiInsights, setShowAiInsights] = useState(false)
  const [lastAiInsight, setLastAiInsight] = useState(null)

  const getControllerForPlayer = (player) => {
    if (gameMode === GAME_MODES.PVP) return AI_CONTROLLERS.HUMAN
    if (gameMode === GAME_MODES.VS_AI_AS_WHITE) {
      return player === WHITE ? AI_CONTROLLERS.HUMAN : humanVsAiController
    }
    if (gameMode === GAME_MODES.VS_AI_AS_BLACK) {
      return player === BLACK ? AI_CONTROLLERS.HUMAN : humanVsAiController
    }
    return player === WHITE ? aiWhiteController : aiBlackController
  }

  const turnController = getControllerForPlayer(turn)
  const isHumanTurn = turnController === AI_CONTROLLERS.HUMAN
  const whiteController = getControllerForPlayer(WHITE)
  const blackController = getControllerForPlayer(BLACK)
  const sideSummary = `White: ${CONTROLLER_LABELS[whiteController]} | Black: ${CONTROLLER_LABELS[blackController]}`

  const inBounds = (r, c) => r >= 0 && r < board.length && c >= 0 && c < board.length

  const calculateValidMoves = (r, c, currentBoard = board) => {
    const moves = []

    for (const [dr, dc] of DIRECTIONS) {
      let rr = r + dr
      let cc = c + dc

      while (inBounds(rr, cc) && currentBoard[rr][cc] === EMPTY) {
        moves.push({ r: rr, c: cc })
        rr += dr
        cc += dc
      }
    }

    return moves
  }

  const hasAnyMoveForPlayer = (player, currentBoard = board) => {
    for (let r = 0; r < currentBoard.length; r += 1) {
      for (let c = 0; c < currentBoard.length; c += 1) {
        if (currentBoard[r][c] !== player) continue
        if (calculateValidMoves(r, c, currentBoard).length > 0) return true
      }
    }
    return false
  }

  const applyTurnMove = (currentBoard, currentTurn, move) => {
    const next = cloneBoard(currentBoard)
    next[move.from.r][move.from.c] = EMPTY
    next[move.to.r][move.to.c] = currentTurn
    next[move.arrow.r][move.arrow.c] = BURNED
    return next
  }

  const resetGame = () => {
    setBoard(createInitialBoard(boardSize))
    setTurn(WHITE)
    setPhase(SELECT_PIECE)
    setSelectedPiece(null)
    setMovedFrom(null)
    setValidMoves([])
    setWinner(null)
    setIsAiThinking(false)
    setLastAction(null)
    setLastAiInsight(null)
    setTurnNumber(1)
  }

  useEffect(() => {
    if (!showAiInsights) setLastAiInsight(null)
  }, [showAiInsights])

  useEffect(() => {
    resetGame()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardSize, gameMode])

  useEffect(() => {
    if (winner || phase !== SELECT_PIECE) return

    if (!hasAnyMoveForPlayer(turn, board)) {
      setWinner(turn === WHITE ? BLACK : WHITE)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, board, winner, phase])

  useEffect(() => {
    if (winner || phase !== SELECT_PIECE || turnController === AI_CONTROLLERS.HUMAN) return

    setIsAiThinking(true)
    let commitTimerId = null
    const timerId = setTimeout(() => {
      const aiResult =
        turnController === AI_CONTROLLERS.CARLO
          ? findBestMoveCarlo(board, turn, {
              timeMs: 2200,
              maxIterations: 5200,
              returnAnalysis: showAiInsights,
            })
          : findBestMoveMax(board, turn, {
              maxDepth: 4,
              timeMs: 2200,
              returnAnalysis: showAiInsights,
            })

      const move = showAiInsights ? aiResult?.move : aiResult
      const analysis = showAiInsights ? aiResult?.analysis ?? null : null

      if (!move) {
        setWinner(turn === WHITE ? BLACK : WHITE)
        setIsAiThinking(false)
        return
      }

      const insight =
        analysis == null
          ? null
          : {
              ...analysis,
              move,
              player: turn,
              controller: turnController,
              turnNumber,
            }

      const applyAIMove = () => {
        const nextBoard = applyTurnMove(board, turn, move)
        setBoard(nextBoard)
        setLastAction({ ...move, player: turn, turnNumber })
        if (insight) setLastAiInsight(insight)
        setTurn(turn === WHITE ? BLACK : WHITE)
        setTurnNumber((n) => n + 1)
        setPhase(SELECT_PIECE)
        setSelectedPiece(null)
        setMovedFrom(null)
        setValidMoves([])
        setIsAiThinking(false)
      }

      if (gameMode === GAME_MODES.AI_VS_AI) {
        const viewerDelay = Math.max(300, Math.min(2600, spectatorDelayMs))
        commitTimerId = setTimeout(applyAIMove, viewerDelay)
      } else {
        applyAIMove()
      }
    }, 180)

    return () => {
      clearTimeout(timerId)
      if (commitTimerId) clearTimeout(commitTimerId)
    }
  }, [turn, phase, winner, turnController, board, turnNumber, gameMode, spectatorDelayMs, showAiInsights])

  const handleSquareClick = (r, c) => {
    if (winner || !isHumanTurn || isAiThinking) return

    if (phase === SELECT_PIECE) {
      if (board[r][c] !== turn) return
      const options = calculateValidMoves(r, c)
      if (!options.length) return
      setSelectedPiece({ r, c })
      setValidMoves(options)
      setPhase(MOVE_PIECE)
      setMovedFrom(null)
      return
    }

    if (phase === MOVE_PIECE && selectedPiece) {
      if (board[r][c] === turn) {
        const options = calculateValidMoves(r, c)
        setSelectedPiece({ r, c })
        setValidMoves(options)
        return
      }

      const isValidDestination = validMoves.some((m) => m.r === r && m.c === c)
      if (!isValidDestination) return

      const next = cloneBoard(board)
      next[selectedPiece.r][selectedPiece.c] = EMPTY
      next[r][c] = turn

      setMovedFrom({ ...selectedPiece })
      setBoard(next)
      setSelectedPiece({ r, c })
      setValidMoves(calculateValidMoves(r, c, next))
      setPhase(SHOOT_ARROW)
      return
    }

    if (phase === SHOOT_ARROW && selectedPiece) {
      const isValidArrow = validMoves.some((m) => m.r === r && m.c === c)
      if (!isValidArrow) return

      const next = cloneBoard(board)
      next[r][c] = BURNED

      setBoard(next)
      if (movedFrom) {
        setLastAction({
          from: movedFrom,
          to: selectedPiece,
          arrow: { r, c },
          player: turn,
          turnNumber,
        })
      }
      setTurn(turn === WHITE ? BLACK : WHITE)
      setTurnNumber((n) => n + 1)
      setPhase(SELECT_PIECE)
      setSelectedPiece(null)
      setMovedFrom(null)
      setValidMoves([])
    }
  }

  const phaseText =
    phase === SELECT_PIECE
      ? 'Move a piece'
      : phase === MOVE_PIECE
        ? 'Choose move destination'
        : 'Shoot an arrow'

  const formatInsightMove = (move) => {
    if (!move) return '-'
    return `${toCoordLabel(move.from.r, move.from.c)} -> ${toCoordLabel(move.to.r, move.to.c)} | ${toCoordLabel(move.arrow.r, move.arrow.c)}`
  }

  return (
    <div className="game-shell w-full max-w-5xl p-4 sm:p-6 flex flex-col items-center gap-4 sm:gap-5">
      <header className="top-bar w-full rounded-xl px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-left">
            <h1 className="text-2xl sm:text-3xl font-bold heading-primary">Game of Amazons</h1>
            <p className="subtext-soft text-xs sm:text-sm">Territory tactics. One move, one arrow.</p>
          </div>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="settings-button rounded-md px-3 py-2 text-sm font-medium inline-flex items-center gap-2"
          >
            <Settings size={16} /> Settings
          </button>
        </div>
      </header>

      <section className="status-strip w-full rounded-xl px-4 py-3 sm:px-5 sm:py-4">
        {winner ? (
          <div className="text-center text-2xl font-bold winner-text animate-pulse">{PLAYER_LABELS[winner]} wins!</div>
        ) : (
          <div className="status-grid">
            <div className="status-item">
              <span className="status-kicker">Next Move</span>
              <p className="status-value turn-text">
                {PLAYER_LABELS[turn]} <span className="phase-text">- {phaseText}</span>
              </p>
            </div>

            <div className="status-item">
              <span className="status-kicker">Last Move</span>
              {lastAction ? (
                <p className="status-value">
                  {PLAYER_LABELS[lastAction.player]} {toCoordLabel(lastAction.from.r, lastAction.from.c)}
                  {' -> '}
                  {toCoordLabel(lastAction.to.r, lastAction.to.c)}
                  <span className="arrow-text"> shot {toCoordLabel(lastAction.arrow.r, lastAction.arrow.c)}</span>
                  <span className="ml-2 subtext-soft">(turn {lastAction.turnNumber})</span>
                </p>
              ) : (
                <p className="status-value subtext-muted">No moves yet</p>
              )}
            </div>

            <div className="status-item status-side-info">
              {isAiThinking ? (
                <p className="ai-thinking animate-pulse text-sm">{CONTROLLER_LABELS[turnController]} is thinking...</p>
              ) : (
                <p className="subtext-muted text-sm">{sideSummary}</p>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="board-shell p-3 sm:p-4 rounded-xl">
        <Board
          board={board}
          selectedPiece={selectedPiece}
          validMoves={validMoves}
          phase={phase}
          onSquareClick={handleSquareClick}
          lastAction={lastAction}
        />
      </div>

      {showAiInsights && (
        <section className="insight-panel w-full max-w-[900px] rounded-xl px-4 py-3 sm:px-5 sm:py-4">
          <div className="insight-header">
            <div>
              <span className="status-kicker">AI Reasoning</span>
              <p className="insight-title">Understand why each AI chose its move</p>
            </div>
          </div>

          {lastAiInsight ? (
            <>
              <div className="insight-summary-row">
                <span className="insight-badge">{CONTROLLER_LABELS[lastAiInsight.controller]}</span>
                <span className="subtext-muted text-sm">{PLAYER_LABELS[lastAiInsight.player]} on turn {lastAiInsight.turnNumber}</span>
                <span className="insight-selected">Selected: {formatInsightMove(lastAiInsight.move)}</span>
              </div>

              <div className="insight-metrics-grid">
                {lastAiInsight.engine === 'max' ? (
                  <>
                    <div className="insight-metric-chip">Depth: {lastAiInsight.depthReached}</div>
                    <div className="insight-metric-chip">Nodes: {lastAiInsight.nodesSearched}</div>
                    <div className="insight-metric-chip">Cutoffs: {lastAiInsight.alphaBetaCutoffs}</div>
                    <div className="insight-metric-chip">
                      Eval: {lastAiInsight.selectedScore == null ? '-' : lastAiInsight.selectedScore.toFixed(1)}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="insight-metric-chip">Iterations: {lastAiInsight.iterations}</div>
                    <div className="insight-metric-chip">Rollouts: {lastAiInsight.rollouts}</div>
                    <div className="insight-metric-chip">Avg rollout depth: {lastAiInsight.avgRolloutDepth.toFixed(1)}</div>
                    <div className="insight-metric-chip">Selected visits: {lastAiInsight.selectedVisits}</div>
                  </>
                )}
              </div>

              <div className="insight-candidates">
                <p className="status-kicker">Top considered moves</p>
                {lastAiInsight.candidates?.length ? (
                  <div className="insight-candidate-list">
                    {lastAiInsight.candidates.map((candidate, idx) => (
                      <div key={`${idx}-${candidate.move.from.r}-${candidate.move.from.c}`} className="insight-candidate-row">
                        <span className="insight-rank">#{idx + 1}</span>
                        <span className="insight-move">{formatInsightMove(candidate.move)}</span>
                        <span className="insight-value">
                          {lastAiInsight.engine === 'max'
                            ? `score ${candidate.score.toFixed(1)}`
                            : `${candidate.visits} visits · value ${candidate.meanValue.toFixed(2)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="subtext-muted text-sm">No candidate summary available for this turn.</p>
                )}
              </div>
            </>
          ) : (
            <p className="subtext-muted text-sm">Reasoning panel is enabled. Waiting for the next AI move…</p>
          )}
        </section>
      )}

      <div className="tracking-legend w-full max-w-[680px] rounded-lg px-3 py-2">
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm">
          <span className="legend-chip rounded-md px-2 py-1">
            <span className="legend-dot legend-dot-from" />FROM: where piece started
          </span>
          <span className="legend-chip rounded-md px-2 py-1">
            <span className="legend-dot legend-dot-to" />TO: where piece moved
          </span>
          <span className="legend-chip rounded-md px-2 py-1">
            <span className="legend-dot legend-dot-arrow" />SHOT: burned square
          </span>
        </div>
      </div>

      <p className="text-xs subtext-soft text-center max-w-2xl">
        Move like a chess queen, then shoot an arrow from the moved amazon. Burned squares are blocked forever.
      </p>

      {isSettingsOpen && (
        <div className="settings-overlay" role="presentation" onClick={() => setIsSettingsOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Game settings"
            className="settings-modal rounded-xl p-4 sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg sm:text-xl font-semibold heading-primary">Settings</h2>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="close-button inline-flex h-8 w-8 items-center justify-center rounded-md"
                aria-label="Close settings"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-left text-sm">
                <span className="label-text">Board Size</span>
                <select
                  value={boardSize}
                  onChange={(e) => setBoardSize(Number(e.target.value))}
                  className="control-input rounded-md px-3 py-2"
                >
                  <option value={6}>6 x 6</option>
                  <option value={8}>8 x 8</option>
                  <option value={10}>10 x 10</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-left text-sm">
                <span className="label-text">Game Mode</span>
                <select
                  value={gameMode}
                  onChange={(e) => setGameMode(e.target.value)}
                  className="control-input rounded-md px-3 py-2"
                >
                  <option value={GAME_MODES.PVP}>2 Players Local</option>
                  <option value={GAME_MODES.VS_AI_AS_WHITE}>Vs AI (You play White)</option>
                  <option value={GAME_MODES.VS_AI_AS_BLACK}>Vs AI (You play Black)</option>
                  <option value={GAME_MODES.AI_VS_AI}>AI vs AI (Spectator)</option>
                </select>
              </label>
            </div>

            {(gameMode === GAME_MODES.VS_AI_AS_WHITE || gameMode === GAME_MODES.VS_AI_AS_BLACK) && (
              <div className="mt-3 grid gap-3">
                <label className="flex flex-col gap-1 text-left text-sm">
                  <span className="label-text">AI Engine</span>
                  <select
                    value={humanVsAiController}
                    onChange={(e) => setHumanVsAiController(e.target.value)}
                    className="control-input rounded-md px-3 py-2"
                  >
                    <option value={AI_CONTROLLERS.MAX}>Max (Minimax + Alpha-Beta)</option>
                    <option value={AI_CONTROLLERS.CARLO}>Carlo (MCTS)</option>
                  </select>
                </label>
              </div>
            )}

            {gameMode === GAME_MODES.AI_VS_AI && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-left text-sm">
                  <span className="label-text">White AI</span>
                  <select
                    value={aiWhiteController}
                    onChange={(e) => setAiWhiteController(e.target.value)}
                    className="control-input rounded-md px-3 py-2"
                  >
                    <option value={AI_CONTROLLERS.MAX}>Max (Minimax + Alpha-Beta)</option>
                    <option value={AI_CONTROLLERS.CARLO}>Carlo (MCTS)</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-left text-sm">
                  <span className="label-text">Black AI</span>
                  <select
                    value={aiBlackController}
                    onChange={(e) => setAiBlackController(e.target.value)}
                    className="control-input rounded-md px-3 py-2"
                  >
                    <option value={AI_CONTROLLERS.MAX}>Max (Minimax + Alpha-Beta)</option>
                    <option value={AI_CONTROLLERS.CARLO}>Carlo (MCTS)</option>
                  </select>
                </label>

                <label className="sm:col-span-2 flex flex-col gap-2 text-left text-sm">
                  <span className="label-text">Spectator Move Delay ({spectatorDelayMs} ms)</span>
                  <input
                    type="range"
                    min={300}
                    max={2600}
                    step={100}
                    value={spectatorDelayMs}
                    onChange={(e) => setSpectatorDelayMs(Number(e.target.value))}
                    className="w-full"
                  />
                </label>
              </div>
            )}

            <div className="mt-3">
              <label className="insight-toggle-row">
                <input
                  type="checkbox"
                  checked={showAiInsights}
                  onChange={(e) => setShowAiInsights(e.target.checked)}
                />
                <div>
                  <span className="label-text">Show AI reasoning panel</span>
                  <p className="subtext-soft text-xs">Displays clean search stats and top candidate moves for Max and Carlo.</p>
                </div>
              </label>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  resetGame()
                  setIsSettingsOpen(false)
                }}
                className="action-button rounded-md px-4 py-2 text-sm font-medium"
              >
                Reset Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
