# 빠른편성(OWKR형식) · 구현 설계 (와이어프레임 + 파일 계획)

> 작성일 2026-07-14 · 상태: **설계안 (구현 승인 대기)**
> 선행 문서: [`paste-to-teams-requirements.md`](./paste-to-teams-requirements.md) (결정 확정본)
> 대상: 독립 신규 메뉴 · 안 B(격리 계산기) · 자유 스왑 드래그 · 선택 기능 4종 전부

---

## 0. 설계 원칙 (결정 재확인)

1. **격리**: 멤버 DB read/write 없음, 결과 저장 없음. `team-builder.ts`·`Participant`는 **불가침**.
2. **엔진 공유**: 밸런싱은 기존 `team-builder.ts`(순수 함수)를 **그대로 호출**. 파서만 owkr에서 이식.
3. **점수 일관성**: 파서는 `tier+division`까지만 뽑고, **점수 환산은 civil-war `ratingScore()`** 사용. owkr의 `getScore`는 이식 안 함.
4. **아이콘 우선**: 역할=SVG 아이콘, 티어=색 뱃지, 상태(선호/노마이크)=아이콘. 텍스트 최소화.

---

## 1. 화면 흐름

```
[입력] 붙여넣기 → 파싱(실시간 미리보기) → 10명 충족 시 "팀 짜기"
   │
   ▼
[결과] 자동 밸런스 → 팀 보드(아이콘)  ⇄  드래그 자유 스왑(점수 실시간 갱신)
        ├ 대안 후보 클릭 교체 (B2)
        ├ 품질 지표 표시 (B3)
        └ 이미지 복사(C1) · 다시 짜기 · 입력으로
```

두 화면(`input` | `result`)만 있는 단순 상태머신. 관리형의 11단계 마법사와 완전 분리.

---

## 2. 와이어프레임 (아이콘 위주)

### 2.1 입력 화면
```
┌ 빠른편성 (OWKR형식) ───────────────────────────────┐
│ 디스코드 채팅을 그대로 붙여넣으세요                 │
│ ┌───────────────────────────────────────────────┐ │
│ │ kim#11853   다5/다1/다5                        │ │
│ │ 학살#38848  다3/마4/다4                        │ │
│ │ Aki#34981   미배치(골)/미배치(플)/플2          │ │
│ │ 재봉이#31207 그5!/마1!/마4  X          (…10줄) │ │
│ └───────────────────────────────────────────────┘ │
│  ! 선호 · ? 비선호 · X 마이크없음                   │
│                 [ 팀 짜기  (n/10) ]                 │
│ ── 미리보기 ─────────────────────────────────────  │
│  🛡5  ⚔1  ✚5   kim#11853                🎙        │
│  🛡3  ⚔4  ✚4   학살#38848               🎙        │
│  🛡— ⚔— ✚2   Aki#34981 (탱·딜 미배치)  🎙        │
│  ★🛡5 ⚔1 ✚4   재봉이#31207              🔇        │
│ ── 못 읽은 줄 (0) ──                                │
└────────────────────────────────────────────────────┘
```
- 🛡탱 ⚔딜 ✚힐 (SVG) · 숫자=디비전 · ★=선호역할 · 🔇=노마이크
- 미배치/티어없는 역할은 `—` 로만 표기 (자동배정 제외 대상)

### 2.2 결과 화면 (드래그)
```
┌ 결과   [🔀 다시짜기] [🖼 이미지복사] [← 입력]   점수차 120 ┐
│ 지표  탱Δ40 · 딜Δ55 · 힐Δ25 · 팀편차 A 210 / B 190       │  (B3)
│ 대안  ●1  ○2  ○3  ○4  ○5  ○6   ← 클릭하면 그 조합으로     │  (B2)
│ ┌ TEAM 1   1,240 ┐        ┌ TEAM 2   1,120 ┐             │
│ │ 🛡 kim     다5★ │        │ 🛡 학살    다3   │            │
│ │ ⚔ A       마4  │  ⇄드래그 │ ⚔ B       다1   │            │
│ │ ⚔ C       플2  │        │ ⚔ D       다4   │            │
│ │ ✚ E       마5  │        │ ✚ F       다5   │            │
│ │ ✚ G       다2🔇│        │ ✚ H       플1   │            │
│ └────────────────┘        └────────────────┘             │
└──────────────────────────────────────────────────────────┘
```
- **자유 스왑**: 어느 슬롯이든 다른 슬롯 위로 드롭 → 두 선수 자리 교환(팀·역할 동시 변경). 드롭 즉시 양 팀 점수·지표 재계산.
- 티어 없는 역할로 이동 시 `bestRating` 환산 + '추정' 뱃지.

