import { useGame, MODE_DATA } from '../state/GameProvider.jsx'

export default function ModeSelect() {
  const { selectMode } = useGame()
  return (
    <div className="mode-select">
      <div className="fest">2026 HAFS FESTIVAL 「花様年華 : in bloom」 &times; TIMES</div>
      <h1>NIGHTMARE</h1>
      <p style={{ fontFamily: 'NanumYeDangCe, monospace', color: '#a89890', maxWidth: 560 }}>
        Memories of the Past — TIMES 방탈출 &lt;Nightmare&gt;를 재현한 웹게임입니다. 진행할 시나리오를 선택하세요.
      </p>
      <div className="mode-cards">
        {Object.values(MODE_DATA).map((m) => (
          <div
            key={m.id}
            className={`mode-card${m.disabled ? ' disabled' : ''}`}
            onClick={m.disabled ? undefined : () => selectMode(m.id)}
          >
            {m.disabled && <div className="mode-card-badge">준비 중</div>}
            <h3>{m.title}</h3>
            <p>{m.subtitle}</p>
            <p>{m.flavor}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
