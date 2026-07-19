import { useGame } from '../../state/GameProvider.jsx'
import KeypadLock from './KeypadLock.jsx'

export default function PuzzleModal({ stageKey, onClose }) {
  const { state, modeData, solveStage, useHint, maxHints } = useGame()
  const stage = modeData.stages.find((s) => s.key === stageKey)
  const solved = state.solvedStages.includes(stageKey)
  const hintLevel = state.hintLevelByStage[stageKey] || 0
  const hintsRemaining = maxHints - state.hintsUsed

  if (!stage) return null

  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="fest">{modeData.title}</div>
        <h2>{stage.name}</h2>

        {renderEvidence(stage)}

        {stage.hints?.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="btn-row" style={{ justifyContent: 'flex-start' }}>
              <button
                className="btn"
                disabled={hintsRemaining <= 0 || hintLevel >= stage.hints.length}
                onClick={() => useHint(stageKey)}
              >
                힌트 보기 (남은 힌트 {hintsRemaining})
              </button>
            </div>
            {Array.from({ length: hintLevel }).map((_, i) => (
              <div className="hint-box" key={i}>
                💡 {stage.hints[i]}
              </div>
            ))}
          </div>
        )}

        {solved ? (
          <>
            <div className="solved-banner">✔ {stage.resultText}</div>
            <div className="btn-row">
              <button className="btn primary" onClick={onClose}>
                닫기
              </button>
            </div>
          </>
        ) : (
          <KeypadLock
            mode={modeData.id}
            stageKey={stage.key}
            codeLength={stage.codeLength}
            onSuccess={() => solveStage(stage.key)}
          />
        )}

        {!stage.isFinal && (
          <div className="btn-row">
            <button className="btn" onClick={onClose}>
              나가기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function renderEvidence(stage) {
  switch (stage.kind) {
    case 'will':
      return (
        <>
          <div className="evidence-images">
            {stage.images.map((src) => (
              <img key={src} src={src} alt="유언장" />
            ))}
          </div>
          <ul className="clue-list">
            {stage.clueText.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </>
      )
    case 'draftWill':
      return (
        <>
          <ul className="clue-list">
            {stage.clueText.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </>
      )
    case 'roster':
      return (
        <>
          <div className="evidence-images">
            {stage.images.map((src) => (
              <img key={src} src={src} alt="명단/앨범" />
            ))}
          </div>
          <ul className="clue-list">
            {stage.clueText.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </>
      )
    case 'draftRoster':
      return (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: '0.4rem',
              maxWidth: 360,
            }}
          >
            {stage.placeholderRoster.map((n) => {
              const missing = n === stage.missingNumber
              return (
                <div
                  key={n}
                  style={{
                    border: '1px solid #3a2a24',
                    borderRadius: 3,
                    padding: '0.6rem 0',
                    textAlign: 'center',
                    fontFamily: 'NanumYeDangCe, monospace',
                    fontSize: '0.8rem',
                    color: missing ? '#584b45' : '#c9beb7',
                    background: missing ? 'repeating-linear-gradient(45deg,#150e0c,#150e0c 4px,#0a0706 4px,#0a0706 8px)' : '#0a0706',
                  }}
                >
                  {missing ? '?' : n}
                </div>
              )
            })}
          </div>
          <ul className="clue-list">
            {stage.clueText.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </>
      )
    case 'textbook':
      return (
        <ul className="clue-list">
          {stage.clueText.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      )
    case 'final':
      return (
        <p>
          교실 출구가 굳게 잠겨 있다. 지금까지 알아낸 탈출 코드를 입력하라.
        </p>
      )
    default:
      return null
  }
}