---

## 3. 데이터 모델 (즉석형 로컬 타입)

`src/domain/quick/types.ts` — **공유 타입과 분리된 로컬 타입.**

```ts
type ParsedRank = {
  tier: Tier;            // civil-war Tier (소문자)
  division: Division;    // 1~5
  preferred: boolean;    // ! (선호)
  avoided: boolean;      // ? (비선호)
};

type ParsedPlayer = {
  battleTag: string;                       // 닉네임#숫자
  ranks: Partial<Record<Role, ParsedRank>>;// 파싱된 역할만 존재
  noMic: boolean;                          // X 표기
};
```

### 어댑터 매핑 (`adapter.ts`): `ParsedPlayer → Participant`
| 파싱 | → Participant | 비고 |
|---|---|---|
| `ranks[role]` (avoided 아님) | `ratings[role] = ratingScore(tier, div)` | civil-war 점수 사용 |
| `avoided` 역할 | **ratings에서 생략** | = 자동배정 불가(기존 규칙 재사용) |
| 첫 `preferred` 역할 | `primaryRole` | 엔진 preferenceKind "preferred" |
| 둘째 `preferred` 역할 | `secondaryRole` | "additional" |
| battleTag | `battleTag`, `id = "guest:"+battleTag` | 경계 방어(누수 감지) |
| — | `discordName:null, heroCodes:[], heroes:[], mapCodes:[]` | 즉석은 영웅·맵 미사용 |

> **noMic는 Participant에 안 담음.** `id → noMic` 별도 맵으로 들고 다니며 §5.3 대안 재정렬에서만 사용 → 공유 타입 불가침.

---

## 4. 파일 계획

### 신규 (`src/domain/quick/` — 순수 로직)
| 파일 | 역할 |
|---|---|
| `types.ts` | `ParsedPlayer`/`ParsedRank` 로컬 타입 |
| `parser.ts` | owkr `parseMultipleLines`/`parseLineToPlayer` 이식 → `ParsedPlayer[]` + 실패줄 |
| `adapter.ts` | `ParsedPlayer[] → Participant[]` (+ `id→noMic` 맵) |
| `metrics.ts` | 순수 지표: 역할별 점수차·팀 표준편차·마이크 불균형 (B3) |
| `ranking.ts` | `generateCandidates` 결과 top-N 추출 + noMic 타이브레이크 (B2·P7) |

### 신규 (`src/app/app/quick/` — UI)
| 파일 | 역할 |
|---|---|
| `page.tsx` | 서버 컴포넌트. **인증만** 확인, DB 참가자 로드 없음 |
| `quick-client.tsx` | 상태머신(`input`/`result`), 오케스트레이션 |
| `paste-panel.tsx` | textarea + 실시간 미리보기 + 실패 배너 |
| `team-board.tsx` | `DndContext` + 두 팀 |
| `player-slot.tsx` | `useDraggable`+`useDroppable` 슬롯. **기존 `RoleIcon`·`TierImage`(game-image.tsx) 재사용** |
| `metrics-bar.tsx` | B3 지표 표시 |
| `alternatives-bar.tsx` | B2 대안 후보 칩 |
| `use-copy-image.ts` | C1 이미지 복사 |

### 수정 (최소)
| 파일 | 변경 |
|---|---|
| `src/app/app/page.tsx` | `MENUS` 배열에 `{ href:"/app/quick", title:"빠른편성(OWKR형식)", desc:"디스코드 티어 붙여넣기 → 즉석 팀 자동편성 (기록 안 됨)" }` 추가 |
| `package.json` | `html-to-image` 1개 추가 (C1용) |

