import { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react'
import memoryModeData from '../data/memoryModeData.js'
import draftModeData from '../data/draftModeData.js'

export const MODE_DATA = {
  memory: memoryModeData,
  draft: draftModeData,
}

const TOTAL_SECONDS = 15 * 60
const BONUS_CUTOFF_SECONDS = 10 * 60
const MAX_HINTS = 2

const initialState = {
  screen: 'modeSelect', // modeSelect | tutorial | playing | ending
  mode: null,
  flags: {},
  solvedStages: [],
  hintsUsed: 0,
  hintLevelByStage: {},
  remaining: TOTAL_SECONDS,
  timerRunning: false,
  activePuzzleStage: null,
  satDigits: {},
  ending: null, // { result: 'success' | 'timeout', bonus: boolean }
}

function reducer(state, action) {
  switch (action.type) {
    case 'SELECT_MODE':
      return {
        ...initialState,
        screen: 'tutorial',
        mode: action.mode,
      }
    case 'START_PLAYING':
      return { ...state, screen: 'playing', timerRunning: true }
    case 'OPEN_PUZZLE':
      return { ...state, activePuzzleStage: action.stageKey }
    case 'CLOSE_PUZZLE':
      return { ...state, activePuzzleStage: null }
    case 'SOLVE_STAGE': {
      if (state.solvedStages.includes(action.stageKey)) return state
      const nextFlags = { ...state.flags }
      for (const f of action.unlocksFlags || []) nextFlags[f] = true
      return {
        ...state,
        solvedStages: [...state.solvedStages, action.stageKey],
        flags: nextFlags,
      }
    }
    case 'USE_HINT': {
      if (state.hintsUsed >= MAX_HINTS) return state
      const currentLevel = state.hintLevelByStage[action.stageKey] || 0
      return {
        ...state,
        hintsUsed: state.hintsUsed + 1,
        hintLevelByStage: { ...state.hintLevelByStage, [action.stageKey]: currentLevel + 1 },
      }
    }
    case 'RECORD_SAT_DIGIT':
      return { ...state, satDigits: { ...state.satDigits, [action.id]: action.digit } }
    case 'TICK': {
      if (!state.timerRunning) return state
      const remaining = Math.max(0, state.remaining - 1)
      if (remaining === 0) {
        return {
          ...state,
          remaining,
          timerRunning: false,
          screen: 'ending',
          ending: { result: 'timeout', bonus: false },
        }
      }
      return { ...state, remaining }
    }
    case 'FINISH_SUCCESS': {
      const bonus = state.remaining >= TOTAL_SECONDS - BONUS_CUTOFF_SECONDS
      return {
        ...state,
        timerRunning: false,
        screen: 'ending',
        ending: { result: 'success', bonus },
      }
    }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

const GameContext = createContext(null)

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const tickRef = useRef(null)

  useEffect(() => {
    if (state.timerRunning) {
      tickRef.current = setInterval(() => dispatch({ type: 'TICK' }), 1000)
      return () => clearInterval(tickRef.current)
    }
  }, [state.timerRunning])

  const modeData = state.mode ? MODE_DATA[state.mode] : null

  const selectMode = useCallback((mode) => dispatch({ type: 'SELECT_MODE', mode }), [])
  const startPlaying = useCallback(() => dispatch({ type: 'START_PLAYING' }), [])
  const openPuzzle = useCallback((stageKey) => dispatch({ type: 'OPEN_PUZZLE', stageKey }), [])
  const closePuzzle = useCallback(() => dispatch({ type: 'CLOSE_PUZZLE' }), [])
  const useHint = useCallback((stageKey) => dispatch({ type: 'USE_HINT', stageKey }), [])
  const recordSatDigit = useCallback((id, digit) => dispatch({ type: 'RECORD_SAT_DIGIT', id, digit }), [])
  const reset = useCallback(() => dispatch({ type: 'RESET' }), [])

  const solveStage = useCallback(
    (stageKey) => {
      const stage = modeData?.stages.find((s) => s.key === stageKey)
      if (!stage) return
      if (stage.isFinal) {
        dispatch({ type: 'FINISH_SUCCESS' })
        return
      }
      dispatch({ type: 'SOLVE_STAGE', stageKey, unlocksFlags: stage.unlocksFlags })
    },
    [modeData]
  )

  const value = {
    state,
    modeData,
    maxHints: MAX_HINTS,
    totalSeconds: TOTAL_SECONDS,
    selectMode,
    startPlaying,
    openPuzzle,
    closePuzzle,
    useHint,
    recordSatDigit,
    solveStage,
    reset,
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}
