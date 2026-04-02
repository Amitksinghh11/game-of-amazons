import { useEffect, useMemo, useState } from 'react'
import { Crown, Flame, Settings, X, Volume2, VolumeX, BookOpen } from 'lucide-react'
import { playSound, AUDIO_STATE } from './audio'
import './index.css'
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
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
]

const cloneBoard = (board) => board.map((row) => [...row])

const toCoordLabel = (row, col) => `${String.fromCharCode(65 + col)}${row + 1}`

const createInitialState = (size) => {
  const board = Array.from({ length: size }, () => Array(size).fill(EMPTY))
  const pieces = []

  const indexA = Math.max(0, Math.floor(size * 0.3))
  const indexB = Math.min(size - 1, size - 1 - indexA)

  const blackStarts = [
    [0, indexA], [0, indexB], [indexA, 0], [indexA, size - 1],
  ]
  const whiteStarts = [
    [size - 1, indexA], [size - 1, indexB], [indexB, 0], [indexB, size - 1],
  ]

  let idCounter = 0
  for (const [r, c] of blackStarts) {
    board[r][c] = BLACK
    pieces.push({ id: `b${idCounter++}`, r, c, player: BLACK })
  }
  for (const [r, c] of whiteStarts) {
    board[r][c] = WHITE
    pieces.push({ id: `w${idCounter++}`, r, c, player: WHITE })
  }

  return { board, pieces, flames: [] }
}

