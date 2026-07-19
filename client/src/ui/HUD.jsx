import { useGame } from '../state/GameProvider.jsx'

function formatTime(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function HUD() {
  const { state, modeData, maxHints } = useGame()
  const warn = state.remaining <= 60
  const solvedCount = state.solvedStages.length
  const totalStages = modeData.stages.filter((s) => !s.isFinal).length

  return (
    <div className="hud">
      <div className="hud-badge">
        {modeData.title} · 단서 {solvedCount}/{totalStages}
      </div>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
        <div className={`hud-badge hud-timer${warn ? ' warn' : ''}`}>{formatTime(state.remaining)}</div>
        <div className="hud-badge" title="문제 화면 안에서 힌트를 사용할 수 있습니다">
          HINT {maxHints - state.hintsUsed}/{maxHints}
        </div>
      </div>
    </div>
  )
}
