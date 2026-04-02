// ai.worker.js
// Dedicated Web Worker to offload AI computation from the Main UI Thread.

import { findBestMoveMax } from './aiEngine'
import { findBestMoveCarlo } from './aiCarlo'

self.onmessage = (e) => {
  const { board, turn, controller, showAiInsights } = e.data

  let aiResult = null

  if (controller === 'carlo') {
    aiResult = findBestMoveCarlo(board, turn, {
      timeMs: 2200,
      maxIterations: 15000,
      returnAnalysis: showAiInsights
    })
  } else if (controller === 'max') {
    aiResult = findBestMoveMax(board, turn, {
      maxDepth: 7,
      timeMs: 2200,
      returnAnalysis: showAiInsights
    })
  }

  // aiResult may be null if no moves are found, or an object { move, analysis } if insights are true,
  // or just the move directly if insights are false.
  
  if (!aiResult) {
    self.postMessage(null)
    return
  }

  if (showAiInsights) {
    self.postMessage(aiResult)
  } else {
    self.postMessage({ move: aiResult, analysis: null })
  }
}
