import { useEffect, useRef } from 'react'
import { Application, Container, Graphics, RenderTexture, Sprite, Text, TextStyle } from 'pixi.js'
import { TILE, PLAYER_RADIUS, PLAYER_SPEED } from './constants.js'
import {
  MAP_W,
  MAP_H,
  WALL_TILES,
  LOCKER_TILES,
  CHAIR_TILES,
  GATES,
  ENTRANCE,
  EXIT,
  GHOST,
} from './map.js'

const DIR_ANGLE = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }

const LIGHT_PRESETS = {
  uv: { length: 118, halfAngle: Math.PI / 6.2, tintColor: 0x7a4fe0, tintAlpha: 0.38, darkAlpha: 0.95 },
  white: { length: 215, halfAngle: Math.PI * 0.22, tintColor: 0xfff6e0, tintAlpha: 0.08, darkAlpha: 0.84 },
}

const GHOST_DASH_MS = 900

// 벽/사물함 타일은 전부 통과 불가 — O(1) 조회용 Set
const SOLID_TILES = new Set([...WALL_TILES, ...LOCKER_TILES].map(([x, y]) => `${x},${y}`))

// 벽/사물함/잠긴 게이트에 막혀 손전등 빛이 통과하지 못한다(레이마칭 기반 시야 폴리곤).
function isOpaqueLightAt(x, y, flags) {
  const tx = Math.floor(x / TILE)
  const ty = Math.floor(y / TILE)
  if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) return true
  if (SOLID_TILES.has(`${tx},${ty}`)) return true
  for (const g of GATES) {
    const unlocked = !!flags?.[g.requiresFlag]
    if (!unlocked && x >= g.x * TILE && x < (g.x + g.w) * TILE && y >= g.y * TILE && y < (g.y + g.h) * TILE) {
      return true
    }
  }
  return false
}

// 거리에 따라 밝기가 줄어드는 목표 감쇠 곡선 — x(0=플레이어, 1=사거리 끝)이 클수록 흐려진다.
function targetBrightness(x) {
  const cx = Math.min(1, Math.max(0, x))
  return 0.12 + 0.88 * Math.pow(1 - cx, 1.4)
}

// 원뿔을 여러 겹의 반경 밴드로 겹쳐 그려 방사형 감쇠를 흉내낸다. 'erase' 블렌드는 겹칠수록
// (1-alpha)가 곱해져 누적되므로, 각 밴드의 알파를 "바깥쪽 밴드부터 누적했을 때 정확히
// targetBrightness와 맞아떨어지도록" 역산해서, 눈에 띄는 계단 없이 매끄럽게 이어지게 한다.
const FALLOFF_BANDS = (() => {
  const N = 14
  const bands = []
  let prevRemaining = 1
  for (let i = 0; i < N; i++) {
    const t = 1 - (i / (N - 1)) * 0.94 // 1.0(사거리 끝) → 0.06(플레이어 근처)
    const remaining = 1 - targetBrightness(t)
    const alpha = prevRemaining <= 0 ? 1 : 1 - remaining / prevRemaining
    bands.push({ t, alpha: Math.max(0, Math.min(1, alpha)) })
    prevRemaining = remaining
  }
  return bands
})()

// 각 광선을 (방향, 막힌 거리)로 기록한다. hitTileDist: 광선을 막은 타일 좌표 → 그 타일을
// 처음 막은 거리(가장 가까운 값) — 타일 표면 전체를 밝히되, 거리에 비례해 밝기를 다르게 하기 위함.
function castRays(px, py, angle, halfAngle, length, flags, segments = 36, step = 2) {
  const rays = []
  const hitTileDist = new Map()
  for (let i = 0; i <= segments; i++) {
    const a = angle - halfAngle + 2 * halfAngle * (i / segments)
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    let dist = length
    let d = step
    while (d <= length) {
      const sx = px + dx * d
      const sy = py + dy * d
      if (isOpaqueLightAt(sx, sy, flags)) {
        dist = d
        const key = `${Math.floor(sx / TILE)},${Math.floor(sy / TILE)}`
        const prev = hitTileDist.get(key)
        if (prev === undefined || d < prev) hitTileDist.set(key, d)
        break
      }
      d += step
    }
    rays.push({ dx, dy, dist })
  }
  return { rays, hitTileDist }
}

