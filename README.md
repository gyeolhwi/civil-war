# Civil War

오버워치 **디스코드 채널별 내전(in-house) 편성·운영·기록** 웹앱.

## 왜 만들었나

디스코드 친목 채널에서 매주 5v5 내전을 돌릴 때마다 반복되는 일 — 누가 어느 팀, 포지션은, 맵은 뭐, 결과는 누가 기록 — 을 화면 하나로 끝내려고 만들었다. 티어와 포지션을 기반으로 **균형 잡힌 두 팀을 자동으로 짜거나 팀장이 직접 드래프트**하고, 맵 선정·영웅 밴·결과 기록까지 한 흐름으로 진행한다. 관리자가 **화면 공유로 진행**하는 걸 전제로 디자인했다.

> 🚧 개발 중. 현재 진행 상황과 다음 작업은 **[`docs/STATUS.md`](docs/STATUS.md)** 참조.

## 누구를 위해

- **단위**: 디스코드 채널 1개 = 독립된 내전 그룹 (멤버·기록 격리)
- **운영**: 채널 관리자가 멤버를 등록하고 매주 정기 내전을 편성·기록
- **규모**: 채널당 10~30명, 1회 내전 = 정확히 10명 (5v5, 1탱-2딜-2힐)

## 지금 되는 것

- **멤버 관리** — 배틀태그·디코명, 주/부 포지션, 역할별 티어, 선호 영웅(최대 5)·선호 맵을 채널별 프로필로 등록·수정·삭제. 검색·정렬·카드형 UI.
- **팀 편성 2가지 모드**
  - **자동 밸런스** — 티어 점수 + 조합 패널티로 점수차가 가장 작은 5v5 조합을 자동 생성
  - **팀장 드래프트** — 팀장 2명(최고 티어 자동 / 직접 지정)이 1-2-2-2-1 스네이크 순서로 클릭 픽, 실시간 팀 점수·직전 픽 취소
- **빠른편성 (OWKR형식)** — 디스코드에 올라온 티어 명단(`닉네임#1234 다5/다1/다5`)을 그대로 붙여넣으면 즉석에서 5v5 자동편성. 멤버 등록 없이 텍스트만으로 완결되고, 전적에는 기록되지 않는 일회성 계산기
- **진행 도구** — 맵 자동 추첨(룰렛), 영웅 밴 선택, 승팀·스코어·각자 사용 영웅·메모 결과 기록
- **공유·기록** — 확정된 팀 구성을 디스코드용 텍스트로 복사, 채널 전적(날짜별 세션)·개인 전적(판수·승률·사용 영웅·자주 같은 팀) 통계, 매치 수정·삭제
- **다크 UI**(Linear 스타일) + 과하지 않은 모션

## 어떻게 쓰나

1. **로그인** → 관리자 계정으로 채널 대시보드(`/app`) 진입
2. **멤버 등록** (`/app/members`) — 내전에 참여할 멤버를 프로필과 함께 추가
3. **내전 시작** (`/app/match/new`) — 위저드를 따라 진행:
   참가자 10명 선택 → 편성 모드 선택 → (자동 확정 / 팀장 드래프트) → 맵 추첨 → 영웅 밴 → 대진 확인 → 결과 입력 → "다음 판" 또는 종료
4. **전적 확인** (`/app/stats`) — 채널/개인 전적 조회, 지난 매치 수정·삭제

멤버 등록 없이 당장 팀만 뽑고 싶다면 **빠른편성**(`/app/quick`)에 디스코드 명단을 붙여넣으면 된다. 기록은 남지 않는다.

## 크레딧

**빠른편성**(`/app/quick`)의 디스코드 명단 입력 형식과 파서(`src/domain/quick/parser.ts`)는
[OWKR Match](https://github.com/qtaghdi/owkr-match)(qtaghdi)를 레퍼런스해 저작권자 허락 하에 이식했다.
팀 편성 엔진 자체는 civil-war 자체 밸런서(`src/domain/team-builder.ts`)를 그대로 쓴다.

## 기술 스택

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui · TanStack Query · react-hook-form + zod · dnd-kit · **Supabase**(Postgres/Auth) · Vercel · Biome · Vitest · pnpm

## 빠른 시작

```bash
pnpm install

# 환경변수 설정 (Supabase URL/anon key)
cp .env.local.example .env.local   # 값 채우기 — docs/ops/supabase-setup.md 참조

# DB 셋업: supabase/migrations/0001_init.sql 실행 후 관리자 계정·시드
#   → docs/ops/supabase-setup.md

pnpm dev      # http://localhost:3000
```

스크립트: `pnpm dev` · `pnpm build` · `pnpm lint`(biome) · `pnpm test`(vitest)

## 문서

기획·설계·계획은 [`docs/`](docs/)에 정리돼 있다. 진입점은 [`docs/README.md`](docs/README.md).

| 문서 | 내용 |
|---|---|
| [`docs/STATUS.md`](docs/STATUS.md) | 현재 진행 상태 + 다음 할 일 (세션 이어가기) |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | 단계별 계획 |
| [`docs/spec/`](docs/spec/) | 요구사항·워크플로우·ERD·시나리오 |
| [`docs/design/design.md`](docs/design/design.md) | 디자인 시스템·모션·UX 원칙 |
| [`docs/ops/supabase-setup.md`](docs/ops/supabase-setup.md) | DB·계정·시드 셋업 가이드 |

## 프로젝트 구조

```
src/
├── app/              # 라우트 (랜딩 / login / app 대시보드)
├── components/ui/    # shadcn/ui 컴포넌트
├── constants/        # HEROES · MAPS · TIER (마스터 데이터)
├── domain/           # 점수·조합 패널티 로직, 타입
└── lib/supabase/     # Supabase 클라이언트 (browser/server/middleware)
supabase/migrations/  # DB 스키마
docs/                 # 기획·설계·계획
```
