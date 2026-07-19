// "과거의 이상" — HAFS Festival 부스를 준비하며 나왔던 초기 기획 초안.
// 실제로 제작되지 않은 자산(졸업앨범/명단/교과서)은 예시 데이터로 대체해 재현합니다.

const draftModeData = {
  id: 'draft',
  title: '과거의 이상',
  subtitle: '초기 기획 초안 — 미실행 컨셉',
  flavor: '실제 부스에서는 이 순서/문제로 진행되지 않았습니다. 자산이 만들어지지 않아 예시 데이터로 대체했습니다.',
  disabled: true,

  intro: {
    rules: [
      '제한 시간 15분. 10분 이내 탈출하면 보너스가 주어진다.',
      '힌트는 총 2회까지 사용할 수 있다.',
      '실내는 매우 어둡다. 손전등이 비추는 범위만 보인다.',
      '이 모드는 실제 자산이 없어, 기획안의 로직을 예시 데이터로 보여준다.',
    ],
    controls: [
      '이동 — W A S D  /  방향키',
      '상호작용 — E  (또는 화면의 상호작용 안내 클릭)',
      '힌트 — 문제 화면 안의 HINT 버튼 (총 2회 한정)',
    ],
  },

  story: [
    '2038년, 학교에서 졸업 10주년 동창회가 열린다.',
    '졸업앨범 속에는 있어서는 안 될 학생이 찍혀 있다.',
    '무슨 사연일까 — 유언장의 내용이 실마리가 될 것 같다.',
    '결국 그 존재는… 귀신이었다.',
  ],

  props: [
    { id: 'board', x: 2, y: 2, w: 2, h: 1, color: 0x33475b, label: '명단 · 앨범 (예시)', stageKey: 'roster' },
    { id: 'secondary', x: 11, y: 2, w: 2, h: 1, color: 0x4a3620, label: '교과서 (예시)', stageKey: 'textbook' },
    { id: 'locker', x: 2, y: 8, w: 1, h: 2, color: 0x1f3d2b, label: '사물함', stageKey: 'will' },
    { id: 'phone', x: 11, y: 8, w: 2, h: 1, color: 0x3a2340, label: '핸드폰', stageKey: 'final' },
  ],

  stages: [
    {
      key: 'roster',
      order: 1,
      name: '이름찾기 (예시 데이터)',
      kind: 'draftRoster',
      requiresFlags: [],
      unlocksFlags: ['lockerNumberKnown'],
      codeLength: 2,
      code: '07',
      placeholderRoster: Array.from({ length: 12 }, (_, i) => i + 1),
      missingNumber: 7,
      clueText: [
        '(예시 데이터) 학생 명단은 1~12번까지 있지만, 단체사진에는 11명만 보인다.',
        '사진과 명단을 대조해 없는 학생의 번호를 찾아라. 그 번호가 곧 사물함 번호다.',
      ],
      resultText: '사물함 번호를 알아냈다.',
      hints: [
        '한 명씩 대조하지 말고, 사진 속 얼굴이 명단 어디에도 없는 사람을 찾아보세요.',
        '(정답 공개) 사라진 학생의 번호는 07 입니다.',
      ],
    },
    {
      key: 'textbook',
      order: 2,
      name: '교과서 (책상서랍, 예시 데이터)',
      kind: 'textbook',
      requiresFlags: [],
      unlocksFlags: ['lockerOpen'],
      codeLength: 4,
      code: '1112',
      clueText: [
        '(예시 데이터) 교과서 인덱스 페이지에 형광펜으로 칠해진 단어: ELEVEN, TWELVE.',
        '영어 숫자를 아라비아 숫자로 바꾸고 순서대로 붙이면 사물함 비밀번호가 된다.',
      ],
      resultText: '사물함 비밀번호를 알아냈다.',
      hints: [
        '형광펜 칠해진 단어를 숫자로 바꿔 순서대로 붙여보세요.',
        '(정답 공개) ELEVEN=11, TWELVE=12 → 1112 입니다.',
      ],
    },
    {
      key: 'will',
      order: 3,
      name: '유언장 (예시 데이터)',
      kind: 'draftWill',
      requiresFlags: ['lockerOpen'],
      unlocksFlags: ['phoneUnlocked', 'codeKnown'],
      codeLength: 3,
      code: '521',
      // 규칙을 보여주는 예시(실제 정답과 무관) — 유언장 속 실제 강조 단어는 highlightWords.
      ruleExample: { word: '분식집', substituted: '분식4집', note: '사 = 4' },
      highlightWords: [{ word: '카카오톡' }, { word: '스투시' }, { word: '일단' }],
      clueText: [
        '(예시 데이터) 사물함 속에서 발견한 폰과 유언장.',
        '유언장 속에는 카카오톡, 스투시, 일단이라는 단어가 유독 진하게 강조되어 있다.',
        '단어 안에는 숫자처럼 들리는 발음이 숨어 있다. (예: 분식집 → 분식4집, 사=4)',
      ],
      resultText: '핸드폰 비밀번호를 알아냈다.',
      hints: [
        '단어 안에 숫자처럼 들리는 발음이 숨어 있어요 (오=5, 투=2, 일=1 처럼).',
        '(정답 공개) 순서대로 읽으면 521 입니다.',
      ],
    },
    {
      key: 'final',
      order: 4,
      name: '탈출',
      kind: 'final',
      requiresFlags: ['phoneUnlocked', 'codeKnown'],
      unlocksFlags: [],
      codeLength: 3,
      code: '521',
      resultText: '문이 열렸다 — 탈출 성공',
      hints: [],
      isFinal: true,
    },
  ],

  ghost: {
    triggerStage: 'will',
  },

  ending: {
    success: '탈출에 성공하신 것을 축하드립니다! (초안 시나리오)',
    bonus: '10분 이내 탈출에 성공했습니다!',
    timeout: '아쉽게도 탈출 전 시간이 종료되었습니다. 그래도 즐거운 시간 되셨길 바랍니다.',
  },
}

export default draftModeData