// rays를 반경 radius로 잘라(막힌 지점이 더 가까우면 그대로 유지) 만든 폴리곤 — 밴드 감쇠용
function bandPoints(px, py, rays, radius) {
  const pts = [px, py]
  for (const r of rays) {
    const d = Math.min(r.dist, radius)
    pts.push(px + r.dx * d, py + r.dy * d)
  }
  return pts
}

// 귀신 동선(GHOST.path, 타일 좌표 폴리라인) 위에서 진행률 t(0~1) 지점의 픽셀 좌표
const ghostSegments = (() => {
  const pts = GHOST.path.map(([tx, ty]) => [tx * TILE, ty * TILE])
  const segs = []
  let total = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])
    segs.push({ from: pts[i], to: pts[i + 1], start: total, len })
    total += len
  }
  return { segs, total }
})()

function ghostPosAt(t) {
  const dist = Math.min(1, Math.max(0, t)) * ghostSegments.total
  for (const s of ghostSegments.segs) {
    if (dist <= s.start + s.len) {
      const k = s.len === 0 ? 0 : (dist - s.start) / s.len
      return { x: s.from[0] + (s.to[0] - s.from[0]) * k, y: s.from[1] + (s.to[1] - s.from[1]) * k }
    }
  }
  const last = ghostSegments.segs[ghostSegments.segs.length - 1]
  return { x: last.to[0], y: last.to[1] }
}