### 불가침 (그대로 호출만)
`src/domain/team-builder.ts` · `src/domain/scoring.ts` · `src/constants/tiers.ts`
→ **한 줄도 수정 안 함.** 격리 경계가 지켜졌다는 증거.

### 재사용 (신규 제작 금지 — 이미 존재)
| 자산/컴포넌트 | 위치 | 용도 |
|---|---|---|
| `TierImage` | `components/ui/game-image.tsx` | 티어 엠블럼 (폴백 내장) — 티어 PNG 8종 이미 존재 |
| `RoleIcon` | `components/ui/game-image.tsx` | 역할 SVG (색점 폴백) — role SVG 3종 이미 존재 |
| `TIER_LABEL_KO` · `ROLE_LABEL_KO` | `constants/tiers.ts` · `constants/heroes.ts` | 한글 라벨 |
| 압축 표시 패턴 레퍼런스 | `personal-record.tsx` `ProfileHeader` | `TierImage+RoleIcon+티어·디비전` op.gg식 카드 |
| 디자인 토큰 | `bg-role-{tank,dps,support}` · `bg-surface-1/2/3` · `text-ink-*` | 색/표면 일관성 |

> **→ owkr `roles/icon` SVG 이식·색 뱃지 신규 제작·owkr 티어 PNG 재사용 전부 불필요.** 기존 `TierImage`/`RoleIcon`만 쓰면 화면이 앱 전체와 자동으로 일관됨.

---

## 5. 선택 기능 4종 구현 방식

### 5.1 B2 대안 후보 + 교체
`generateCandidates(participants)`가 **점수차 오름차순 전체 반환** → top 6을 칩으로. 칩 클릭 시 해당 Candidate로 팀 레이아웃 교체(드래그 상태 초기화).

### 5.2 B3 품질 지표
`metrics.ts` 순수 함수가 현재 팀 레이아웃(BuiltTeam 2개)에서 계산: 총점차 · 역할별 점수차(탱/딜/힐) · 팀 내 표준편차. 드래그로 레이아웃 바뀌면 재계산.

### 5.3 P6/P7 선호·비선호·마이크 (공유 타입 불가침)
- **선호(!)** → `primaryRole`/`secondaryRole` (§3) → 기존 엔진이 알아서 보너스.
- **비선호(?)** → 해당 역할 `ratings` 생략 → 기존 "배정불가" 규칙으로 자동배정에서 제외.
- **마이크(X)** → `ranking.ts`에서 top-N 후보를 `(diff, micImbalance)` 로 재정렬. 마이크 로직은 quick 모듈 안에만.

### 5.4 C1 이미지 복사
`use-copy-image.ts` — `html-to-image`로 결과 보드를 PNG 렌더 → Clipboard API 복사. 디스코드 바로 붙여넣기.

---

## 6. 드래그(자유 스왑) 구현

- `team-board.tsx`에 단일 `DndContext`. 슬롯 id = `"A-0".."A-4","B-0".."B-4"` (인덱스=역할: 0 탱, 1·2 딜, 3·4 힐).
- `onDragEnd(active, over)`: 두 슬롯의 참가자를 교환. 각 슬롯의 **역할은 위치 고정** → 교환된 사람은 새 슬롯의 역할을 맡음.
- 교환 후 양 팀을 `assembleTeam([{participant, role}×5])`로 재조립 → 점수·조합패널티·`individualScore` 재계산. 티어 없는 역할은 `toSlot`의 `bestRating` fallback이 처리(`team-builder.ts:90`).
- `metrics-bar`는 재조립된 두 BuiltTeam에서 파생.

---

## 7. 밸런서 흐름 (병합 구체)

