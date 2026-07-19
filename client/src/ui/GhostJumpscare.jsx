import { useEffect, useState } from 'react'

// Staff C 역할 재현: 3번 문제 구역에 발을 들이는 즉시 아주 짧게 등장하는 점프스케어 + 화면 더블 플래시.
export default function GhostJumpscare({ onDone }) {
  const [visible, setVisible] = useState(true)
  const [flashOn, setFlashOn] = useState(false)

  useEffect(() => {
    const timers = []
    function pulse(delay) {
      timers.push(setTimeout(() => setFlashOn(true), delay))
      timers.push(setTimeout(() => setFlashOn(false), delay + 70))
    }
    pulse(0)
    pulse(160)
    timers.push(
      setTimeout(() => {
        setVisible(false)
        onDone()
      }, 480)
    )
    return () => timers.forEach(clearTimeout)
  }, [onDone])

  if (!visible) return null
  return (
    <div className="jumpscare">
      <div className="jumpscare-figure" />
      <div className={`jumpscare-flash${flashOn ? ' on' : ''}`} />
    </div>
  )
}
