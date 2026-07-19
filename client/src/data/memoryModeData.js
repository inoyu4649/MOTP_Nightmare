// "과거의 추억" — 2026 HAFS Festival에서 실제로 진행된 최종안.
// 문제/정답/힌트/대사는 모두 실제 부스 자료(res/, students_and_problem.pdf, 스태프 안내문)를 그대로 옮긴 것입니다.

import { PUZZLE_DESKS, EXIT } from '../game/map.js'

const memoryModeData = {
  id: 'memory',
  title: '과거의 추억',
  subtitle: '2026 HAFS Festival 「花様年華 : in bloom」 — 실행된 최종안',
  flavor: '실제 방탈출 <Nightmare>에서 사용되었던 문제·정답을 그대로 재현합니다.',

  intro: {
    rules: [
      '제한 시간 15분. 10분 이내 탈출하면 보너스가 주어진다.',
      '힌트는 총 2회까지 사용할 수 있다.',
      '실내는 매우 어둡다. 손전등이 비추는 방향만 보인다.',
      '1번 문제를 풀기 전엔 2번 구역에, 2번 문제를 풀기 전엔 3번 구역에 들어갈 수 없다.',
    ],
    controls: [
      '이동 — W A S D  /  방향키',
      '상호작용 — E  (또는 화면의 상호작용 안내 클릭)',
      '힌트 — 문제 화면 안의 HINT 버튼 (총 2회 한정)',
    ],
  },

  story: [
    '2038년, 학교에서 졸업 10주년 동창회가 열린다.',
    '졸업앨범을 함께 보던 중, 단체사진 속에 있어서는 안 될 학생 한 명이 찍혀 있다는 걸 발견한다.',
    '분명히 찍혀 있지만, 아무도 그 존재를 기억하지 못한다.',
    '그가 누구인지, 왜 사진 속에 있는지 알아내기 위해 옛 교실로 향한다…',
  ],

  // 문제1(유언장)은 항상 열려있고, 문제2(명단·앨범)는 zone2Unlocked, 문제3(SAT) 구역은 zone3Unlocked가 있어야
  // 물리적으로(벽/게이트) 들어갈 수 있다. 최종 탈출 코드는 출구 문에서 입력한다.
  // 책상 위치는 맵 그리드(map.js)의 1/2/3 타일에서, 출구 문은 X 타일에서 그대로 온다
  props: [
    { id: 'will-desk', ...PUZZLE_DESKS.will, color: 0x3a2340, label: '유언장', stageKeys: ['will'] },
    { id: 'roster', ...PUZZLE_DESKS.roster, color: 0x33475b, label: '명단 · 앨범', stageKeys: ['roster'] },
    { id: 'sat-desk', ...PUZZLE_DESKS.sat, color: 0xa06020, label: 'SAT 교재', kind: 'sat-desk' },
    { id: 'exit-door', x: EXIT.x, y: EXIT.y, w: 1, h: 1, color: 0x5a1616, label: '출구', stageKeys: ['final'] },
  ],

  stages: [
    {
      key: 'will',
      order: 1,
      name: '유언장',
      kind: 'will',
      requiresFlags: [],
      unlocksFlags: ['zone2Unlocked'],
      codeLength: 6,
      code: '518274',
      images: ['/res/yueonjang.png'],
      clueText: ['누군가 남긴 낡은 유언장이다. 유독 진하게 강조된 단어들이 눈에 띈다.'],
      resultText: '2번 구역으로 가는 문이 열렸다.',
      hints: [],
    },
    {
      key: 'roster',
      order: 2,
      name: '학생명단 · 졸업앨범',
      kind: 'roster',
      requiresFlags: ['zone2Unlocked'],
      unlocksFlags: ['zone3Unlocked'],
      codeLength: 3,
      code: '055',
      images: ['/res/students.png', '/res/grad_album.png'],
      clueText: [
        '<3학년 2반 학생명단>과 벚꽃 길에서 찍은 졸업앨범 단체사진을 나란히 대조해보자.',
        '없는 학생을 찾아라.',
        '찾아낸 학생들을 명단에서 확인하고, 이름에 있는 획의 수를 모두 더하면 비밀번호가 나온다.',
      ],
      resultText: '3번 구역으로 가는 문이 열렸다.',
      hints: [
        '없는 학생의 왼쪽에 있는 학생의 번호는 8, 오른쪽은 33, 왼쪽 대각선 아래는 9입니다.',
        '한 명씩 대조하지 말고, 명단에 절대 없을 것 같은 사람을 찾아보세요.',
        '(정답 공개) 이름 획수의 합은 055 입니다.',
      ],
    },
    {
      // 물리적 desk/모달이 따로 없다 — sat-blue/yellow/pink/orange 4개를 전부 풀면 자동으로 완료된다.
      key: 'sat',
      order: 3,
      name: 'SAT 교재',
      requiresFlags: ['zone3Unlocked'],
      unlocksFlags: ['codeKnown'],
      resultText: '탈출 암호의 네 자리 숫자를 모두 알아냈다.',
      hints: [],
    },
    {
      key: 'final',
      order: 4,
      name: '탈출',
      kind: 'final',
      requiresFlags: ['codeKnown'],
      unlocksFlags: [],
      codeLength: 4,
      code: '9146',
      resultText: '문이 열렸다 — 탈출 성공',
      hints: [],
      isFinal: true,
    },
  ],

  // SAT 미니게임 — 순서 상관없이 아무 때나 왔다갔다 하며 풀 수 있다.
  satOrder: ['핑크', '파랑', '노랑', '주황'],
  satSubclues: [
    {
      id: 'blue',
      color: '파랑',
      title: '번호가 매겨진 줄',
      kind: 'numberline',
      prompt: '0과 Right가 파란 형광펜으로 칠해져 있고, 검은 선으로 연결되어 있다.',
      options: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      answer: 1,
      hints: ['0의 오른쪽에 있는 숫자는?', '0 바로 오른쪽에 적힌 숫자를 그대로 고르면 됩니다.'],
    },
    {
      id: 'yellow',
      color: '노랑',
      title: 'a, d에 칠해진 형광펜',
      kind: 'numberline',
      prompt: 'a와 d가 노란 형광펜으로 칠해져 있다. a = 1이라면, d는 몇일까?',
      options: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      answer: 4,
      hints: ['알파벳 순서대로 a=1, b=2, c=3, d=4 입니다.'],
    },
    {
      id: 'pink',
      color: '핑크',
      title: '핑크 형광펜 문장',
      kind: 'lettercount',
      prompt:
        'that Dolly was not like herself, as it used to be and that Dolly was no longer the playful young Dolly that she loved so well.',
      note: '신경 쓰이는 글자는 눌러서 표시해둘 수 있다.',
      answer: 9,
      hints: ['U는 1로, W(더블 U)는 2로 센다.', 'U는 3번, W는 3번 나옵니다 (3×1 + 3×2 = 9).'],
    },
    {
      id: 'orange',
      color: '주황',
      title: '도형 문제',
      kind: 'math',
      prompt:
        '평행사변형 PQRS에서 PQ의 길이는 PS 길이의 1/4이다. 평행사변형의 둘레가 60인치일 때, RS의 길이는 몇 인치인가?',
      answer: 6,
      hints: ['PQ + PS = 30, PQ = PS/4 라는 두 식을 세워 보세요.'],
    },
  ],

  ghost: {
    triggerZone: 'zone3',
  },

  ending: {
    success: '탈출에 성공하신 것을 축하드립니다!',
    bonus: '10분 이내 탈출에 성공하셔서 추가 상품이 지급됩니다!',
    timeout: '아쉽게도 탈출 전 시간이 종료되었습니다. 그래도 즐거운 시간 되셨길 바랍니다.',
  },
}

export default memoryModeData
