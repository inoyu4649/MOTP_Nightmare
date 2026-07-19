import { useEffect, useRef, useState } from 'react'

const FAIL_MESSAGES = [
  '…틀렸다.',
  '숫자가 맞지 않는다.',
  '다시 생각해보자.',
  '정답은 아직 다른 곳에 있다…',
]

// 서버(/api/verify)에 정답 판정을 위임 — python 레퍼런스와 동일하게 "정답은 클라이언트에 없다" 원칙을 유지.
export default function KeypadLock({ mode, stageKey, codeLength, onSuccess }) {
  const [code, setCode] = useState([])
  const [locked, setLocked] = useState(false)
  const [msg, setMsg] = useState('')
  const [flash, setFlash] = useState(false)
  const [shake, setShake] = useState(false)
  const failCountRef = useRef(0)
  const splatHostRef = useRef(null)

  useEffect(() => {
    function onKeyDown(e) {
      if (locked) return
      if (/^[0-9]$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') del()
      else if (e.key === 'Enter') submit()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, locked])

  function press(d) {
    if (locked || code.length >= codeLength) return
    setCode((c) => [...c, d])
  }
  function del() {
    if (locked) return
    setCode((c) => c.slice(0, -1))
  }

  function spawnSplats(n) {
    const host = splatHostRef.current
    if (!host) return
    for (let i = 0; i < n; i++) {
      const s = document.createElement('div')
      s.className = 'splat'
      s.style.left = 8 + Math.random() * 84 + 'vw'
      s.style.top = 8 + Math.random() * 80 + 'vh'
      document.body.appendChild(s)
      setTimeout(() => s.remove(), 1200)
    }
  }

  async function submit() {
    if (locked || code.length < codeLength) {
      setMsg(`숫자 ${codeLength}개를 모두 입력하라`)
      setTimeout(() => setMsg(''), 1400)
      return
    }
    setLocked(true)
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, stage: stageKey, code: code.join('') }),
      })
      const json = await res.json()
      if (json.result === 'open') {
        onSuccess()
        return
      }
      onFail()
    } catch {
      setMsg('…응답이 없다 (서버 오류)')
      setLocked(false)
    }
  }

  function onFail() {
    failCountRef.current += 1
    setShake(true)
    setFlash(true)
    spawnSplats(3)
    setMsg(FAIL_MESSAGES[(failCountRef.current - 1) % FAIL_MESSAGES.length])
    setTimeout(() => {
      setShake(false)
      setFlash(false)
    }, 700)
    setTimeout(() => {
      setCode([])
      setMsg('')
      setLocked(false)
    }, 1600)
  }

  return (
    <div className={`lockbox${shake ? ' shake' : ''}`} ref={splatHostRef}>
      <div className="slots">
        {Array.from({ length: codeLength }).map((_, i) => (
          <div key={i} className={`slot${i === code.length && !locked ? ' active' : ''}`}>
            {code[i] ?? ''}
          </div>
        ))}
      </div>
      <div className="keypad-msg">{msg}</div>
      <div className="pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} onClick={() => press(d)} disabled={locked}>
            {d}
          </button>
        ))}
        <button className="del" onClick={del} disabled={locked}>
          DEL
        </button>
        <button onClick={() => press('0')} disabled={locked}>
          0
        </button>
        <button className="open" onClick={submit} disabled={locked}>
          OPEN
        </button>
      </div>
      <div id="flash" className={flash ? 'on' : ''} />
    </div>
  )
}
