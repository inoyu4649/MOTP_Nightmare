// ============================================================================
// 맵 원본 데이터 (단일 진실 공급원)
//
// res/map1_concept.png 컨셉 이미지와, 사용자가 확정한 셀 단위 좌표 명세를
// 그대로 옮긴 15×11 타일 그리드. 좌표 표기는 1-indexed (행,열), (1,1)=좌상단.
// 코드 내부 좌표는 0-indexed (x=열-1, y=행-1).
//
// 기호 범례
//   #  벽 (외곽 테두리 + 내부 영구벽)
//   L  사물함(장식용) — (2,1)~(10,1). 통과 불가, 상호작용 없음
//   c  의자(장식) — (2,2)(3,2)(4,2)(9,2). 통과 불가
//   g  귀신 대기 장소(의자) — (9,4). 의자 장식 + 귀신 등장 지점
//   A  zone2 게이트 — (4,3). 문제1(유언장) 해결 전엔 벽
//   B  zone3 게이트 — (8,10)~(8,11). 문제2(명단·앨범) 해결 전엔 벽
//   1  문제1 책상(유언장·핸드폰) — (3,14)~(4,14)
//   2  문제2 책상(명단·앨범) — (6,2)~(7,2)
//   3  문제3 책상(SAT 교재) — (10,9)~(10,10)
//   E  입구 — (11,14)      X  출구 — (11,2)
//   .  바닥
//
// 게이트 위치는 사용자 벽 명세가 남긴 "유일한 틈"을 그대로 쓴다 (임의 보강벽 없음):
//   zone2 게이트 (4,3) — 상단 구역에서 중앙(2번) 구역으로 내려가는 유일한 통로.
//     (4,2) 의자가 옆 칸을 막아 자연스럽게 한 칸짜리 문이 된다.
//   zone3 게이트 (8,10)~(8,11) — (8,2)~(8,9) 벽과 12열 세로벽 사이의 틈.
// ============================================================================

const LAYOUT = [
  '###############', // 행 1
  'Lc............#', // 행 2
  'Lc...........1#', // 행 3
  'LcA..........1#', // 행 4  (4,3) zone2 게이트
  'L..#########..#', // 행 5  (5,4)~(5,12) 벽
  'L2.........#..#', // 행 6  (6,2)~(7,2) 문제2 · (5,12)~(10,12) 세로벽
  'L2.........#..#', // 행 7
  'L########BB#..#', // 행 8  (8,2)~(8,9) 벽 · (8,10)~(8,11) zone3 게이트
  'Lc.g.......#..#', // 행 9  (9,4) 귀신 대기 장소
  'L.......33.#..#', // 행 10
  '#X###########E#', // 행 11 (11,2) 출구 · (11,14) 입구
]

export const MAP_H = LAYOUT.length
export const MAP_W = LAYOUT[0].length

// ---- 그리드 파싱 ------------------------------------------------------------

const wallTiles = []
const lockerTiles = []
const chairTiles = []
const gateTilesById = { A: [], B: [] }
const deskTilesByNum = { 1: [], 2: [], 3: [] }
let ghostWaitTile = null
let entranceTile = null
let exitTile = null

for (let y = 0; y < MAP_H; y++) {
  if (LAYOUT[y].length !== MAP_W) throw new Error(`map.js: 행 ${y + 1}의 길이가 ${MAP_W}가 아닙니다`)
  for (let x = 0; x < MAP_W; x++) {
    const ch = LAYOUT[y][x]
    if (ch === '#') wallTiles.push([x, y])
    else if (ch === 'L') lockerTiles.push([x, y])
    else if (ch === 'c') chairTiles.push([x, y])
    else if (ch === 'g') {
      ghostWaitTile = [x, y]
      chairTiles.push([x, y])
    } else if (ch === 'A' || ch === 'B') gateTilesById[ch].push([x, y])
    else if (ch === '1' || ch === '2' || ch === '3') deskTilesByNum[ch].push([x, y])
    else if (ch === 'E') entranceTile = [x, y]
    else if (ch === 'X') exitTile = [x, y]
  }
}

function tilesToRect(tiles) {
  const xs = tiles.map((t) => t[0])
  const ys = tiles.map((t) => t[1])
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1 }
}

// ---- 내보내기 ----------------------------------------------------------------

export const WALL_TILES = wallTiles
export const LOCKER_TILES = lockerTiles
export const CHAIR_TILES = chairTiles

// 게이트 — 잠금 플래그가 꺼져 있으면 벽처럼 막히고, 켜지면 통과 가능
export const GATES = [
  { id: 'gate-zone2', ...tilesToRect(gateTilesById.A), requiresFlag: 'zone2Unlocked' },
  { id: 'gate-zone3', ...tilesToRect(gateTilesById.B), requiresFlag: 'zone3Unlocked' },
]

// 문제 책상 자리 — 모드 데이터(props)가 이 rect를 그대로 가져다 쓴다
export const PUZZLE_DESKS = {
  will: tilesToRect(deskTilesByNum[1]),
  roster: tilesToRect(deskTilesByNum[2]),
  sat: tilesToRect(deskTilesByNum[3]),
}

export const ENTRANCE = { x: entranceTile[0], y: entranceTile[1] }
export const EXIT = { x: exitTile[0], y: exitTile[1] }

// 구역 — 게이트 뒤 진입 판정 및 유령 트리거용 영역 (그리드에서 벽으로 둘러싸인 범위)
export const ZONES = {
  zone1: { x: 12, y: 1, w: 2, h: 3 }, // 문제1 구역: 우측 복도 상단 (상시 개방)
  zone2: { x: 1, y: 4, w: 10, h: 3 }, // 문제2 구역(중앙): (5,2)~(7,11)
  zone3: { x: 1, y: 8, w: 10, h: 2 }, // 문제3 구역(하단): (9,2)~(10,11)
}

// 귀신 — 컨셉의 "귀신 대기 장소"와 "귀신 동선"
// 대기 의자(9,4)에서 9행을 따라 우측으로 달린 뒤, zone3 게이트 틈(10열)으로 북쪽 이탈
export const GHOST = {
  wait: { x: ghostWaitTile[0], y: ghostWaitTile[1] },
  path: [
    [3.5, 8.5],
    [9.5, 8.5],
    [9.5, 6.5],
  ],
}
