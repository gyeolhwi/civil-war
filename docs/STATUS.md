# STATUS — 현재 진행 상태

> 세션 이어가기 진입점. **여기를 먼저 읽고** 다음 작업을 결정한다.
> 작업을 끝낼 때마다 이 파일의 "다음 할 일"과 "완료" 섹션을 갱신할 것.

마지막 갱신: 2026-06-17

> **현재 한 줄 요약:** 핵심 기능 + 영웅/맵 DB 이관 + 관리 UI에 더해 **디스코드 봇 `/내전`(공지+✅)까지 `main` 배포·실작동 확인.**
> 봇은 서버리스(HTTP 인터랙션 + REST) 방식. 다음은 **`/참가자`**(✅ 누른 사람 조회). 셋업 가이드 = [`ops/discord-bot-setup.md`](ops/discord-bot-setup.md).

---

## 🔖 이어서 작업 (중단점 2026-06-07) — 다음 세션은 여기부터

### 지금 상태
- **`main` 배포** (`613a600`). 디스코드 봇 `/내전`(공지 임베드 + ✅ 자동첨부)까지 프로덕션 실작동 확인.
- Discord 셋업 완료: 봇(`모이라`) 서버(벙커) 초대, 인터랙션 엔드포인트 등록, env(`DISCORD_PUBLIC_KEY`/`DISCORD_BOT_TOKEN`) Vercel 반영, Vercel 배포 보호 OFF.
- 검증: tsc clean · 빌드 ✅ · `/내전` 실사용 동작.

### 다음 작업 후보 → 토의: [`discussion/discord-bot-and-presentation.md`](discussion/discord-bot-and-presentation.md) · 셋업: [`ops/discord-bot-setup.md`](ops/discord-bot-setup.md)
- **(권장 다음) `/참가자`** — 공지에 ✅ 단 사람 목록 조회(`GET .../reactions/✅`). DB 없이 "✅ N명: @A @B…"까지 바로 가능.
- **Phase 0 — `members.discord_user_id` 추가**: 디스코드 계정↔멤버 연결 키. `/참가자`가 "등록 멤버 이름"까지 보여주려면 필요.
- **Phase 4~** — 음성 자동분배(웹→봇 push, Move Members), 온보딩 `/등록` 링크 DM.
- **Phase 1 — 규칙 프레젠테이션 화면**(`/present`): 봇 무관·독립. 별개로 진행 가능.

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
- **영웅 입력 자유텍스트 → 드롭다운 전환 (2026-05-29)**: datalist 자유 입력은 오타 시 매칭 실패로 조용히 빈값(미기록) 저장되는 문제 → **결과 입력·전적 수정·영웅 밴을 모두 `<select>`로** 교체. 유효 영웅만 선택 가능(잘못된 입력 원천 차단), 코드를 직접 저장해 이름→코드 매칭 로직 제거. 결과/수정은 배정 역할 영웅만, 밴은 전체(역할 optgroup). 빌드·테스트 통과.
- **표시 정렬 + 역할별 영웅 입력 일괄 적용 (2026-05-29)**: ① 팀원은 어디서나 **탱→딜→힐 순 정렬** (`team-builder.assembleTeam`, `lib/matches` 로더, 결과 입력·전적 카드·수정 다이얼로그·드래프트 패널 — `constants/heroes.ROLE_ORDER`). ② 결과/수정 영웅 자동완성은 **배정 포지션 역할의 영웅만** 노출(`HEROES_BY_ROLE`, 역할별 datalist). 밴은 전체 영웅 유지. 빌드·테스트 통과.
- **드래프트 자유 배정 + 결과 검증 (2026-05-29 리뷰 후속)**: ① **드래프트 배정 정책 변경** — 1탱-2딜-2힐 슬롯 구조는 유지하되, 멤버는 **선호/보조/안 하는(티어 없는) 포지션이라도 빈 슬롯이면 자유 배정** 가능(시스템이 안 막음, 관리자 재량). 티어 없는 역할은 그 멤버 최고 티어로 환산(`team-builder.toSlot` fallback). 슬롯만 있으면 누구든 들어가므로 데드엔드 불가 → feasibility 검사 제거(코드·테스트 정리). ② 드래프트 중 "팀장 다시" 탈출 버튼. ③ 결과 입력 빈 스코어 거부(위저드 + 전적 수정 다이얼로그 공통). 빌드·테스트 24/24 통과.
- **전적·통계 + 매치 수정·삭제** (`/app/stats`, Phase 5 / F12·F12c): 빌드·타입체크 통과.
  - `src/lib/matches.ts` 매치+팀+팀원 펼침 로더(즉석 집계, requirements §10)
  - `stats/page.tsx` + `stats/stats-client.tsx`: 탭(채널 전적 = 날짜별 세션 그루핑·승수 요약 SC-41 / 개인 전적 = 멤버별 판수·승패·승률·사용영웅·자주같은팀 SC-40)
  - 매치 카드에서 **수정**(승팀·스코어·영웅·메모, `saveResult` 재사용 SC-28) / **삭제**(확인 다이얼로그, CASCADE, `stats/actions.ts` SC-29)
