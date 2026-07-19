import { useState } from 'react'
import { useGame } from '../../state/GameProvider.jsx'

// SAT 소문제 하나의 순수 콘텐츠(오버레이 없음) — SatDeskModal 안에서 펼쳐 보여준다.
export default function SatSubcluePanel({ subclue, onBack }) {
  const { state, useHint, maxHints, recordSatDigit, solveStage, modeData } = useGame()
  const [wrong, setWrong] = useState(false)
  const [checked, setChecked] = useState(new Set())

  const solvedDigit = state.satDigits[subclue.id]
  const solved = solvedDigit !== undefined
  const hintLevel = state.hintLevelByStage[subclue.id] || 0
  const hintsRemaining = maxHints - state.hintsUsed

  function submit(value) {
    if (solved) return
    if (value === subclue.answer) {
      recordSatDigit(subclue.id, subclue.answer)
      const required = modeData.satSubclues.map((s) => s.id)
      const merged = { ...state.satDigits, [subclue.id]: subclue.answer }
      if (required.every((r) => r in merged)) solveStage('sat')
    } else {
      setWrong(true)
      setTimeout(() => setWrong(false), 500)
    }
  }

  function toggleChar(i) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <div className={wrong ? 'shake' : ''} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h2>
        {subclue.title} <span style={{ fontSize: '0.9rem', color: '#a89890' }}>({subclue.color})</span>
      </h2>

      {subclue.kind === 'lettercount' ? (
        <p style={{ fontFamily: 'NanumYeDangCe, monospace', lineHeight: 2 }}>
          {subclue.prompt.split('').map((ch, i) => {
            const isTarget = /[uw]/i.test(ch)
            // 원본 단서 재현: 문장 첫 번째 W만 절반에 핑크 형광펜이 칠해져 있다
            const halfPink = i === subclue.prompt.toLowerCase().indexOf('w')
              ? 'linear-gradient(90deg, rgba(201,63,122,0.6) 0%, rgba(201,63,122,0.6) 50%, transparent 50%)'
              : 'transparent'
            const on = checked.has(i)
            return (
              <span
                key={i}
                onClick={() => isTarget && toggleChar(i)}
                style={{
                  cursor: isTarget ? 'pointer' : 'default',
                  background: on ? 'rgba(196,14,14,0.45)' : halfPink,
                  borderRadius: 2,
                  padding: isTarget ? '0 1px' : 0,
                }}
              >
                {ch}
              </span>
            )
          })}
        </p>
      ) : (
        <p>{subclue.prompt}</p>
      )}

      {subclue.note && <p style={{ color: '#a89890', fontSize: '0.85rem' }}>{subclue.note}</p>}

      {subclue.kind === 'alphabet' && (
        <p style={{ fontFamily: 'NanumYeDangCe, monospace' }}>
          {subclue.given.letter} = {subclue.given.value} 이라면, {subclue.target}는?
        </p>
      )}

      {solved ? (
        <div className="solved-banner">✔ 이 문제의 숫자는 {solvedDigit} 입니다.</div>
      ) : (
        <>
          {subclue.hints?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div className="btn-row" style={{ justifyContent: 'flex-start' }}>
                <button
                  className="btn"
                  disabled={hintsRemaining <= 0 || hintLevel >= subclue.hints.length}
                  onClick={() => useHint(subclue.id)}
                >
                  힌트 보기 (남은 힌트 {hintsRemaining})
                </button>
              </div>
              {Array.from({ length: hintLevel }).map((_, i) => (
                <div className="hint-box" key={i}>
                  💡 {subclue.hints[i]}
                </div>
              ))}
            </div>
          )}

          <div className="pad" style={{ gridTemplateColumns: 'repeat(5, 56px)' }}>
            {buildOptions(subclue).map(({ label, value }) => (
              <button key={label} onClick={() => submit(value)} disabled={wrong}>
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="btn-row">
        <button className="btn" onClick={onBack}>
          ← 목록으로
        </button>
      </div>
    </div>
  )
}

function buildOptions(subclue) {
  if (subclue.kind === 'numberline') {
    return subclue.options.map((n) => ({ label: String(n), value: n }))
  }
  if (subclue.kind === 'alphabet') {
    return subclue.letters.map((letter, i) => ({
      label: letter === subclue.given.letter ? `${letter} (${subclue.given.value})` : letter,
      value: i + 1,
    }))
  }
  return Array.from({ length: 10 }, (_, n) => ({ label: String(n), value: n }))
}
