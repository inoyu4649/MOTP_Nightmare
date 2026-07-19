import { useCallback, useRef, useState } from 'react'

// 베이스는 화면에 고정된 원 — 손가락을 어디서 떼도 다음 터치는 항상 이 위치를 기준으로 계산한다.
const BASE_RADIUS = 55

export default function VirtualJoystick({ onMove }) {
  const baseRef = useRef(null)
  const activePointerId = useRef(null)
  const originRef = useRef({ x: 0, y: 0 })
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const [active, setActive] = useState(false)

  const updateFromPoint = useCallback(
    (clientX, clientY) => {
      const { x: ox, y: oy } = originRef.current
      let dx = clientX - ox
      let dy = clientY - oy
      const dist = Math.hypot(dx, dy)
      if (dist > BASE_RADIUS) {
        dx = (dx / dist) * BASE_RADIUS
        dy = (dy / dist) * BASE_RADIUS
      }
      setKnob({ x: dx, y: dy })
      onMove(dx / BASE_RADIUS, dy / BASE_RADIUS)
    },
    [onMove]
  )

  function handlePointerDown(e) {
    if (activePointerId.current !== null) return
    e.preventDefault()
    const rect = baseRef.current.getBoundingClientRect()
    originRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    activePointerId.current = e.pointerId
    baseRef.current.setPointerCapture(e.pointerId)
    setActive(true)
    updateFromPoint(e.clientX, e.clientY)
  }

  function handlePointerMove(e) {
    if (activePointerId.current !== e.pointerId) return
    e.preventDefault()
    updateFromPoint(e.clientX, e.clientY)
  }

  function endDrag(e) {
    if (activePointerId.current !== e.pointerId) return
    activePointerId.current = null
    setActive(false)
    setKnob({ x: 0, y: 0 })
    onMove(0, 0)
  }

  return (
    <div className="virtual-joystick">
      <div
        ref={baseRef}
        className={`joystick-base${active ? ' active' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="joystick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
    </div>
  )
}
