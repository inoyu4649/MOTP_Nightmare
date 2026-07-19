import { useEffect, useState } from 'react'

// TIMES 인트로가 뜨기 전, 커스텀 폰트(Onryou/NanumYeDangCe)가 실제로 로드될 때까지 대기한다.
// document.fonts.ready만 기다리면 아직 아무도 그 폰트를 쓴 적이 없어 요청조차 안 됐을 수 있으므로
// document.fonts.load()로 명시적으로 로드를 트리거한 뒤 기다린다.
const MIN_VISIBLE_MS = 1200
const FADE_OUT_MS = 450

export default function LoadingScreen({ onDone }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const minWait = new Promise((resolve) => setTimeout(resolve, MIN_VISIBLE_MS))
    const fontsWait = (async () => {
      try {
        if (document.fonts) {
          await Promise.all([document.fonts.load('1em Onryou'), document.fonts.load('1em NanumYeDangCe')])
          await document.fonts.ready
        }
      } catch {
        // Font Loading API 미지원 브라우저 — 그냥 진행
      }
    })()
    Promise.all([minWait, fontsWait]).then(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    const t = setTimeout(onDone, FADE_OUT_MS)
    return () => clearTimeout(t)
  }, [ready, onDone])

  return (
    <div className="loading-screen">
      <div className={`loading-content${ready ? ' loading-fade' : ''}`}>
        <div className="loading-ember" />
        <div className="loading-dots">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  )
}