// NOTE: 실제 교실 맵 아트가 아직 없어, 절차적으로 그린 placeholder 도형으로 구성된 씬입니다.
// 지형(벽/게이트/책상/의자/문)은 map.js의 타일 그리드에서 그대로 파생됩니다.
export default function GameCanvas({ mapObjects, lockedIds, flags, flashlightMode, ghostActive, onPlayerMove, joystickRef }) {
  const hostRef = useRef(null)
  const appRef = useRef(null)
  const mapObjectsRef = useRef(mapObjects)
  const lockedIdsRef = useRef(lockedIds)
  const flagsRef = useRef(flags)
  const flashlightModeRef = useRef(flashlightMode)
  const ghostActiveRef = useRef(ghostActive)

  mapObjectsRef.current = mapObjects
  lockedIdsRef.current = lockedIds
  flagsRef.current = flags
  flashlightModeRef.current = flashlightMode
  ghostActiveRef.current = ghostActive

  useEffect(() => {
    let destroyed = false
    const app = new Application()
    const keysDown = new Set()
    // 입구 타일 중앙에서 시작
    const player = { x: (ENTRANCE.x + 0.5) * TILE, y: (ENTRANCE.y + 0.5) * TILE, dir: 'up' }

    function onKeyDown(e) {
      keysDown.add(e.key.toLowerCase())
    }
    function onKeyUp(e) {
      keysDown.delete(e.key.toLowerCase())
    }

    async function setup() {
      await app.init({
        width: MAP_W * TILE,
        height: MAP_H * TILE,
        backgroundColor: 0x050404,
        antialias: false,
      })
      if (destroyed) {
        app.destroy(true)
        return
      }
      appRef.current = app
      hostRef.current.appendChild(app.canvas)

      const world = new Container()
      app.stage.addChild(world)

      // ---- 바닥: 벽/사물함이 아닌 모든 타일에 어두운 체커 무늬 ----
      const floor = new Graphics()
      for (let y = 0; y < MAP_H; y++) {
        for (let x = 0; x < MAP_W; x++) {
          if (SOLID_TILES.has(`${x},${y}`)) continue
          const shade = (x + y) % 2 === 0 ? 0x1c1815 : 0x181410
          floor.rect(x * TILE, y * TILE, TILE, TILE).fill(shade)
        }
      }
      world.addChild(floor)

      // ---- 입구/출구 문 타일 ----
      const doors = new Graphics()
      doors.rect(ENTRANCE.x * TILE, ENTRANCE.y * TILE, TILE, TILE).fill(0x0e4a4a)
      doors
        .rect(ENTRANCE.x * TILE + 3, ENTRANCE.y * TILE + 3, TILE - 6, TILE - 6)
        .stroke({ width: 2, color: 0x18a0a0, alpha: 0.5 })
      doors.rect(EXIT.x * TILE, EXIT.y * TILE, TILE, TILE).fill(0x4a0e0e)
      doors
        .rect(EXIT.x * TILE + 3, EXIT.y * TILE + 3, TILE - 6, TILE - 6)
        .stroke({ width: 2, color: 0xa03030, alpha: 0.5 })
      world.addChild(doors)

      // ---- 벽 ----
      const walls = new Graphics()
      for (const [x, y] of WALL_TILES) {
        walls.rect(x * TILE, y * TILE, TILE, TILE).fill(0x2a2118)
        walls.rect(x * TILE, y * TILE + TILE - 3, TILE, 3).fill({ color: 0x000000, alpha: 0.35 })
      }
      world.addChild(walls)

      // ---- 사물함(장식용) — 칸마다 문짝 라인과 손잡이 ----
      const lockers = new Graphics()
      for (const [x, y] of LOCKER_TILES) {
        const px = x * TILE
        const py = y * TILE
        lockers.rect(px, py, TILE, TILE).fill(0x54430f)
        lockers.rect(px + 2, py + 2, TILE - 4, TILE - 4).stroke({ width: 1, color: 0x2e2408, alpha: 0.9 })
        lockers.rect(px + TILE - 9, py + TILE / 2 - 3, 3, 6).fill(0x8a7430) // 손잡이
        lockers.rect(px + 6, py + 6, TILE - 16, 2).fill({ color: 0x2e2408, alpha: 0.7 }) // 통풍구
        lockers.rect(px + 6, py + 11, TILE - 16, 2).fill({ color: 0x2e2408, alpha: 0.7 })
      }
      world.addChild(lockers)

      // ---- 게이트 (잠김/열림에 따라 매번 다시 그림) ----
      const gateLayer = new Container()
      world.addChild(gateLayer)
      function buildGates() {
        gateLayer.removeChildren()
        for (const g of GATES) {
          const unlocked = !!flagsRef.current?.[g.requiresFlag]
          const gg = new Graphics()
          const w = g.w * TILE
          const h = g.h * TILE
          if (unlocked) {
            gg.rect(0, 0, w, h).fill({ color: 0x2a2118, alpha: 0.1 })
          } else {
            gg.rect(0, 0, w, h).fill(0x3a1010)
            gg.rect(0, 0, w, h).stroke({ width: 2, color: 0x7a0202, alpha: 0.8 })
            // 잠긴 문의 빗장
            const bars = Math.max(2, Math.round(w / TILE) * 2)
            for (let i = 1; i <= bars; i++) {
              gg.rect((w / (bars + 1)) * i - 1, 3, 2, h - 6).fill({ color: 0x1a0505, alpha: 0.9 })
            }
          }
          gg.x = g.x * TILE
          gg.y = g.y * TILE
          gateLayer.addChild(gg)
        }
      }
      buildGates()

      // ---- 의자(장식) ----
      const chairs = new Graphics()
      for (const [x, y] of CHAIR_TILES) {
        const px = x * TILE
        const py = y * TILE
        chairs.rect(px + 6, py + 8, TILE - 12, TILE - 14).fill(0x362a20) // 좌판
        chairs.rect(px + 6, py + 5, TILE - 12, 4).fill(0x2c211a) // 등받이
      }
      world.addChild(chairs)

      // ---- 상호작용 오브젝트(문제 책상 등, 모드 데이터에서 옴) ----
      const propLayer = new Container()
      world.addChild(propLayer)

      function buildProps() {
        propLayer.removeChildren()
        mapObjectsRef.current.forEach((obj) => {
          const locked = lockedIdsRef.current?.has(obj.id)
          const g = new Graphics()
          const w = obj.w * TILE
          const h = obj.h * TILE
          g.rect(0, 0, w, h).fill(locked ? 0x231d1a : obj.color)
          g.rect(0, 0, w, h).stroke({ width: 2, color: locked ? 0x4a3f38 : 0xffffff, alpha: locked ? 0.5 : 0.18 })
          // 책상 상판 느낌의 안쪽 면
          g.rect(3, 3, w - 6, h - 6).stroke({ width: 1, color: 0x000000, alpha: 0.3 })
          g.x = obj.x * TILE
          g.y = obj.y * TILE
          propLayer.addChild(g)

          const label = new Text({
            text: (locked ? '🔒 ' : '') + obj.label,
            style: new TextStyle({ fill: locked ? 0x7a6f68 : 0xe8ddd6, fontSize: 11, fontFamily: 'NanumYeDangCe, monospace' }),
          })
          label.x = obj.x * TILE
          label.y = obj.y * TILE - 15
          propLayer.addChild(label)
        })
      }
      buildProps()
      appRef.current.rebuildProps = buildProps

      // ---- 플레이어 ----
      const playerGfx = new Graphics()
      function drawPlayer() {
        playerGfx.clear()
        playerGfx.circle(0, 0, PLAYER_RADIUS).fill(0xd8c8b8)
        playerGfx.circle(0, 0, PLAYER_RADIUS).stroke({ width: 1.5, color: 0x4a0000, alpha: 0.6 })
        let fx = 0
        let fy = 0
        if (player.dir === 'up') fy = -PLAYER_RADIUS - 4
        else if (player.dir === 'down') fy = PLAYER_RADIUS + 4
        else if (player.dir === 'left') fx = -PLAYER_RADIUS - 4
        else fx = PLAYER_RADIUS + 4
        playerGfx.circle(fx, fy, 3).fill(0xc4402a)
      }
      drawPlayer()
      world.addChild(playerGfx)

      // ---- 방향성 손전등(UV/흰색) — RenderTexture + erase 블렌드 ----
      const tintGfx = new Graphics()
      world.addChild(tintGfx)

      const darknessRT = RenderTexture.create({ width: MAP_W * TILE, height: MAP_H * TILE })
      const darknessContainer = new Container()
      const blackRect = new Graphics()
      const coneErase = new Graphics()
      coneErase.blendMode = 'erase'
      darknessContainer.addChild(blackRect)
      darknessContainer.addChild(coneErase)
      const darknessSprite = new Sprite(darknessRT)
      app.stage.addChild(darknessSprite)

      // ---- 귀신 — 어둠 위에 그려져 점프스케어 동안 항상 보인다 ----
      const ghostGfx = new Graphics()
      app.stage.addChild(ghostGfx)
      let ghostDashStart = null
      let prevGhostActive = false

      // ---- 충돌 ----
      function collidesWithRect(x, y, r, rx, ry, rw, rh) {
        return x + r > rx && x - r < rx + rw && y + r > ry && y - r < ry + rh
      }

      function collidesAt(x, y) {
        const r = PLAYER_RADIUS
        // 캔버스 밖으로는 못 나간다 (입구/출구 문 타일 위에는 설 수 있음)
        if (x - r < 0 || x + r > MAP_W * TILE || y - r < 0 || y + r > MAP_H * TILE) return true
        const minTx = Math.max(0, Math.floor((x - r) / TILE))
        const maxTx = Math.min(MAP_W - 1, Math.floor((x + r - 0.001) / TILE))
        const minTy = Math.max(0, Math.floor((y - r) / TILE))
        const maxTy = Math.min(MAP_H - 1, Math.floor((y + r - 0.001) / TILE))
        for (let ty = minTy; ty <= maxTy; ty++) {
          for (let tx = minTx; tx <= maxTx; tx++) {
            if (SOLID_TILES.has(`${tx},${ty}`)) return true
          }
        }
        for (const [tx, ty] of CHAIR_TILES) {
          if (collidesWithRect(x, y, r, tx * TILE + 4, ty * TILE + 4, TILE - 8, TILE - 8)) return true
        }
        for (const g of GATES) {
          const unlocked = !!flagsRef.current?.[g.requiresFlag]
          if (!unlocked && collidesWithRect(x, y, r, g.x * TILE, g.y * TILE, g.w * TILE, g.h * TILE)) return true
        }
        for (const obj of mapObjectsRef.current) {
          if (collidesWithRect(x, y, r, obj.x * TILE, obj.y * TILE, obj.w * TILE, obj.h * TILE)) return true
        }
        return false
      }

      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)

      let gateRebuildTimer = 0

      app.ticker.add(() => {
        let dx = 0
        let dy = 0
        if (keysDown.has('w') || keysDown.has('arrowup')) {
          dy = -1
          player.dir = 'up'
        }
        if (keysDown.has('s') || keysDown.has('arrowdown')) {
          dy = 1
          player.dir = 'down'
        }
        if (keysDown.has('a') || keysDown.has('arrowleft')) {
          dx = -1
          player.dir = 'left'
        }
        if (keysDown.has('d') || keysDown.has('arrowright')) {
          dx = 1
          player.dir = 'right'
        }

        // 키보드 입력이 없을 때만 가상 조이스틱(모바일) 입력을 사용 — 아날로그 값이라 대각선도 자연스럽다.
        if (dx === 0 && dy === 0 && joystickRef?.current) {
          const jx = joystickRef.current.x
          const jy = joystickRef.current.y
          if (Math.hypot(jx, jy) > 0.15) {
            dx = jx
            dy = jy
            player.dir = Math.abs(jx) > Math.abs(jy) ? (jx > 0 ? 'right' : 'left') : jy > 0 ? 'down' : 'up'
          }
        }

        const mag = Math.hypot(dx, dy)
        if (mag > 1) {
          dx /= mag
          dy /= mag
        }

        const nx = player.x + dx * PLAYER_SPEED
        const ny = player.y + dy * PLAYER_SPEED
        if (!collidesAt(nx, player.y)) player.x = nx
        if (!collidesAt(player.x, ny)) player.y = ny

        drawPlayer()
        playerGfx.x = player.x
        playerGfx.y = player.y

        // 손전등 원뿔 — 밴드형 방사 감쇠(가까울수록 밝고 멀수록 어둡게)
        const preset = LIGHT_PRESETS[flashlightModeRef.current] || LIGHT_PRESETS.uv
        const angle = DIR_ANGLE[player.dir] ?? 0
        const { rays, hitTileDist } = castRays(player.x, player.y, angle, preset.halfAngle, preset.length, flagsRef.current)

        tintGfx.clear()
        blackRect.clear()
        blackRect.rect(0, 0, MAP_W * TILE, MAP_H * TILE).fill({ color: 0x000000, alpha: preset.darkAlpha })
        coneErase.clear()
        for (const band of FALLOFF_BANDS) {
          const bp = bandPoints(player.x, player.y, rays, preset.length * band.t)
          tintGfx.poly(bp).fill({ color: preset.tintColor, alpha: preset.tintAlpha * band.alpha })
          coneErase.poly(bp).fill({ color: 0xffffff, alpha: band.alpha })
        }
        // 시야를 막은 벽/사물함/게이트 타일은 표면 전체가 보이되, 처음 감지된 거리만큼만 밝게
        for (const [key, dist] of hitTileDist) {
          const [htx, hty] = key.split(',').map(Number)
          const tileAlpha = targetBrightness(dist / preset.length)
          tintGfx.rect(htx * TILE, hty * TILE, TILE, TILE).fill({ color: preset.tintColor, alpha: preset.tintAlpha * tileAlpha })
          coneErase.rect(htx * TILE, hty * TILE, TILE, TILE).fill({ color: 0xffffff, alpha: tileAlpha })
        }
        // 플레이어 주변 아주 좁은 반경은 항상 살짝 보이게(발밑 확인용)
        coneErase.circle(player.x, player.y, 14).fill(0xffffff)
        app.renderer.render({ container: darknessContainer, target: darknessRT, clear: true })

        // 귀신 돌진 — zone3 진입(점프스케어 발동) 순간, 대기 의자에서 동선을 따라 달려나간다
        const ga = !!ghostActiveRef.current
        if (ga && !prevGhostActive) ghostDashStart = performance.now()
        prevGhostActive = ga
        ghostGfx.clear()
        if (ghostDashStart != null) {
          const t = (performance.now() - ghostDashStart) / GHOST_DASH_MS
          if (t >= 1) {
            ghostDashStart = null
          } else {
            const fade = t < 0.72 ? 1 : 1 - (t - 0.72) / 0.28
            for (let i = 3; i >= 1; i--) {
              const p = ghostPosAt(t - i * 0.055)
              ghostGfx.circle(p.x, p.y, 8 - i * 1.5).fill({ color: 0x9fb4d8, alpha: 0.16 * fade })
            }
            const p = ghostPosAt(t)
            ghostGfx.circle(p.x, p.y, 15).fill({ color: 0xbfd0e8, alpha: 0.14 * fade })
            ghostGfx.circle(p.x, p.y, 9).fill({ color: 0xe8f0fa, alpha: 0.85 * fade })
          }
        }

        // 게이트 잠금 상태는 자주 안 바뀌므로 20프레임마다만 갱신
        gateRebuildTimer++
        if (gateRebuildTimer >= 20) {
          gateRebuildTimer = 0
          buildGates()
        }

        if (onPlayerMove) onPlayerMove(player.x, player.y, player.dir)
      })
    }

    setup()

    return () => {
      destroyed = true
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      if (appRef.current) {
        appRef.current.destroy(true, { children: true })
        appRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    appRef.current?.rebuildProps?.()
  }, [mapObjects, lockedIds])

  return <div ref={hostRef} className="game-canvas-host" />
}
