import { useState } from 'react'
import { useGame } from '../../state/GameProvider.jsx'
import SatSubcluePanel from './SatSubcluePanel.jsx'

const SWATCH = { 핑크: '#c93f7a', 파랑: '#2b6dd8', 노랑: '#c9b021', 주황: '#d8792b' }

// SAT 교재 하나로 묶은 책상 — 표지 포스트잇(순서 단서) + 4개 소문제를 한 화면에서 오가며 풀 수 있다.
export default function SatDeskModal({ onClose }) {
  const { state, modeData } = useGame()
  const [expanded, setExpanded] = useState(null)

  const subclue = expanded ? modeData.satSubclues.find((s) => s.id === expanded) : null
  const solvedCount = modeData.satSubclues.filter((s) => state.satDigits[s.id] !== undefined).length
  const allSolved = solvedCount === modeData.satSubclues.length

  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="fest">{modeData.title} · SAT 교재</div>

        {subclue ? (
          <SatSubcluePanel subclue={subclue} onBack={() => setExpanded(null)} />
        ) : (
          <>
            <h2>SAT 교재</h2>
            <p>표지에 작은 포스트잇이 붙어 있다. 색깔 순서가 적혀 있는 듯하다.</p>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              {modeData.satOrder?.map((color, i) => (
                <div key={color} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 4, background: SWATCH[color] || '#888', border: '1px solid #000' }} />
                  <span style={{ fontFamily: 'NanumYeDangCe, monospace', fontSize: '0.75rem' }}>
                    {i + 1}. {color}
                  </span>
                </div>
              ))}
            </div>

            <p>색깔별로 표시된 문제를 아무 순서로나 풀어보자. ({solvedCount}/{modeData.satSubclues.length})</p>
            <ul className="clue-list" style={{ gap: '0.6rem' }}>
              {modeData.satSubclues.map((s) => {
                const solved = state.satDigits[s.id] !== undefined
                return (
                  <li key={s.id}>
                    <button className="btn" style={{ width: '100%', textAlign: 'left' }} onClick={() => setExpanded(s.id)}>
                      {solved ? '✔' : '▸'} {s.title} ({s.color}){solved ? ` — ${state.satDigits[s.id]}` : ''}
                    </button>
                  </li>
                )
              })}
            </ul>

            {allSolved && <div className="solved-banner">✔ 네 자리 숫자를 모두 알아냈다. 포스트잇 순서대로 조합해보자.</div>}

            <div className="btn-row">
              <button className="btn primary" onClick={onClose}>
                나가기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
