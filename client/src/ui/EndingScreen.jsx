import { useEffect, useRef } from 'react'
import { useGame } from '../state/GameProvider.jsx'

export default function EndingScreen() {
  const { state, modeData, reset } = useGame()
  const petalHostRef = useRef(null)
  const success = state.ending?.result === 'success'

  useEffect(() => {
    if (!success) return
    const host = petalHostRef.current
    const timer = setInterval(() => {
      const p = document.createElement('div')
      p.className = 'petal'
      const size = 8 + Math.random() * 14
      p.style.width = size + 'px'
      p.style.height = size * 1.25 + 'px'
      p.style.left = Math.random() * 100 + 'vw'
      p.style.setProperty('--fd', (6 + Math.random() * 6).toFixed(1) + 's')
      p.style.setProperty('--sw', Math.floor(-90 + Math.random() * 180) + 'px')
      p.style.setProperty('--r0', Math.floor(Math.random() * 360) + 'deg')
      host?.appendChild(p)
      setTimeout(() => p.remove(), 13000)
    }, 220)
    return () => clearInterval(timer)
  }, [success])

  const line = success
    ? state.ending.bonus
      ? `${modeData.ending.success}\n${modeData.ending.bonus}`
      : modeData.ending.success
    : modeData.ending.timeout

  return (
    <div id="success" ref={petalHostRef}>
      <div className="s-content">
        <h2>{success ? 'ESCAPE' : 'TIME OVER'}</h2>
        {line.split('\n').map((l, i) => (
          <p className="s-line" key={i}>
            {l}
          </p>
        ))}
        <p className="s-line" style={{ opacity: 0.6 }}>
          2026 HAFS FESTIVAL 「花様年華 : in bloom」 · ESCAPE ROOM by TIMES
        </p>
        <button className="btn primary" onClick={reset}>
          처음 화면으로
        </button>
      </div>
    </div>
  )
}