- **채널 정보** (`/app/channel`, 읽기 전용): 채널명·관리자·멤버수. (수정 v1.1) → **대시보드 4개 메뉴 404 전부 해소**
- **채널 시드 완료 (2026-05-29)**: service role 키로 라이브 검증 스크립트 실행 → `gyeori0626` **슈퍼 승격 + "테스트 내전 채널" 생성** (유지됨). 블로커 해소.
- **DB 데이터 계층 라이브 검증 (2026-05-29) — 23/23 PASS**: 스키마 10테이블 일치, 멤버 등록→참가자 로드→`createMatch`→`saveResult`→`loadMatches` insert/select 흐름이 실제 DB에서 동작(제약·CASCADE·RESTRICT 포함). 일회용 스크립트는 검증 후 삭제. (※ service role은 RLS 우회 — RLS 정책 자체의 실사용자 검증은 미수행)

---

### Phase 6 — 폴리싱 (2026-05-29 ~ 06-01, 약 40커밋)

> ROADMAP Phase 6 항목 대부분이 이 기간에 실제 반영됨. 핵심만 묶어 기록.

- **영웅·맵 이미지 전량 배치**: `public/images/heroes/` 51종, `public/images/maps/` 31종(jpg).
  추가로 역할 마크(`roles/`), 맵 모드 아이콘(`modes/`), 티어 엠블럼(`tiers/`) SVG.
  → 폴백 컴포넌트 + `next/image`→`img` 전환 + 프리로드 + 용량 최적화(26MB→7.6MB).
  → STATUS 기존 기술부채 "이미지 미배치" **해소**.
- **누락 데이터 보강**: 영웅 3종·맵 4종 마스터 추가 (멤버폼·맵선정·전적 전반 반영).
- **연출/모션**: 맵 선정 슬롯머신 추첨 + 확정 줌·글로우 배지, 드래프트 실시간 점수 카운트업,
  로그인 진행 표시 + 전역 상단 로딩 바.
- **UI 개편**:
  - 멤버 관리 — 검색·정렬 + 카드형 UI
  - 영웅 밴 — 카드 그리드(초상+A/B 슬롯 토글), 상대 밴 영웅 선택 불가, 밴 단계에 팀 카드·라인업 통합
  - 드래프트 후보 카드 — 선호 영웅 초상·역할 점수 칩, 멤버/드래프트 탱→딜→힐 정렬
  - 최종 대진표 확인 단계 추가
- **테마/호환 FIX**: 윈도우(라이트 OS)에서 native `<select>`·자동완성·토스트 흰배경 깨짐 보정,
  hydration 경고 억제(`suppressHydrationWarning`), 애니메이션 reduced-motion 무시.
- **인프라**: Vercel 함수 리전을 **서울(icn1)**로 고정 (`vercel.json`) — Supabase 서울 이전과 일치.

### Phase 7 — 배포 (실사용 중)

- **Vercel 배포 완료**, 디스코드 채널에서 실제 사용 시작됨.
  (RLS 적용 경로·로그인 세션이 실사용으로 사실상 검증되는 중)

### 개선 1차 — 영웅 다중 + 개인전적 + 공개검색 (2026-06-04, 배포 완료)

> 빌드·테스트·타입체크 통과 + main 배포·실사용 중. (토의 문서는 구현 완료로 정리·삭제됨)

