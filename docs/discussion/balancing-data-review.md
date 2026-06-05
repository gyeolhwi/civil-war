# 토의: 밸런싱·영웅/맵 데이터 검토 & DB 이관

> **작성:** 2026-05-30 / 상태: 토의 중
>
> **목적:** 영웅·맵·밸런싱 데이터를 DB로 옮기기 **전에**, 현재 데이터와 로직에 문제가 없는지 먼저 검토한다.
>
> **관련 코드:** `src/constants/{heroes,maps,tiers}.ts`, `src/domain/{scoring,team-builder,types}.ts`
>
> **SoT:** `docs/spec/requirements.md` (§ 번호로 코드와 1:1 대응)

---

## 0. 현재 구조 한눈에

데이터·규칙·조립이 3계층으로 분리돼 있고, **전부 코드 상수**다 (주석상 "v1 → 추후 DB 이관" 의도).

```
[데이터 / constants]            [규칙 / domain/scoring]        [조립 / domain/team-builder]
  heroes.ts  (영웅 마스터)        PREFERENCE_WEIGHT              generateCandidates (5+5 완전탐색)
  maps.ts    (맵 마스터)          COMBO_PENALTY                 bestAssignment (1탱2딜2힐 최적배치)
  tiers.ts   (티어 환산점수)       comboPenalty()                buildBalancedTeams (상위10 무작위)
                                  teamScore()                   selectMap (선호맵 합집합 무작위)
```

| 파일 | 핵심 | 비고 |
|---|---|---|
| `heroes.ts` | 영웅 ~60종. `role`(3) + `subRoles[]`(9종) + `normalizedSubRole` | 중복 영웅은 subRoles 복수 → 우선순위로 단일화 |
| `maps.ts` | 맵 30종. `mode`(6종) + `isActive` | 격돌 2종 비활성 |
| `tiers.ts` | 티어 8종(1000~8000) + 디비전(+0~+400) | `ratingScore = base + bonus` |
| `scoring.ts` | 선호 가중치·조합 패널티·팀점수 (순수함수) | **규칙**. DB엔 결과만 캐시 |
| `team-builder.ts` | 팀 분할·역할배치·맵선정 | **알고리즘** |

---

## 1. DB 이관 — 제안: "콘텐츠는 옮기고, 규칙은 코드에 남긴다"

핵심 구분은 **콘텐츠(content) vs 규칙(rule)**.

### ✅ DB로 옮기면 좋은 것 (콘텐츠 = 운영자가 배포 없이 바꿔야 하는 것)
- `HEROES` 영웅 마스터
- `MAPS` 맵 마스터 + `isActive` (시즌별 맵풀 로테이션 = 운영 데이터)
- 근거: 패치마다 영웅 추가/맵풀 변경 발생. 채널 관리자가 배포 없이 갱신 가능해야 함.

### 🔒 코드에 남기는 게 좋은 것 (규칙 = 알고리즘의 일부)
- `COMBO_PENALTY`, `PREFERENCE_WEIGHT`, `TIER_BASE`, `DIVISION_BONUS`, `SUBROLE_PRIORITY`
- 근거: 데이터가 아니라 **밸런싱 알고리즘**. 테스트로 검증되고 requirements §번호로 묶여 있음. DB로 빼면 "버전관리 안 되는 마법 숫자"가 되어 위험.

### ⚠️ 경계에 있는 것 (= 이번 토의의 핵심)
- `Role` / `SubRole` / `GameMode` enum + 한글 라벨
    - → **타입은 코드에 유지**, DB엔 `code` 문자열만 저장하고 매핑. (안 그러면 TS 유니온 타입 안전성이 전부 깨짐)
- **영웅의 `subRoles` / `normalizedSubRole`**
    - → "데이터처럼 보이지만 실은 밸런싱 판단"이다. DB로 옮기면 *"영웅 1명 추가"라는 운영 작업이 곧바로 밸런싱 정확도에 영향*을 준다. 여기를 어떻게 다룰지가 제일 중요.

```
권장 이관 순서:  A(분류 정확도 검토) → B~E(로직 검토) → DB 스키마 설계 → 마이그레이션
                 └ A가 틀어져 있으면 로직 토의가 무의미하므로 A 먼저.
```

---

## 2. 검토 포인트 (마이그레이션 전 점검)

### A. 영웅 서브유형 분류 정확도 ⭐ (가장 먼저)
- 검증 불가 영웅(2026.1 지식 컷오프 기준): `domina`, `emre`, `sierra`, `anran`, `vendetta`, `mizuki`, `wuyang`, `jetpack_cat` 등
    - → 실제 영웅인지 / 분류가 현재 메타에 맞는지 **본인 확인 필요**.
- 분류 자체가 패널티 계산을 좌우함 (예: 라마트라 `[brawl, poke]`, 솜브라 `[playmaker, utility]`).
- ❓ **분류 기준 문서가 있는가?** (메타 기반인지, 감인지) — 없으면 DB 이관 시 운영자가 분류할 근거가 없다.

### B. `comboBonus`가 항상 0
- 패널티(감점)는 있는데 시너지 보너스(가점)는 v1 미사용 → 비대칭 구조.
- ❓ 의도된 것인가? (좋은 조합에 보상이 없고 나쁜 조합만 깎임)

### C. `dpsSameType` 패널티 트리거가 좁음
- 딜러 둘이 **각자 단일 유형이고 동일할 때만** 발동 (`scoring.ts:68-73`).
- 유형 2개 보유한 플렉스 딜러가 끼면 **절대 안 걸림** → 과소 패널티 가능성.

### D. 드래프트 오프롤 배정의 `bestRating` fallback
- 티어 없는 역할 배정 시 "다른 역할 최고티어 × 0.75"로 환산 (`team-builder.ts:74-82`).
- 주력 안 하는 포지션인데 점수가 **과대평가**될 수 있음.

### E. `ownedSubRoles`가 비는 엣지케이스
- 배정 역할에 보유 영웅 0개 → 빈 집합 → `noMainSupport`(500) 같은 큰 패널티가 *실제론 잘하는데* 잘못 터질 수 있음.

### (참고) 맵은 밸런싱에 영향 없음
- 맵은 점수 계산에 안 들어가고 `selectMap`(선호맵 합집합 무작위)에만 쓰임. 이관 난이도 낮음.

---

## 3. 검토 항목 요약표

| # | 항목 | 분류 | 리스크 | 결정 필요 |
|---|---|---|---|---|
| A | 영웅 서브유형 분류 정확도 | 데이터 | 높음 | 분류 기준/검증 |
| B | comboBonus 항상 0 | 규칙 | 중 | 의도 여부 |
| C | dpsSameType 트리거 협소 | 규칙 | 중 | 조건 확대 여부 |
| D | bestRating 오프롤 과대평가 | 규칙 | 중 | 보정 여부 |
| E | ownedSubRoles 빈 집합 오패널티 | 규칙 | 중 | 가드 추가 여부 |
| — | 맵 DB 이관 | 데이터 | 낮음 | 스키마만 |

---

## 4. 내 의견 (사용자 작성란)

<!-- 여기 아래에 의견 작성해 주세요. 항목별로 코멘트 달아도 좋고, 자유롭게 적어도 됩니다. -->

- DB 이관 범위:
- A 영웅 분류 기준:
- B comboBonus:
- C dpsSameType:
- D bestRating:
- E ownedSubRoles:
- 기타 / 우선순위:
