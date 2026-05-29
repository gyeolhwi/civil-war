# Supabase 셋업 가이드

DB 마이그레이션·관리자 계정·시드 실행 순서와 트러블슈팅.

## 0. 환경변수 (`.env.local`)

Supabase 대시보드 → **Settings → API**:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon / public 키 (role: anon인 JWT 또는 publishable)>
NEXT_PUBLIC_INTERNAL_EMAIL_DOMAIN=civilwar.local
```

- ⚠️ `service_role` / `secret` 키는 넣지 말 것 (RLS 우회 키, 클라이언트 노출 금지)
- `anon` 키는 RLS로 보호되므로 `NEXT_PUBLIC_`에 안전
- 키가 anon인지 확인: JWT 페이로드 `role` 필드가 `anon`이어야

## 1. 스키마 마이그레이션

**SQL Editor** → `supabase/migrations/0001_init.sql` 전체 복사 → Run.
→ 10개 테이블 + RLS 정책 + `admins` 자동생성 트리거 + 헬퍼 함수(`is_super`, `owns_channel`).

## 2. 관리자 계정 생성

**Authentication → Users → Add user**:

- **Email**: `<아이디>@civilwar.local` (예: `admin@civilwar.local` → 아이디 `admin`)
  - 또는 실제 이메일도 가능 (로그인 시 이메일 전체 입력)
- **Password**: 로그인에 쓸 비밀번호
- ✅ **Auto Confirm User** 체크 (필수 — 미확인이면 "Email not confirmed")

→ `on_auth_user_created` 트리거가 `public.admins`에 행 자동 생성 (`username` = 이메일 @ 앞부분)

## 3. 시드 (슈퍼관리자 승격 + 첫 채널)

**SQL Editor** — 아래 `<username>`을 2번에서 만든 아이디로 교체:

```sql
update public.admins set is_super = true where username = '<username>';

insert into public.channels (name, owner_admin_id)
select '테스트 내전 채널', a.id from public.admins a
where a.username = '<username>'
  and not exists (select 1 from public.channels c where c.owner_admin_id = a.id);

-- 확인
select a.username, a.is_super, c.name
from public.admins a left join public.channels c on c.owner_admin_id = a.id;
```

## 4. 로그인 확인

`pnpm dev` → http://localhost:3000 → "내전 편성하기" → 로그인.

- 로그인 입력: 아이디만(`admin`) 또는 이메일 전체(`x@gmail.com`) 둘 다 됨
  (코드가 `@` 유무로 판단 — `src/app/login/actions.ts`)

## 5. 채널·관리자 일괄 발급 (스크립트) — 권장

2·3번(유저 생성 + admins + 채널)을 한 번에 처리하는 운영 도구.

```bash
# .env.local 에 서버 전용 키 추가 (NEXT_PUBLIC_ 접두사 금지 = 브라우저 노출 안 됨)
SUPABASE_SERVICE_ROLE_KEY=<service_role secret 키>

node --env-file=.env.local scripts/provision-channel.mjs \
  --user=벙커 --pass='비밀번호' --channel="벙커 내전방" [--super]
```

- 동작: `벙커@civilwar.local` auth 유저 생성(인증완료) → `admins` 행 → 채널 생성(소유자 연결) → **anon 로그인 검증**까지.
- 멱등: 같은 유저면 비번 갱신, 같은 소유자+채널명이면 건너뜀.
- `--super`: 슈퍼관리자 권한 부여.
- ⚠️ `SUPABASE_SERVICE_ROLE_KEY`는 **접두사 없이** 두면 서버(node 스크립트)에서만 읽히고 클라이언트 번들엔 포함되지 않음 (§0의 "넣지 말 것"은 `NEXT_PUBLIC_`로 노출하지 말라는 뜻). 발급이 끝나면 이 줄은 지워도 됨.

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| `Invalid login credentials` | 비번 틀림 / 이메일 불일치 (아이디에 도메인 자동부착되어 가입 이메일과 안 맞음) | 이메일 전체 입력, 또는 `@civilwar.local` 계정 생성 |
| `Email not confirmed` | Add user 시 Auto Confirm 미체크 | `update auth.users set email_confirmed_at = now() where email = '...';` |
| 가입 이메일 도메인 거부 | `@civilwar.local` 형식 거부 가능 | 실제 도메인 형식 사용 + `NEXT_PUBLIC_INTERNAL_EMAIL_DOMAIN` 맞춤 |
| 대시보드 메뉴 404 | 해당 라우트 미구현 | ROADMAP Phase 3~5에서 구현 |
| 멤버 등록 시 권한 오류 | 채널 미생성 / 소유 아님 | 3번 시드로 채널 생성 확인 |

## 현재 프로젝트 상태 (2026-05-29)

- 프로젝트 ref: `dxeuukenmhfnsrhiggri`
- 1·2·3 완료. 슈퍼관리자 `gyeori0626` (로그인 아이디 `gyeori0626`, 이메일 `gyeori0626@civilwar.local`로 전환됨) + "테스트 내전 채널" 소유.
- 추가 채널·관리자는 **5번 스크립트**로 발급 (검증됨).