- **영웅 다중 등록(#1)**: `team_members.heroes_used text[]`(migration 0002)로 확장.
  결과 입력·전적 수정이 단일 select → 칩 다중선택(`components/hero-multi-select.tsx`), 전적 표시도 다중 초상.
- **개인전적 리스트(#2)**: 개인 탭에 참여 매치 리스트(최신순·맵·승패·본인영웅) 추가.
- **대표영웅 정합성(#3)**: "대표 영웅"(최다·최근 혼동) → **주 영웅(최다) + 최근 영웅** 2칸 분리.
  집계를 `lib/personal-stats.ts` 순수함수로 추출 → `/app/stats`와 공개검색이 공유.
- **공개 개인전적 검색(추가)**: 로그인 없는 `/record` — 배틀태그·닉네임 검색 → 소속 채널 선택 → 전적(읽기 전용).
  service-role 클라이언트(`lib/supabase/admin.ts`, 서버 액션 전용), 채널 격리 유지.

### 밸런스 리워크 + 영웅/맵 DB 이관 + 관리 UI (2026-06-05, main 배포 완료)

- **밸런스 리워크** (`87c1d0a`): 영웅 분류를 `subRoles`/`normalizedSubRole` → **`comp`(조합 성향: dive/brawl/poke, 전역할) + `func`(역할 내 기능)** 으로 재설계.
  `comboPenalty`도 "탱 컨셉 응집(compMismatch) + within-role(딜 앵커·메인힐·힐러 편중)"으로 재작성. 시너지 가점은 끔(현행 유지).
- **영웅·맵 마스터 DB 이관** (`0003` 마이그레이션 + `REFACTOR(data)` `a62db29`):
  - `heroes`/`maps` 테이블(comp·func·mode·is_active) + 공개 읽기·슈퍼 쓰기 RLS + 51영웅·31맵 시드. 사용자가 SQL 실행 완료.
  - 코드: 서버 `lib/ref-data.ts`(unstable_cache·enum 검증) + 클라 Context `useRefData()`로 로드. 상수엔 라벨/enum만 잔존.
  - team-builder는 `Participant.heroes` 주입·`selectMap` 활성맵 인자화, discord는 이름 리졸버 주입(순수성 유지).
  - **경계선 결정**: 영웅·맵별 속성 = DB / 알고리즘 튜닝 상수(`COMBO_PENALTY`·`PREFERENCE_WEIGHT`·`TIER_BASE`) = 코드.
- **슈퍼관리자 영웅·맵 관리 UI** (`/app/admin`, `FEAT(admin)` `017bfc0`): is_super 게이트. 영웅 전체 편집(이름·역할·comp·func·활성, Zod로 comp 1~2·역할별 func 검증)·맵 편집·CSV 내보내기. 저장 시 `updateTag("ref-data")`로 전역 즉시 반영. 대시보드 슈퍼 메뉴 게이팅.
- **랜딩 전적 검색 버튼**(`947d6f0`): `/record` 진입 보조 버튼.

### 디스코드 봇 `/내전` + 푸터 제작자 표기 (2026-06-07, main 배포·실작동)

> 서버리스(HTTP 인터랙션 + REST) 봇. 별도 상시 서버 없이 Vercel 라우트로 동작. 셋업 전 과정은 [`ops/discord-bot-setup.md`](ops/discord-bot-setup.md).

- **인터랙션 엔드포인트** (`/api/discord/interactions`, `route.ts`): Ed25519 서명검증(`lib/discord/verify.ts`, `node:crypto`) + PING/PONG. POC(`poc/discord-interactions-verify.mjs`) 7/7 → 라우트 이식. `/api/discord`는 세션 미들웨어에서 제외(3초 제한).
- **`/내전 날짜 시간`** 커맨드: 모집 임베드 공지 게시 + ✅ 자동 첨부. 공지는 봇 REST(`lib/discord/rest.ts` `postChannelMessage`)로 올려 message.id 확보 → `addReaction`. 인터랙션 응답은 ephemeral 확인.
- **커맨드 등록 스크립트** (`scripts/discord-register.mjs`): `node --env-file=.env.local`로 **글로벌 등록**(PUT 덮어쓰기, 반영 ~1시간). 초대된 모든 서버에 자동 노출 → 새 서버는 초대만 하면 됨.
- **봇 권한(최소)**: 채널보기·메시지보내기·링크임베드·반응추가·메시지기록보기 + (음성)멤버이동 = `permissions=16862272`. scope `bot`+`applications.commands`. Privileged Intents 전부 OFF.
  - ⚠️ **`bot` 스코프 누락 시 봇이 멤버로 안 들어온다**(명령어만 등록됨) → REST 호출 전부 실패. 포털 `Installation → Guild Install` 기본 설치 설정에도 `bot` 을 넣어둘 것. [channel-link-guide.md](ops/channel-link-guide.md) "⚠️ 함정" 참고.
  - 게이트웨이 미사용(HTTP 인터랙션) → 봇은 **항상 오프라인 표시가 정상**.
- **겪은 함정(가이드에 기록)**: ① Vercel 배포 보호(SSO) → Discord 검증 차단(끔). ② 이름 비슷한 남의 `civil-war.vercel.app`. ③ **env 추가 후 새 배포 안 하면 런타임 미반영**(`DISCORD_BOT_TOKEN` 못 읽음) → git push로 해결.
- **푸터 제작자 표기**(`96ab275`): 랜딩 푸터에 GitHub(gyeolhwi) 링크 + Discord 핸들, 메타데이터 author/creator를 gyeolhwi로.

### `/패치노트` 커맨드 + 신규 콘텐츠(시온·네온 정션) + 봇명 모이라 (2026-06-17, main 머지)

- **신규 영웅·맵**: 시온(dps · comp `dive` · func `flanker`) + 네온 정션(hybrid). 마이그레이션 `0006_add_shion_neon_junction.sql`(0003 마스터에 1건씩 append, 각 그룹 맨 뒤 sort_order) + 이미지 `heroes/shion.png`·`maps/neon_junction.jpg`. **이제 51→52영웅·31→32맵.** 코드는 전부 DB(`ref-data`) 기반이라 마이그레이션 적용·이미지 배치만으로 멤버폼·밸런싱·맵선정·관리 UI에 자동 반영(테스트 32/32 통과 확인). ⚠️ **Supabase에서 0006 SQL 실행 필요**(미적용 시 미노출, ref-data 캐시 ~1h).
- **`/패치노트` 커맨드**(`src/lib/discord/patch-notes.ts`, `route.ts`): 최근 신규 소식·봇 업데이트를 ephemeral 임베드로 안내(출처 표기). `PATCH_NOTES` 수동 큐레이션 데이터 + `source` 필드.
- **보조 자동수집**(`scripts/patch-fetch.mjs`, `pnpm patch:fetch`): 나무늘보 패치노트 재생목록 최신 영상 → 자막(실패 시 설명란) → Claude(`claude-opus-4-8`) 핵심 요약 초안 → 운영자가 검토 후 `PATCH_NOTES`에 붙여넣는 사람-게이트 방식. env `ANTHROPIC_API_KEY`·`YOUTUBE_API_KEY` 필요(`@anthropic-ai/sdk` devDep).
- **봇 이름 변경**: `내전-모이라봇` → **`모이라`**. 봇 프로필 Description은 개발자 포털에서 직접 설정(코드 무관).
- ⚠️ **배포 후**: ① Supabase에서 `0006` 실행 ② `node --env-file=.env.local scripts/discord-register.mjs`로 `/패치노트` 글로벌 등록(반영 ~1h).

## 🔶 진행 중 / 막힌 곳

- ~~채널 시드~~ ✅ 완료 (위 참조).
- ~~대시보드 메뉴 404~~ — 4개 메뉴 모두 구현 완료.
- ~~영웅/맵 이미지 미배치~~ ✅ 전량 배치 (Phase 6).
- ~~밸런싱 로직 검토 + 영웅/맵 DB 이관~~ ✅ 완료 (A~E 검토 후 comp/func 재설계 + DB 이관·관리 UI까지 배포. 토의 문서는 정리·삭제).
- **E2E 자동화 미구축**: 실사용으로 화면·세션·RLS는 사실상 검증되는 중이나, Playwright 등 자동 E2E는 아직 없음.

## ▶️ 다음 할 일 (실사용 피드백 기반 선택)

> 핵심 기능·폴리싱·배포까지 끝난 상태. 이제부터는 **순서 고정이 아니라, 실사용 피드백에 따라 선택**한다.

**A. 실사용 FIX (들어오는 대로 최우선)**
- 사용자 버그/요청을 재현 → 원인 → 수정 순으로 처리.
- 메모리 미해결 건: Vercel Preview `MIDDLEWARE_INVOCATION_FAILED` (Supabase env 미반영 추정) — 재발 시 우선.

**B. 디스코드 봇 이어가기** → [`discussion/discord-bot-and-presentation.md`](discussion/discord-bot-and-presentation.md) · [`ops/discord-bot-setup.md`](ops/discord-bot-setup.md)
- 엔드포인트 + `/내전`은 배포·실작동 완료. **다음은 `/참가자`**(✅ 누른 사람 조회), 이어서 `discord_user_id` 매핑 → 멤버 이름 표시 → 음성 자동분배·온보딩.
- 규칙 프레젠테이션 화면(`/present`)은 봇과 별개로 독립 진행 가능.

**C. 남은 폴리싱 (선택)**
- 팀장 탱커/예능 모드, dnd-kit 드래그 전환, 반응형(모바일) 다듬기.

**D. 기술 부채 정리** (아래 ⚠️ 섹션)

## ⚠️ 미해결 / 기술 부채

- ~~[배포 전 필수] 0002 마이그레이션 실행 + 프로덕션 `SUPABASE_SERVICE_ROLE_KEY` 등록~~ ✅ 완료(실사용 중). 0003도 실행 완료.
- (정리 후보) deprecated `team_members.hero_used` 컬럼 드롭 — 현재 `heroes_used[]` 사용, 단일 컬럼은 미사용.
- `src/middleware.ts` — Next 16에서 deprecated 경고(`proxy.ts` 권장). 동작은 정상.
- **Vercel Preview `MIDDLEWARE_INVOCATION_FAILED`** — Supabase env 미반영 추정, 미해결 (프로덕션 동작은 정상).
- `seed.sql`의 username이 `admin` 하드코딩 — 실제 계정과 불일치 (채널 시드는 수동 SQL로 우회 완료).
- 이메일 도메인: 현재 실제 gmail 계정 사용 중. `@civilwar.local` 순수 아이디 계정은 미생성 (필요 시 `ops/supabase-setup.md` 참조).
- E2E 자동 테스트(Playwright 등) 미구축 — 도메인 단위테스트(24개)만 존재.

## 🔧 환경 / 실행

- dev 서버: `pnpm dev` → http://localhost:3000 (실행 중이면 중복 실행 막힘)
- 빌드: `pnpm build` / 린트: `pnpm lint` (biome) / 테스트: `pnpm test` (vitest)
- `.env.local`: Supabase URL/anon key 설정됨 (gitignore). 프로젝트 ref `dxeuukenmhfnsrhiggri`
- Supabase 키 안내: `ops/supabase-setup.md`
- Discord env: `DISCORD_PUBLIC_KEY`·`DISCORD_BOT_TOKEN`(런타임, Vercel 등록 필요) + `DISCORD_APPLICATION_ID`·`DISCORD_GUILD_ID`(로컬 등록 스크립트 전용). 안내: `ops/discord-bot-setup.md`

## 📌 핵심 설계 결정 (놓치면 안 되는 것)

- 멤버 = 글로벌 식별(배틀태그 유니크) + **채널별 프로필**(티어·선호). 채널 격리 RLS.
- 점수: 티어(1000~8000)+디비전(+0~400) × 선호가중치(1.0/0.9/0.75).
- **영웅 분류(2026-06-05 리워크)**: `comp`(dive/brawl/poke, 전역할·1~2개) + `func`(역할 내 기능). 마스터는 **DB**(`/app/admin`에서 편집), 분류 규율은 코드(`admin/schema.ts`).
- **조합 패널티**(`COMBO_PENALTY`, 코드 상수): 탱 컨셉 응집(compMismatch) + within-role(딜 앵커·메인힐 부재·힐러 편중). 시너지 가점은 끔.
- 5v5 우선, 드래프트는 팀장 2명이 포지션 먼저 지정 후 남은 8명 1-2-2-2-1 스네이크.
- 결과 입력: 승팀·스코어 필수, 영웅 선택(`<select>`, 배정 역할 영웅만).