const FluidBoard = ({ boardSize, pieces, flames, selectedPiece, validMoves, phase, onSquareClick, onPieceClick, lastAction }) => {
  
  const validSet = useMemo(() => new Set(validMoves.map((m) => `${m.r}-${m.c}`)), [validMoves])

  const markerSet = useMemo(() => {
    if (!lastAction) return new Map()
    const map = new Map()
    map.set(`${lastAction.from.r}-${lastAction.from.c}`, 'from')
    map.set(`${lastAction.to.r}-${lastAction.to.c}`, 'to')
    map.set(`${lastAction.arrow.r}-${lastAction.arrow.c}`, 'arrow')
    return map
  }, [lastAction])

  const cellSize = `${100 / boardSize}%`

  // Render empty tiles background
  const tiles = []
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      const isDark = (r + c) % 2 === 1
      const key = `${r}-${c}`
      const isValid = validSet.has(key)
      const marker = markerSet.get(key)
      
      let highlightClass = ''
      if (isValid) {
        highlightClass = phase === SHOOT_ARROW ? 'tile-shoot' : 'tile-move'
      }

      tiles.push(
        <div
          key={key}
          onClick={() => onSquareClick(r, c)}
          className={`tile ${isDark ? 'tile-dark' : ''} ${highlightClass}`}
          style={{ gridRowStart: r + 1, gridColumnStart: c + 1 }}
        >
          {marker && <div className={`marker marker-${marker}`} />}
        </div>
      )
    }
  }

  return (
    <div className="board-container" style={{ maxWidth: `${Math.max(340, boardSize * 56)}px` }}>
      <div className="board-outline p-1.5 sm:p-2 bg-[var(--tile-board-bg)] rounded-xl">
        <div className="board-aspect-wrapper">
          <div 
            className="board-grid-underlay"
            style={{ 
              gridTemplateRows: `repeat(${boardSize}, minmax(0, 1fr))`,
              gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))` 
            }}
          >
            {tiles}
          </div>

          <div className="piece-layer">
            {/* Flames / Burned squares layer */}
            {flames.map(f => (
              <div 
                key={f.key} 
                className="burned-flame"
                style={{
                  width: cellSize, height: cellSize,
                  top: `${f.r * (100 / boardSize)}%`,
                  left: `${f.c * (100 / boardSize)}%`
                }}
              >
                <Flame />
              </div>
            ))}

            {/* Pieces layer */}
            {pieces.map(p => {
              const selected = selectedPiece?.r === p.r && selectedPiece?.c === p.c
              return (
                <div
                  key={p.id}
                  onClick={(e) => { e.stopPropagation(); onPieceClick(p.r, p.c, p.player); }}
                  className={`game-piece ${p.player === WHITE ? 'piece-white' : 'piece-black'} ${selected ? 'piece-selected' : ''}`}
                  style={{
                    width: cellSize, height: cellSize,
                    transform: `translate(${p.c * 100}%, ${p.r * 100}%)`,
                    zIndex: selected ? 10 : 2
                  }}
                >
                  <Crown />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [boardSize, setBoardSize] = useState(DEFAULT_BOARD_SIZE)
  const [gameMode, setGameMode] = useState(GAME_MODES.PVP)
  
  const [{ board, pieces, flames }, setGameState] = useState(() => createInitialState(DEFAULT_BOARD_SIZE))
  
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
  const [isRulesOpen, setIsRulesOpen] = useState(false)
  const showAiInsights = false
  const [isMuted, setIsMuted] = useState(false)

  const toggleSound = () => {
    AUDIO_STATE.muted = !isMuted
    setIsMuted(!isMuted)
    if (!AUDIO_STATE.muted) playSound('pop')
  }

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
    for (let r = 0; r < currentBoard.length; r++) {
      for (let c = 0; c < currentBoard.length; c++) {
        if (currentBoard[r][c] !== player) continue
        if (calculateValidMoves(r, c, currentBoard).length > 0) return true
      }
    }
    return false
  }

  const applyTurnMove = (currentBoard, currentPieces, currentFlames, currentTurn, move, currentTurnNumber) => {
    const nextBoard = cloneBoard(currentBoard)
    nextBoard[move.from.r][move.from.c] = EMPTY
    nextBoard[move.to.r][move.to.c] = currentTurn
    nextBoard[move.arrow.r][move.arrow.c] = BURNED

    const nextPieces = currentPieces.map(p => {
      if (p.r === move.from.r && p.c === move.from.c) {
        return { ...p, r: move.to.r, c: move.to.c }
      }
      return p
    })
    
    const nextFlames = [...currentFlames, { key: `flame-${currentTurnNumber}`, r: move.arrow.r, c: move.arrow.c, player: currentTurn }]
    
    return { nextBoard, nextPieces, nextFlames }
  }

  const resetGame = () => {
    setGameState(createInitialState(boardSize))
    setTurn(WHITE)
    setPhase(SELECT_PIECE)
    setSelectedPiece(null)
    setMovedFrom(null)
    setValidMoves([])
    setWinner(null)
    setIsAiThinking(false)
    setLastAction(null)
    setTurnNumber(1)
  }

  useEffect(() => {
    resetGame()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardSize, gameMode])

  useEffect(() => {
    if (winner || phase !== SELECT_PIECE) return
    if (!hasAnyMoveForPlayer(turn, board)) {
      playSound('win')
      setWinner(turn === WHITE ? BLACK : WHITE)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, board, winner, phase])

  // AI Turn handler
  useEffect(() => {
    if (winner || phase !== SELECT_PIECE || turnController === AI_CONTROLLERS.HUMAN) return

    setIsAiThinking(true)
    let commitTimerId = null
    
    // Spawn Web Worker asynchronously
    const worker = new Worker(new URL('./ai.worker.js', import.meta.url), { type: 'module' })
    
    worker.onmessage = (e) => {
      const result = e.data
      const move = result ? result.move : null

      if (!move) {
        playSound('win')
        setWinner(turn === WHITE ? BLACK : WHITE)
        setIsAiThinking(false)
        worker.terminate()
        return
      }

      const applyAIMove = () => {
        playSound('move')
        const { nextBoard, nextPieces, nextFlames } = applyTurnMove(board, pieces, flames, turn, move, turnNumber)
        setGameState({ board: nextBoard, pieces: nextPieces, flames: nextFlames })
        setTimeout(() => playSound('shoot'), 200)

        setLastAction({ ...move, player: turn, turnNumber })
        setTurn(turn === WHITE ? BLACK : WHITE)
        setTurnNumber((n) => n + 1)
        setPhase(SELECT_PIECE)
        setSelectedPiece(null)
        setMovedFrom(null)
        setValidMoves([])
        setIsAiThinking(false)
        worker.terminate()
      }

      if (gameMode === GAME_MODES.AI_VS_AI) {
        commitTimerId = setTimeout(applyAIMove, Math.max(300, spectatorDelayMs))
      } else {
        applyAIMove()
      }
    }

    worker.postMessage({ board, turn, controller: turnController, showAiInsights })

    return () => {
      // Instantly kill ghost calculations if user resets game or unmounts component
      worker.terminate()
      if (commitTimerId) clearTimeout(commitTimerId)
    }
  }, [turn, phase, winner, turnController, board, pieces, flames, turnNumber, gameMode, spectatorDelayMs, showAiInsights])

  // Human interactions
  const handlePieceClick = (r, c, playerColor) => {
    if (winner || !isHumanTurn || isAiThinking || phase === SHOOT_ARROW) return

    // Can only select own pieces
    if (playerColor === turn && (phase === SELECT_PIECE || phase === MOVE_PIECE)) {
      const options = calculateValidMoves(r, c)
      if (options.length > 0) {
        playSound('pop')
        setSelectedPiece({ r, c })
        setValidMoves(options)
        setPhase(MOVE_PIECE)
        setMovedFrom(null)
      } else {
        playSound('error')
      }
    }
  }

  const handleSquareClick = (r, c) => {
    if (winner || !isHumanTurn || isAiThinking) return

    if (phase === MOVE_PIECE && selectedPiece) {
      const isValidDestination = validMoves.some((m) => m.r === r && m.c === c)
      if (!isValidDestination) return

      // Fluidly update pieces for the slide effect
      playSound('move')
      const nextPieces = pieces.map(p => {
        if (p.r === selectedPiece.r && p.c === selectedPiece.c) return { ...p, r, c }
        return p
      })
      const nextBoard = cloneBoard(board)
      nextBoard[selectedPiece.r][selectedPiece.c] = EMPTY
      nextBoard[r][c] = turn

      setMovedFrom({ ...selectedPiece })
      setGameState({ board: nextBoard, pieces: nextPieces, flames })
      setSelectedPiece({ r, c })
      setValidMoves(calculateValidMoves(r, c, nextBoard))
      setPhase(SHOOT_ARROW)
      return
    }

    if (phase === SHOOT_ARROW && selectedPiece) {
      const isValidArrow = validMoves.some((m) => m.r === r && m.c === c)
      if (!isValidArrow) return

      playSound('shoot')
      const nextBoard = cloneBoard(board)
      nextBoard[r][c] = BURNED

      const nextFlames = [...flames, { key: `flame-${turnNumber}`, r, c, player: turn }]

      setGameState({ board: nextBoard, pieces, flames: nextFlames })
      if (movedFrom) {
        setLastAction({ from: movedFrom, to: selectedPiece, arrow: { r, c }, player: turn, turnNumber })
      }
      setTurn(turn === WHITE ? BLACK : WHITE)
      setTurnNumber((n) => n + 1)
      setPhase(SELECT_PIECE)
      setSelectedPiece(null)
      setMovedFrom(null)
      setValidMoves([])
    }
  }

  const phaseText = phase === SELECT_PIECE ? 'Move a piece' : phase === MOVE_PIECE ? 'Choose destination' : 'Shoot an arrow'

  return (
    <div className="game-shell flex flex-col items-center justify-start sm:px-4 py-4 min-h-screen">
      
      {/* Header and Controls */}
      <div className="w-full max-w-[800px] px-3 sm:px-0 flex flex-col gap-3 mb-4">
        <header className="panel-card rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold heading-primary m-0">Game of Amazons</h1>
            <p className="text-xs sm:text-sm subtext mt-0.5 m-0">Territory tactics. One move, one arrow.</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleSound} 
              className="p-2 rounded-full hover:bg-[var(--border-subtle)] transition-colors"
              aria-label="Toggle Sound"
            >
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <button
              onClick={() => setIsRulesOpen(true)}
              className="btn-outline rounded-md px-3 py-1.5 text-sm inline-flex items-center gap-1.5"
            >
              <BookOpen size={16} /> <span className="hidden sm:inline">Rules</span>
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="btn-primary rounded-md px-3 py-1.5 text-sm inline-flex items-center gap-1.5"
            >
              <Settings size={16} /> <span>Settings</span>
            </button>
          </div>
        </header>

        {/* Status Strip */}
        <section className="panel-card rounded-xl px-4 py-3">
          {winner ? (
            <div className="text-center text-xl sm:text-2xl font-black drop-shadow-md animate-pulse">
              <span style={{ color: winner === WHITE ? '#ffffff' : '#94a3b8' }}>
                {PLAYER_LABELS[winner]}
              </span>
              <span style={{ color: '#fbbf24' }}> wins!</span>
            </div>
          ) : (
            <div className="status-grid">
              <div>
                <span className="status-kicker">Next Move</span>
                <p className="status-value">{PLAYER_LABELS[turn]} <span className="text-[var(--accent-selected)]">— {phaseText}</span></p>
              </div>
              <div className="hidden sm:block">
                <span className="status-kicker">Last Move</span>
                {lastAction ? (
                  <p className="status-value text-[13px]">
                    {PLAYER_LABELS[lastAction.player]} {toCoordLabel(lastAction.from.r, lastAction.from.c)} ➔ {toCoordLabel(lastAction.to.r, lastAction.to.c)} (Arrow {toCoordLabel(lastAction.arrow.r, lastAction.arrow.c)})
                  </p>
                ) : (
                  <p className="status-value subtext">No moves</p>
                )}
              </div>
              <div className="text-left sm:text-right">
                {isAiThinking ? (
                  <p className="text-orange-400 font-medium animate-pulse text-sm">{CONTROLLER_LABELS[turnController]} thinking...</p>
                ) : (
                  <p className="text-sm subtext">W: {CONTROLLER_LABELS[whiteController]} | B: {CONTROLLER_LABELS[blackController]}</p>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Main Board Area */}
      <div className="w-full max-w-[800px] px-3 sm:px-0 pb-12 flex justify-center">
        <FluidBoard
          boardSize={boardSize}
          pieces={pieces}
          flames={flames}
          selectedPiece={selectedPiece}
          validMoves={validMoves}
          phase={phase}
          onSquareClick={handleSquareClick}
          onPieceClick={handlePieceClick}
          lastAction={lastAction}
        />
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="settings-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="panel-card rounded-xl p-5 max-w-[500px] w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Settings</h2>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 hover:bg-[var(--border-subtle)] rounded-md"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Size
                <select value={boardSize} onChange={(e) => setBoardSize(Number(e.target.value))} className="control-input">
                  <option value={6}>6 x 6</option><option value={8}>8 x 8</option><option value={10}>10 x 10</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Mode
                <select value={gameMode} onChange={(e) => setGameMode(e.target.value)} className="control-input">
                  <option value={GAME_MODES.PVP}>2 Players Local</option>
                  <option value={GAME_MODES.VS_AI_AS_WHITE}>Vs AI (White)</option>
                  <option value={GAME_MODES.VS_AI_AS_BLACK}>Vs AI (Black)</option>
                  <option value={GAME_MODES.AI_VS_AI}>AI vs AI Demo</option>
                </select>
              </label>
            </div>

            {(gameMode === GAME_MODES.VS_AI_AS_WHITE || gameMode === GAME_MODES.VS_AI_AS_BLACK) && (
              <label className="flex flex-col gap-1 mt-3 text-sm font-medium">
                AI Engine
                <select value={humanVsAiController} onChange={(e) => setHumanVsAiController(e.target.value)} className="control-input">
                  <option value={AI_CONTROLLERS.MAX}>Max (Minimax)</option>
                  <option value={AI_CONTROLLERS.CARLO}>Carlo (MCTS)</option>
                </select>
              </label>
            )}

            {gameMode === GAME_MODES.AI_VS_AI && (
               <div className="mt-3 grid gap-3 sm:grid-cols-2">
                 <label className="flex flex-col gap-1 text-sm font-medium">White <select value={aiWhiteController} onChange={(e) => setAiWhiteController(e.target.value)} className="control-input"><option value={AI_CONTROLLERS.MAX}>Max</option><option value={AI_CONTROLLERS.CARLO}>Carlo</option></select></label>
                 <label className="flex flex-col gap-1 text-sm font-medium">Black <select value={aiBlackController} onChange={(e) => setAiBlackController(e.target.value)} className="control-input"><option value={AI_CONTROLLERS.MAX}>Max</option><option value={AI_CONTROLLERS.CARLO}>Carlo</option></select></label>
                 <label className="col-span-2 flex flex-col gap-1 text-sm font-medium">Delay ({spectatorDelayMs}ms) <input type="range" min={300} max={2600} step={100} value={spectatorDelayMs} onChange={(e) => setSpectatorDelayMs(Number(e.target.value))} className="w-full" /></label>
               </div>
            )}

            <div className="mt-5 flex justify-end">
              <button 
                onClick={() => { resetGame(); setIsSettingsOpen(false) }} 
                className="btn-outline px-4 py-2 rounded-md font-medium text-sm"
              >
                Apply & Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {isRulesOpen && (
        <div className="settings-overlay" onClick={() => setIsRulesOpen(false)}>
          <div className="panel-card rounded-xl p-5 sm:p-6 max-w-[500px] w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 border-b border-[var(--border-subtle)] pb-3">
              <h2 className="text-xl font-bold flex items-center gap-2"><BookOpen className="text-[var(--accent-selected)]" size={20} /> How to Play</h2>
              <button 
                onClick={() => setIsRulesOpen(false)}
                className="p-1.5 hover:bg-[var(--border-subtle)] rounded-md transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 text-sm leading-relaxed">
              <p>
                <strong>Game of Amazons</strong> is a territorial strategy game played on a grid, usually 10x10. 
                Both players start with 4 Queens ("Amazons").
              </p>

              <div>
                <h3 className="font-bold text-[var(--accent-selected)] mb-1">The Goal</h3>
                <p>
                  Trap your opponent! The game ends when a player has no legal moves left on their turn. 
                  <strong> The last player to move wins.</strong>
                </p>
              </div>

              <div>
                <h3 className="font-bold text-[var(--accent-selected)] mb-1">The Turn</h3>
                <p>Every turn consists of exactly <strong>two actions</strong>:</p>
                <ol className="list-decimal pl-5 mt-1 space-y-1">
                  <li><strong>Slide:</strong> Move one of your Queens any number of squares horizontally, vertically, or diagonally (exactly like a Chess Queen).</li>
                  <li><strong>Shoot:</strong> From her new square, that Queen shoots a flaming arrow. The arrow also flies like a Chess queen and permanently burns the landing square.</li>
                </ol>
              </div>

              <div>
                <h3 className="font-bold text-[var(--accent-selected)] mb-1">The Catch</h3>
                <p>
                  Queens and arrows <strong>cannot</strong> pass through or land on other Queens, nor can they pass through burnt flame squares. 
                  Every turn, the board shrinks by one flame, making the space tighter and tighter until someone is suffocated out of moves!
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end pt-3 border-t border-[var(--border-subtle)]">
              <button 
                onClick={() => setIsRulesOpen(false)} 
                className="btn-primary px-5 py-2 rounded-md font-medium text-sm"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default App
