import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import GameCanvas from '../game/GameCanvas.jsx'
import { useGame } from '../state/GameProvider.jsx'
import { TILE, INTERACT_RANGE } from '../game/constants.js'
import { MAP_W, MAP_H, ZONES } from '../game/map.js'
import HUD from './HUD.jsx'
import PuzzleModal from './puzzles/PuzzleModal.jsx'
import SatDeskModal from './puzzles/SatDeskModal.jsx'
import GhostJumpscare from './GhostJumpscare.jsx'
import VirtualJoystick from './VirtualJoystick.jsx'
import { computeIsMobile } from '../utils/device.js'

// prop 하나가 여러 stage(예: 유언장→최종 폰)를 순서대로 대표할 수 있다.
// 아직 안 풀린 첫 stage를 "지금 상호작용 대상"으로 고른다.
function pickPropStage(prop, modeData, state) {
  const keys = prop.stageKeys || (prop.stageKey ? [prop.stageKey] : [])
  for (const key of keys) {
    const stage = modeData.stages.find((s) => s.key === key)
    if (stage && !state.solvedStages.includes(key)) return stage
  }
  const lastKey = keys[keys.length - 1]
  return modeData.stages.find((s) => s.key === lastKey) ?? null
}

export default function GameScreen() {
  const { state, modeData, openPuzzle, closePuzzle } = useGame()
  const [nearestId, setNearestId] = useState(null)
  const [toast, setToast] = useState('')
  const [ghostActive, setGhostActive] = useState(false)
  const [ghostPassed, setGhostPassed] = useState(false)
  const [satDeskOpen, setSatDeskOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(computeIsMobile)
  const [scale, setScale] = useState(1)
  const zone3EnteredRef = useRef(false)
  const toastTimerRef = useRef(null)
  const joystickRef = useRef({ x: 0, y: 0 })

  const mapObjects = modeData.props

  // 뷰포트에 맞춰 게임 화면 전체를 축소(transform: scale) — 좁은 화면에서도 잘리지 않게 하고,
  // 모바일에서는 하단 조이스틱이 겹치지 않도록 세로 공간을 미리 남겨둔다.
  useEffect(() => {
    function recompute() {
      const mobile = computeIsMobile()
      setIsMobile(mobile)
      const stageW = MAP_W * TILE
      const stageH = MAP_H * TILE
      const bottomReserve = mobile ? 170 : 0
      const availW = window.innerWidth - 24
      const availH = window.innerHeight - 24 - bottomReserve
      setScale(Math.min(1, availW / stageW, availH / stageH))
    }
    recompute()
    window.addEventListener('resize', recompute)
    window.addEventListener('orientationchange', recompute)
    return () => {
      window.removeEventListener('resize', recompute)
      window.removeEventListener('orientationchange', recompute)
    }
  }, [])

  const lockedIds = useMemo(() => {
    const s = new Set()
    for (const prop of mapObjects) {
      if (prop.kind === 'sat-desk') {
        if (!state.flags.zone3Unlocked) s.add(prop.id)
        continue
      }
      const stage = pickPropStage(prop, modeData, state)
      const available = stage?.requiresFlags.every((f) => state.flags[f])
      if (!available) s.add(prop.id)
    }
    return s
  }, [mapObjects, modeData, state])

  // 매 프레임 호출되지만, 여기서는 상태를 직접 갱신하지 않고(리렌더 방지) "가장 가까운 상호작용
  // 대상"이 실제로 바뀔 때만, 그리고 3번 구역 최초 진입 시에만 setState 한다.
  const handlePlayerMove = useCallback(
    (x, y) => {
      let best = null
      let bestDist = Infinity
      for (const prop of mapObjects) {
        const cx = (prop.x + prop.w / 2) * TILE
        const cy = (prop.y + prop.h / 2) * TILE
        const dist = Math.hypot(x - cx, y - cy)
        const threshold = INTERACT_RANGE + Math.max(prop.w, prop.h) * TILE * 0.5
        if (dist < threshold && dist < bestDist) {
          bestDist = dist
          best = prop
        }
      }
      const bestId = best?.id ?? null
      setNearestId((prev) => (prev === bestId ? prev : bestId))

      const zoneKey = modeData.ghost?.triggerZone
      const zone = zoneKey ? ZONES[zoneKey] : null
      if (zone && !zone3EnteredRef.current) {
        const inZone = x > zone.x * TILE && x < (zone.x + zone.w) * TILE && y > zone.y * TILE && y < (zone.y + zone.h) * TILE
        if (inZone) {
          zone3EnteredRef.current = true
          setGhostActive(true)
        }
      }
    },
    [mapObjects, modeData]
  )

  const nearest = useMemo(() => mapObjects.find((p) => p.id === nearestId) ?? null, [mapObjects, nearestId])

  function showToast(msg) {
    setToast(msg)
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(''), 1500)
  }

  const tryInteract = useCallback(() => {
    if (!nearest || state.activePuzzleStage || satDeskOpen) return

    if (nearest.kind === 'sat-desk') {
      if (!state.flags.zone3Unlocked) {
        showToast('아직 확인할 수 없다. 다른 단서가 먼저 필요하다.')
        return
      }
      setSatDeskOpen(true)
      return
    }

    const stage = pickPropStage(nearest, modeData, state)
    if (!stage) return
    const available = stage.requiresFlags.every((f) => state.flags[f])
    if (!available) {
      showToast('아직 확인할 수 없다. 다른 단서가 먼저 필요하다.')
      return
    }
    openPuzzle(stage.key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearest, state, satDeskOpen, modeData, openPuzzle])

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key.toLowerCase() === 'e' || e.key === 'Enter') tryInteract()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [tryInteract])

  const dismissGhost = useCallback(() => {
    setGhostActive(false)
    setGhostPassed(true)
  }, [])

  const promptLabel = useMemo(() => {
    if (!nearest) return null
    if (nearest.kind === 'sat-desk') {
      if (!state.flags.zone3Unlocked) return `잠겨있다 — ${nearest.label}`
      const solvedCount = modeData.satSubclues.filter((s) => state.satDigits[s.id] !== undefined).length
      return solvedCount === modeData.satSubclues.length ? `E — ${nearest.label} 다시 보기` : `E — ${nearest.label} 조사하기`
    }
    const stage = pickPropStage(nearest, modeData, state)
    if (!stage) return null
    const available = stage.requiresFlags.every((f) => state.flags[f])
    const solved = state.solvedStages.includes(stage.key)
    if (!available) return `잠겨있다 — ${nearest.label}`
    return solved ? `E — ${stage.name} 다시 보기` : `E — ${stage.name} 조사하기`
  }, [nearest, modeData, state])

  // 모달들은 position:fixed로 화면 전체를 덮어야 하므로 transform이 걸리는 .game-stage 밖(형제)에 둔다 —
  // transform이 걸린 조상 안에서는 fixed의 기준이 뷰포트가 아니라 그 조상이 되어버리기 때문.
  return (
    <>
      <div
        className="game-stage"
        style={{ width: MAP_W * TILE, height: MAP_H * TILE, transform: `scale(${scale})` }}
      >
        <GameCanvas
          mapObjects={mapObjects}
          lockedIds={lockedIds}
          flags={state.flags}
          flashlightMode={ghostPassed ? 'white' : 'uv'}
          ghostActive={ghostActive}
          onPlayerMove={handlePlayerMove}
          joystickRef={joystickRef}
        />
        <HUD />

        {nearest && (
          <div
            className="interact-prompt"
            style={{ left: (nearest.x + nearest.w / 2) * TILE, top: nearest.y * TILE }}
            onClick={tryInteract}
          >
            {promptLabel}
          </div>
        )}

        {toast && (
          <div className="interact-prompt" style={{ left: '50%', top: 20 }}>
            {toast}
          </div>
        )}
      </div>

      {isMobile && (
        <VirtualJoystick
          onMove={(x, y) => {
            joystickRef.current.x = x
            joystickRef.current.y = y
          }}
        />
      )}

      {state.activePuzzleStage && <PuzzleModal stageKey={state.activePuzzleStage} onClose={closePuzzle} />}
      {satDeskOpen && <SatDeskModal onClose={() => setSatDeskOpen(false)} />}
      {ghostActive && <GhostJumpscare onDone={dismissGhost} />}
    </>
  )
}
