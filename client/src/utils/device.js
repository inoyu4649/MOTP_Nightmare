// 화면 하단 가상 조이스틱 노출 여부 — 터치 기기이거나 창이 좁으면 모바일로 취급한다.
export function computeIsMobile() {
  if (typeof window === 'undefined') return false
  const touchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || !!window.matchMedia?.('(pointer: coarse)').matches
  return touchCapable || window.innerWidth <= 820
}
