# 작업: 영웅 다중 등록 + 개인전적 개선 + 공개 검색

> **작성:** 2026-06-04 / 상태: 진행 중
>
> **목적:** 실사용 피드백 기반 개선 3종 + 추가개발 1종.
> 진행하며 아래 체크리스트를 갱신한다 (✅ 완료 / 🔶 진행중 / ⬜ 예정).

---

## 배경 / 요구사항 (사용자)

1. **영웅 다중 등록** — 결과 입력·전적 수정 화면에서 한 멤버가 영웅을 **여러 개** 기록할 수 있어야 함.
   (오버워치 특성상 한 판에 영웅을 바꿔 가며 플레이)
2. **개인전적 리스트 + 통계** — 개인전적에서 본인이 참여한 매치가 **리스트로** 보이고, 통계도 함께 표시.
3. **대표영웅 정합성** — 지금 "대표 영웅"이 사실상 *최근 영웅*처럼 보임. 정의를 명확히 하고 UX 개선.

**추가개발** — 개인전적을 **로그인 없이 닉네임/배틀태그로 공개 검색** 가능하게.

## 확정된 결정 (2026-06-04)

| 항목 | 결정 |
|---|---|
| 다중영웅 데이터 모델 | `team_members.heroes_used text[]` 배열 컬럼 (별도 테이블 X, simplicity-first) |
| 영웅 선택 범위 | **배정 포지션 영웅만** (현행 유지, 오입력 차단) |
| 대표영웅 표기 | **주 영웅(최다) + 최근 영웅** 2칸 분리 |
| 공개 검색 범위 | 배틀태그 검색 → **소속 채널 선택** → 그 채널 기록 (채널 격리 유지) |
| 공개 검색 보안 | service-role 서버 전용 클라이언트, 쿼리를 member+channel로 스코프 |

---

## 체크리스트

### 🟦 P1 — 영웅 다중 등록 (기반)

- ✅ **마이그레이션** `supabase/migrations/0002_team_member_heroes.sql`
  - `team_members.heroes_used text[] not null default '{}'` 추가
  - 백필: `update ... set heroes_used = array[hero_used] where hero_used is not null`
  - `hero_used`는 **남겨둠**(라이브 안전), 드롭은 후속 마이그레이션
  - ⚠️ **사용자가 Supabase SQL Editor에서 수동 실행 필요 (아직 미실행)**
- ✅ **로더** `src/lib/matches.ts`: `heroUsed` → `heroesUsed: string[]`
- ✅ **액션** `src/app/app/match/actions.ts` `saveResult`: `Record<id,string[]>`, `heroes_used` 갱신
- ✅ **공통 컴포넌트** `src/components/hero-multi-select.tsx`: 배정 역할 영웅 칩 다중선택
- ✅ **결과 입력 UI** `match-wizard.tsx` + **수정 UI** `stats-client.tsx` EditMatchDialog 적용
- ✅ **표시** `stats-client.tsx` TeamColumn: 영웅 초상 여러 개

### 🟩 P2 — 개인전적 리스트 + 정합성 (#2·#3)

- ✅ `src/lib/personal-stats.ts` 신규: `computePersonalStats(matches, memberId)` 순수함수
  - 주 영웅(최다) / 최근 영웅(마지막 판) 분리 산출, 다중영웅 반영 집계
- ✅ `src/components/personal-record.tsx` 신규: 요약지표 + 참여 매치 리스트 표시(공유)
- ✅ 개인전적 탭: 참여 매치 리스트(최신순, 날짜·맵·승패·본인영웅·팀·스코어)
- ✅ 대표영웅 1칸 → 주/최근 2칸 분리

### 🟨 P3 — 공개 개인전적 검색 (추가개발)

- ✅ `src/lib/supabase/admin.ts`: service-role 클라이언트(`"use server"` 액션 전용)
- ✅ `src/app/record/` 공개 라우트(미들웨어 밖) — `page.tsx` / `actions.ts` / `record-search.tsx`
  - 배틀태그·디코명 입력 → 멤버 검색 → 소속 채널 선택 → 그 채널 전적(읽기 전용)
  - 입력 sanitize(PostgREST or() 필터 보호), member+channel 스코프
- ✅ 랜딩(`src/app/page.tsx`)에 "개인 전적 검색" 진입 링크 추가
- ⚠️ **Vercel 프로덕션 env에 `SUPABASE_SERVICE_ROLE_KEY` 등록 확인 필요 (배포 전제)**

### ✅ 검증

- ✅ `pnpm test` 24/24 · `npx tsc --noEmit` 통과 · `pnpm build` 성공(`/record` 생성)
- ✅ 변경 파일 biome 정리 (잔여 경고는 기존 코드베이스와 동일한 `process.env!` 관용)
- ⬜ STATUS.md 갱신
- ⬜ 브라우저 동작 확인(마이그레이션 실행 후)

---

## 메모 / 결정 로그

- **다중영웅 = 배열 컬럼**: 별도 테이블 대신 `text[]`. 사용처 6곳 격리돼 변경 최소.
- **`hero_used` 유지**: 라이브 무중단 위해 신규 컬럼만 추가, 신코드는 `heroes_used`만 사용.
- **공개검색 보안**: service-role은 `"use server"` 액션에서만 import(클라 번들 미포함). `server-only` 패키지는 미설치라 도입 보류.
- **남은 수동 작업 2가지**: ① `0002` 마이그레이션 SQL 실행 ② Vercel에 service-role 키 등록.
