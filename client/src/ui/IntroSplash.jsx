import { useEffect, useState } from 'react'

// "made with Unity" 스타일 오프닝 — 각 단계가 자체 CSS 키프레임(introFade)으로 페이드인 → 유지 → 페이드아웃된다.
const PHASES = ['presents', 'warning']
const PHASE_DURATIONS = { presents: 4200, warning: 5400 }

export default function IntroSplash({ onDone }) {
  const [phaseIndex, setPhaseIndex] = useState(0)
  const phase = PHASES[phaseIndex]

  useEffect(() => {
    const t = setTimeout(() => {
      if (phaseIndex < PHASES.length - 1) setPhaseIndex((i) => i + 1)
      else onDone()
    }, PHASE_DURATIONS[phase])
    return () => clearTimeout(t)
  }, [phaseIndex, phase, onDone])

  return (
    <div className="intro-splash">
      <div key={phase} className="intro-panel" style={{ '--intro-dur': `${PHASE_DURATIONS[phase]}ms` }}>
        {phase === 'presents' ? (
          <>
            <div className="intro-fest">2026 HAFS FESTIVAL 「花様年華 : in bloom」</div>
            <div className="intro-title">TIMES</div>
            <div className="intro-sub">presents</div>
          </>
        ) : (
          <div className="intro-warning">
            <div className="intro-warning-title">광과민성 발작 주의</div>
            <p>이 게임에는 화면이 어두워지는 연출과 빠른 화면 전환, 밝은 빛의 번쩍임이 포함되어 있습니다.</p>
            <p>광과민성 발작 병력이 있으신 분은 진행에 유의하시기 바랍니다.</p>
          </div>
        )}
      </div>
    </div>
  )
}
