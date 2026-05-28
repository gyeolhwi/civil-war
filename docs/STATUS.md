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

## 🔶 진행 중 / 막힌 곳

- **채널 시드 안 됨**: `supabase/seed.sql`은 `username='admin'` 기준인데 실제 계정은 `gyeori0626`. → **채널이 아직 없어서** 멤버 등록·내전 진행 불가. (아래 "다음 할 일 0" 참조)
- **대시보드 메뉴 클릭 시 404**: `/app/members`, `/app/match/new`, `/app/stats`, `/app/channel` 페이지 미구현. 대시보드(`src/app/app/page.tsx`)까지만 존재.

## ▶️ 다음 할 일 (순서대로)

0. **채널 시드** — SQL Editor에서 실행 (계정명 `gyeori0626` 기준):
   ```sql
   update public.admins set is_super = true where username = 'gyeori0626';
   insert into public.channels (name, owner_admin_id)
   select '테스트 내전 채널', a.id from public.admins a
   where a.username = 'gyeori0626'
     and not exists (select 1 from public.channels c where c.owner_admin_id = a.id);
   ```
1. **멤버 관리 화면** (`/app/members`) — F3·F4. 목록 + 추가/수정/삭제. 입력: 배틀태그, 디코명, 역할별 티어(탱/딜/힐), 주/부 포지션, 선호 영웅(자동완성), 선호 맵. → `spec/workflow.md` [2], `spec/scenarios.md` SC-10~14, `spec/erd.md` 2.3~2.7
   - 필요 헬퍼: `getMyChannel()` (현재 관리자 소유 채널 조회) — `src/lib/channel.ts`
2. **내전 워크플로우** (`/app/match/new`) — 참가자 10명 선택 → 모드 선택 → 팀 빌딩(자동 밸런스/팀장 드래프트) → 맵/밴 → 결과 입력 → 다음 판. `spec/workflow.md` [3]~[13]
   - 자동 밸런스: `src/domain/scoring.ts` 활용 (조합 생성·점수차 최소 상위10 랜덤)
   - 드래프트: dnd-kit, 실시간 점수(`spec/workflow.md` [6], `design/design.md` Motion)
3. **전적·통계 + 매치 수정/삭제** (`/app/stats`) — F12·F12c
4. **팀 구성 복사** (F12b), **채널 정보** (`/app/channel`)
5. **폴리싱**: 모션(점수 카운트업 등), 반응형(참가자 선택·결과 입력)

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
