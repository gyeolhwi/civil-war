# STATUS — 현재 진행 상태

> 세션 이어가기 진입점. **여기를 먼저 읽고** 다음 작업을 결정한다.
> 작업을 끝낼 때마다 이 파일의 "다음 할 일"과 "완료" 섹션을 갱신할 것.

마지막 갱신: 2026-05-29

---

## ✅ 완료

- **기획 문서 전부** (`spec/`, `design/`) — 2회 검토(구현·사용성 / 제품 완결성) 완료
- **스캐폴딩** (커밋 `1e007d5`): Next.js 16 + Supabase + shadcn, 디자인 토큰(`src/app/globals.css` Linear 다크), 도메인 상수(`src/constants/`, `src/domain/`), Supabase 클라이언트(`src/lib/supabase/`), 기본 페이지(랜딩/로그인/대시보드). 프로덕션 빌드 통과.
- **DB 마이그레이션** (커밋 `64c81c8`, `supabase/migrations/0001_init.sql`): 사용자가 Supabase SQL Editor에서 **실행 완료**. 10개 테이블 + RLS + admins 트리거.
- **관리자 계정 생성 + 로그인 동작 확인**: 계정 `gyeori0626@gmail.com` (실제 gmail로 생성). 로그인 → `/app` 대시보드 진입 OK.
- **로그인 유연화**: `src/app/login/actions.ts` — 입력에 `@` 있으면 이메일 그대로, 없으면 `@civilwar.local` 부착. 에러는 `invalid`/`unconfirmed`/`empty` 일반 메시지로 표시.
- **멤버 관리 화면** (`/app/members`, Phase 3 / F3·F4): 목록 + 추가/수정/삭제. 빌드·타입체크 통과.
  - `src/lib/channel.ts` `getMyChannel()` — 본인 소유 채널 조회(RLS 의존)
  - `members/schema.ts` zod 스키마, `members/actions.ts` `saveMember`/`deleteMember` 서버 액션(채널 컨텍스트 강제, 배틀태그 글로벌 재사용 SC-11, 프로필 3종 전량 교체 SC-13, 삭제는 매핑만 제거·매치 이력 보존 SC-14)
  - `members/member-form.tsx` 다이얼로그 폼(배틀태그·디코명·주/부 포지션·역할별 티어 토글 SC-12·선호 영웅 최대5 칩·선호 맵 칩), `members/members-client.tsx` 목록·삭제 확인
  - `src/app/layout.tsx`에 `<Toaster/>`(sonner) 마운트
- **내전 워크플로우 — 기본(자동 밸런스) 모드** (`/app/match/new`, Phase 4 부분 / F5·F8·F9·F10·F11·F12b): 빌드·타입체크 통과 + **도메인 단위테스트 16/16 통과**.
  - `src/domain/team-builder.ts` 자동 밸런스 알고리즘(미러 제거 126분할 × 슬롯 배치 최적화 → 점수차 최소 상위10 랜덤, SC-50/55 처리) + `selectMap`
  - `src/domain/discord.ts` 디스코드 공유 텍스트(F12b) + 테스트, `vitest.config.ts`(`@/` 별칭) 추가 — 첫 테스트 인프라
  - `src/lib/participants.ts` 팀빌딩용 참가자 로더(rating_score·맵선호 포함)
  - `match/actions.ts` `createMatch`/`updateMapBan`/`saveResult`(SC-26/52/53), `match/new/page.tsx`(채널·10명 가드) + `match/new/match-wizard.tsx` 7단계 상태머신(참가자선택→모드→팀확정→맵→밴→결과→다음판 4분기)
  - **팀장 드래프트 추가** (Phase 4 [5-B][6] / F6·F7): `src/domain/draft.ts`(스네이크 순서·슬롯·자격·팀장선정, 단위테스트 9개). 모드 3종 활성(기본/팀장-최고티어/팀장-직접지정). **클릭 기반** 드래프트(팀장 포지션 선지정→1-2-2-2-1 스네이크→실시간 점수→직전 픽 취소), `captain_id`·`pick_order` 저장. 빌드·테스트 25/25 통과.
  - 미구현(후속): 팀장 탱커/예능 모드, dnd-kit 드래그 전환, 카운트업 모션
- **드래프트 자유 배정 + 결과 검증 (2026-05-29 리뷰 후속)**: ① **드래프트 배정 정책 변경** — 1탱-2딜-2힐 슬롯 구조는 유지하되, 멤버는 **선호/보조/안 하는(티어 없는) 포지션이라도 빈 슬롯이면 자유 배정** 가능(시스템이 안 막음, 관리자 재량). 티어 없는 역할은 그 멤버 최고 티어로 환산(`team-builder.toSlot` fallback). 슬롯만 있으면 누구든 들어가므로 데드엔드 불가 → feasibility 검사 제거(코드·테스트 정리). ② 드래프트 중 "팀장 다시" 탈출 버튼. ③ 결과 입력 빈 스코어 거부(위저드 + 전적 수정 다이얼로그 공통). 빌드·테스트 24/24 통과.
- **전적·통계 + 매치 수정·삭제** (`/app/stats`, Phase 5 / F12·F12c): 빌드·타입체크 통과.
  - `src/lib/matches.ts` 매치+팀+팀원 펼침 로더(즉석 집계, requirements §10)
  - `stats/page.tsx` + `stats/stats-client.tsx`: 탭(채널 전적 = 날짜별 세션 그루핑·승수 요약 SC-41 / 개인 전적 = 멤버별 판수·승패·승률·사용영웅·자주같은팀 SC-40)
  - 매치 카드에서 **수정**(승팀·스코어·영웅·메모, `saveResult` 재사용 SC-28) / **삭제**(확인 다이얼로그, CASCADE, `stats/actions.ts` SC-29)
