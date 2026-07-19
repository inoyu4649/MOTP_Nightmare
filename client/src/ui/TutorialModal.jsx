import { useState } from 'react'
import { useGame } from '../state/GameProvider.jsx'
import { computeIsMobile } from '../utils/device.js'

export default function TutorialModal() {
  const { modeData, startPlaying } = useGame()
  const { intro, story } = modeData
  const [isMobile] = useState(computeIsMobile)

  return (
    <div className="overlay">
      <div className="panel">
        <div className="fest">{modeData.title}</div>
        <h2>줄거리</h2>
        <div>
          {story.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
        <h2 style={{ fontSize: '1.1rem' }}>게임 안내</h2>
        <ul className="clue-list">
          {intro.rules.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        <h2 style={{ fontSize: '1.1rem' }}>조작법</h2>
        <ul className="clue-list">
          {intro.controls.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
          {isMobile && <li>모바일 — 화면 우측 하단 가상 조이스틱으로 이동</li>}
        </ul>
        <div className="btn-row">
          <button className="btn primary" onClick={startPlaying}>
            입장하기
          </button>
        </div>
      </div>
    </div>
  )
}