```
파싱 ParsedPlayer[10]
   │ adapter (ratingScore 사용, guest: id)
   ▼
Participant[10]
   │ generateCandidates()  ← team-builder.ts 그대로
   ▼
Candidate[] (점수차 정렬됨)
   │ ranking.ts: top6 + noMic 타이브레이크
   ▼
현재 결과 = candidates[0] · 대안 = [1..5]
   │ 드래그 시 assembleTeam()로 재조립
   ▼
BuiltTeam 2개 → metrics.ts → 화면
```
> **자동 밸런스는 civil-war 규칙(티어 없으면 배정불가) 유지.** 파싱 10명이 역할 커버리지 부족으로 유효 조합 0이면 → "티어가 부족해 자동 구성이 안 됩니다. 각자 3역할 티어를 채워 다시 붙여넣어 주세요" 안내(owkr식). 실제로는 대부분 3역할을 적어 문제 드묾.

---

## 8. 구현 순서 (단계)

| # | 단계 | 검증 |
|---|---|---|
| 1 ✅ | `domain/quick/` 파서·타입·어댑터 | 완료 — 단위테스트 |
| 2 ✅ | 라우트·메뉴·`page.tsx`·`paste-panel` (입력+미리보기) | 완료 |
| 3 ✅ | 어댑터→`generateCandidates`→팀 보드 | 완료 — pipeline 통합테스트 |
| 4 ✅ | 아이콘 가독성 패스 (기존 `RoleIcon`·`TierImage`) | 완료 |
| 5 ✅ | 드래그 자유 스왑 + 점수 재계산 | 완료 — layout 테스트 |
| 6 ✅ | B2 대안 · B3 지표 · P6/P7 · C1 이미지 | 완료 |
| 7 ✅ | 전체 검증 | **테스트 56/56 · biome clean · 타입체크 통과** |

> **검증 결과**: vitest 56/56, biome clean, `next build` 타입체크(3.3s) 통과.
> 프로덕션 정적 export는 Supabase env(`.env.local`) 부재로 `/_not-found`에서 중단 — **환경 문제, 코드 무관**(main에서도 동일). 브라우저 시각 확인은 env+로컬 실행 필요.
> tsconfig `exclude`에 `refs` 추가 — 참조 프로젝트가 본 빌드 타입체크에 섞이던 기존 문제 해결.

---

## 9. 정합성 체크 결과 (2026-07-14)

기존 코드와 대조해 계획을 교정한 항목:

| 항목 | 처음 계획 (오류) | 교정 |
|---|---|---|
| 티어 시각화 | "색 뱃지 신규" 또는 "owkr PNG" | ✅ **기존 `TierImage`** (티어 PNG 8종 이미 존재) |
| 역할 아이콘 | "owkr SVG 이식(`role-icons.tsx`)" | ✅ **기존 `RoleIcon`** (role SVG 3종 이미 존재) → 신규 파일 삭제 |
| 압축 카드 레이아웃 | 새로 디자인 | ✅ `personal-record.tsx ProfileHeader` 패턴 차용 |
| 점수 체계 | (확인) | ✅ `ratingScore` 선형(1000~8000+0~400), owkr 비선형 미사용 |

→ **신규 자산·아이콘 제작 0건.** 가독성 개선은 "기존 아이콘 컴포넌트를 텍스트 대신 배치"하는 일이 됨.

## 10. 사용성 체크 — 결정 필요

| # | 사용성 이슈 | 기본 제안 |
|---|---|---|
| U1 | **10명 초과 붙여넣기** | owkr식: 앞 10명 참가 + 나머지 대기, 참가자 제거 시 대기자 승격 |
| U2 | **파싱 실패/티어 누락 수정** | 실패 줄은 배너에서 이름만 추가(티어 없음 표시) · 정상 항목은 미리보기에서 **제거**만. 인라인 티어 수정은 후속 |
| U3 | **모바일/터치 드래그** | dnd-kit `PointerSensor`+`TouchSensor` 등록 (데스크톱 주 사용이면 우선순위 낮음) |
| U4 | **선호 역할 2개+** | 첫째=primary, 둘째=secondary, 셋째부터 무시 |
| U5 | **자동배정 실패(역할 커버리지 부족)** | owkr식 안내 문구 + 수동 드래그 유도 |
| U6 | **이미지 복사 의존성** | `html-to-image` 1개 추가 (C1). 원치 않으면 C1 보류 |

> 위 기본 제안에 이견 없으면 **1단계(파서·어댑터 + vitest)부터 구현 착수** 가능.