- **채널 정보** (`/app/channel`, 읽기 전용): 채널명·관리자·멤버수. (수정 v1.1) → **대시보드 4개 메뉴 404 전부 해소**
- **채널 시드 완료 (2026-05-29)**: service role 키로 라이브 검증 스크립트 실행 → `gyeori0626` **슈퍼 승격 + "테스트 내전 채널" 생성** (유지됨). 블로커 해소.
- **DB 데이터 계층 라이브 검증 (2026-05-29) — 23/23 PASS**: 스키마 10테이블 일치, 멤버 등록→참가자 로드→`createMatch`→`saveResult`→`loadMatches` insert/select 흐름이 실제 DB에서 동작(제약·CASCADE·RESTRICT 포함). 일회용 스크립트는 검증 후 삭제. (※ service role은 RLS 우회 — RLS 정책 자체의 실사용자 검증은 미수행)

## 🔶 진행 중 / 막힌 곳

- ~~채널 시드~~ ✅ 완료 (위 참조).
- ~~대시보드 메뉴 404~~ — 4개 메뉴(`/app/members`·`/app/match/new`·`/app/stats`·`/app/channel`) 모두 구현 완료.
- **브라우저 E2E 미검증**: 데이터 계층은 검증됐으나 실제 화면 클릭/로그인 세션/RLS 적용 경로는 아직. (Playwright 미설치, 또는 수동 확인)

## ▶️ 다음 할 일 (순서대로)

0. ~~**채널 시드**~~ ✅ 완료. (참고용 SQL — SQL Editor에서 수동 실행 시)
   ```sql
   update public.admins set is_super = true where username = 'gyeori0626';
   insert into public.channels (name, owner_admin_id)
   select '테스트 내전 채널', a.id from public.admins a
   where a.username = 'gyeori0626'
     and not exists (select 1 from public.channels c where c.owner_admin_id = a.id);
   ```
1. ✅ **멤버 관리 화면** (`/app/members`) — 완료 (위 "완료" 섹션 참조). **남은 확인**: 채널 시드(위 0) 후 실제 등록·수정·삭제 동작 브라우저 검증.
2. ✅ **내전 워크플로우 — 기본 모드** (`/app/match/new`) — 완료 (위 "완료" 참조). **남은 확인**: 채널 시드 + 멤버 10명 후 브라우저에서 풀 플로우(팀확정→맵→밴→결과→다음판) 검증.
2b. ✅ **팀장 드래프트** — 완료(클릭 기반). **후속(선택)**: 팀장 탱커/예능 모드, dnd-kit 드래그 전환, 카운트업 모션.
3. ✅ **전적·통계 + 매치 수정/삭제** (`/app/stats`) — 완료. **남은 확인**: 매치 데이터 쌓인 뒤 브라우저 검증.
4. ✅ **팀 구성 복사** (F12b, 위저드 내 디스코드 복사), ✅ **채널 정보** (`/app/channel`)
5. **다음 우선순위**: (a) 팀장 드래프트([5-B][6], dnd-kit) 또는 (b) 폴리싱: 모션(점수 카운트업 등), 반응형, 영웅/맵 이미지 배치

## ⚠️ 미해결 / 기술 부채

- `src/middleware.ts` — Next 16에서 deprecated 경고(`proxy.ts` 권장). 동작은 정상
- `seed.sql`의 username이 `admin` 하드코딩 — 실제 계정과 불일치 (위 "다음 할 일 0"에서 우회)
- 이메일 도메인: 현재 실제 gmail 계정 사용 중. `@civilwar.local` 순수 아이디 계정은 미생성 (필요 시 `ops/supabase-setup.md` 참조)
- 영웅/맵 이미지(`/public/heroes/`, `/public/maps/`) 미배치 — UI에서 깨진 이미지 가능, placeholder 필요

## 🔧 환경 / 실행

- dev 서버: `pnpm dev` → http://localhost:3000 (실행 중이면 중복 실행 막힘)
- 빌드: `pnpm build` / 린트: `pnpm lint` (biome) / 테스트: `pnpm test` (vitest)
- `.env.local`: Supabase URL/anon key 설정됨 (gitignore). 프로젝트 ref `dxeuukenmhfnsrhiggri`
- Supabase 키 안내: `ops/supabase-setup.md`

## 📌 핵심 설계 결정 (놓치면 안 되는 것)

- 멤버 = 글로벌 식별(배틀태그 유니크) + **채널별 프로필**(티어·선호). 채널 격리 RLS.
- 점수: 티어(1000~8000)+디비전(+0~400) × 선호가중치(1.0/0.9/0.75). 조합 패널티 6종. 탱-딜 불일치(§8.4).
- 중복 영웅 자동 정규화(§6.3): 딜 main>playmaker>utility, 힐 main>utility>damage, 탱 brawl>poke>dive.
- 5v5 우선, 드래프트는 팀장 2명이 포지션 먼저 지정 후 남은 8명 1-2-2-2-1 스네이크.
- 결과 입력: 승팀·스코어 필수, 영웅 선택(자동완성).
