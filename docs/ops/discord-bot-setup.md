# 디스코드 봇 셋업 가이드

서버리스(Vercel) 방식 Discord 봇을 **처음부터 끝까지** 세우는 절차.
보관·학습·재현용. 이 프로젝트의 `/내전` 봇이 이 절차로 구축됨.

> **아키텍처 한 줄 요약:** 상시 떠 있는 봇 서버 없이, **HTTP 인터랙션**(슬래시 커맨드가
> 올 때만 Vercel API 라우트로 POST가 옴) + **REST**(행동은 봇 토큰으로 어디서든 호출).
> 게이트웨이(WebSocket, 별도 호스팅)는 실시간 수동 이벤트(반응/음성 입퇴장)가 꼭
> 필요할 때만. 배경은 [`discussion/discord-bot-and-presentation.md`](../discussion/discord-bot-and-presentation.md).

관련 코드:
- 엔드포인트: [`src/app/api/discord/interactions/route.ts`](../../src/app/api/discord/interactions/route.ts)
- 서명검증: [`src/lib/discord/verify.ts`](../../src/lib/discord/verify.ts)
- REST 헬퍼: [`src/lib/discord/rest.ts`](../../src/lib/discord/rest.ts)
- 커맨드 등록: [`scripts/discord-register.mjs`](../../scripts/discord-register.mjs)

---

## 0. 전체 순서 (체크리스트)

1. [Developer Portal에서 App 생성](#1-application-생성)
2. [Bot 추가 + 토큰 발급](#2-bot--토큰)
3. [환경변수 4개 확보 + 등록](#3-환경변수)
4. [Vercel 배포 보호 끄기 + env 등록 + 배포](#4-vercel-설정)
5. [Interactions Endpoint URL 등록](#5-interactions-endpoint-url-등록)
6. [봇 권한/스코프 정하고 서버에 초대](#6-봇-권한--초대)
7. [슬래시 커맨드 등록](#7-슬래시-커맨드-등록)
8. [테스트](#8-테스트)

> **핵심 의존성:** env(특히 `DISCORD_PUBLIC_KEY`) + 라우트 **배포**가 먼저여야
> 5번(URL 등록)이 통과한다. 순서를 지킬 것.

---

## 1. Application 생성

[Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.

### General Information 탭에서 확보할 값
| 항목 | 용도 |
|---|---|
| **Application ID** | 슬래시 커맨드 등록 대상. 비밀 아님 → `DISCORD_APPLICATION_ID` |
| **Public Key** (hex 64자) | 인터랙션 서명검증용 → `DISCORD_PUBLIC_KEY` |

### 입력란 4개 — 무엇이 필요한가 (정합성)
| 입력란 | 판정 | 이유 |
|---|---|---|
| **Interactions Endpoint URL** | ✅ **필수** | 서버리스 봇의 핵심. 슬래시 커맨드가 들어오는 통로. **단, env+배포 후 등록**(5번) |
| **연결된 역할 인증 URL** | ❌ 영구 불필요 | Discord "Linked Roles" 전용 기능. 우리는 안 씀 |
| **이용약관 URL** | ⬜ 선택 | 봇 동작에 불필요. **100개 서버 도달 → 앱 인증** 시 또는 공개 배포 시에만 |
| **개인정보 보호 정책 URL** | ⬜ 선택(권장) | 동일하게 필수 아님. 단 개인정보(디코ID·배틀태그 등) 저장 시 권장 |

> 내부 커뮤니티용 봇은 4개 중 **인터랙션 엔드포인트 URL 하나만** 채우면 된다.

---

## 2. Bot + 토큰

**Bot 탭**:

- **Reset Token → 토큰 복사** → `DISCORD_BOT_TOKEN` (메시지 전송·반응 등 REST 호출용)
- **Privileged Gateway Intents** (Presence / Server Members / Message Content) → **전부 OFF**
  - HTTP 인터랙션 + REST 방식이라 불필요. 게이트웨이 봇을 따로 붙일 때만 켠다.
- **Public Bot** → **OFF** (개인용이면 나만 초대 가능하게)

> ⚠️ 봇 토큰은 **절대 비밀**. `NEXT_PUBLIC_` 금지, 클라이언트 번들·커밋에 넣지 말 것.
> 토큰이 노출되면 즉시 Reset.

---

## 3. 환경변수

`.env.local` (로컬) — 4개:

```bash
# General Information > Public Key (hex 64자) — 서명검증. 서버 전용.
DISCORD_PUBLIC_KEY=...
# Bot 탭 > Token — REST 호출. 서버 전용.
DISCORD_BOT_TOKEN=...
# General Information > Application ID — 커맨드 등록용. 비밀 아님.
DISCORD_APPLICATION_ID=...
# 내전 디스코드 서버 ID — 커맨드 등록용.
DISCORD_GUILD_ID=...
```

### 서버 ID(Guild ID) 찾기
디스코드 설정 → **고급 → 개발자 모드 ON** → 서버 아이콘 우클릭 → **서버 ID 복사**.

### 💡 꿀팁 — 봇 토큰만 있으면 App ID·Guild ID 자동 추출
봇 토큰 첫 세그먼트(`.` 앞)를 base64 디코딩하면 **봇 유저 ID = Application ID**.
`GET /users/@me/guilds`로 **봇이 속한 서버 목록(=Guild ID)** 조회 가능.

```js
// node --env-file=.env.local 로 실행
const t = process.env.DISCORD_BOT_TOKEN;
const appId = Buffer.from(t.split(".")[0], "base64").toString("utf8");
const guilds = await (await fetch("https://discord.com/api/v10/users/@me/guilds",
  { headers: { Authorization: `Bot ${t}` } })).json();
console.log(appId, guilds.map((g) => `${g.name}:${g.id}`));
```

---

## 4. Vercel 설정

### (a) 배포 보호 끄기 — ⚠️ 안 끄면 Discord가 엔드포인트에 도달 못 함
**Settings → Deployment Protection → Vercel Authentication → `Require Log In` OFF → Save**

- 켜져 있으면(`Standard Protection`) `*.vercel.app` 주소가 **로그인 장벽(401, SSO 쿠키)** 으로 막혀,
  Discord PING이 우리 라우트에 닿기 전에 차단됨 → "엔드포인트 URL을 인증할 수 없습니다".
- 이 앱은 자체 로그인이 있는 공개 웹앱이라 끄는 게 정상.

### (b) 환경변수 등록
**Settings → Environment Variables** — **Production 스코프**로:

| 변수 | Vercel 필요? | 비고 |
|---|---|---|
| `DISCORD_PUBLIC_KEY` | ✅ 필요 | 런타임 서명검증 |
| `DISCORD_BOT_TOKEN` | ✅ 필요 | 런타임 REST 호출 |
| `DISCORD_APPLICATION_ID` | ❌ 불필요 | **로컬 등록 스크립트 전용** |
| `DISCORD_GUILD_ID` | ❌ 불필요 | **로컬 등록 스크립트 전용** |

### (c) ⚠️⚠️ env 변경 후 반드시 새 배포
**Vercel은 환경변수를 추가/변경해도 "이미 떠 있는 배포"엔 적용하지 않는다. 새 배포부터 반영.**

- 증상: 코드·토큰 다 맞는데 런타임에서 `DISCORD_BOT_TOKEN 가 설정되지 않았습니다`.
- 해결: **git push**(새 커밋)로 새 배포를 띄우거나, Deployments에서 Redeploy.
  - 단순 Redeploy가 env를 못 무는 경우가 있어, **새 커밋 push가 가장 확실**.

---

## 5. Interactions Endpoint URL 등록

env(`DISCORD_PUBLIC_KEY`)가 **Production에 있고 라우트가 배포된 뒤**,
General Information → **Interactions Endpoint URL**:

```
https://<배포-도메인>/api/discord/interactions
```

저장하면 Discord가 **서명된 PING**을 보내고, 우리 라우트가 검증 후 **PONG**으로 응답해야 통과.

### 등록 전 스모크 테스트 (선택)
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  "https://<도메인>/api/discord/interactions"
# 기대: 401 (본문 "invalid request signature") = 라우트 살아있음 + 검증 동작
#  - 404 → 라우트 미배포 / 도메인 오류
#  - 401인데 응답에 _vercel_sso_nonce 쿠키 → Vercel 배포 보호 안 꺼짐(4-a)
```

---

## 6. 봇 권한 + 초대

**OAuth2 → URL Generator**:

### Scopes (둘 다 체크)
- `bot`
- `applications.commands`

### 봇 권한 — 최소만 (체크한 것 + 이유)
| 섹션 | 권한 | 이유 |
|---|---|---|
| 일반 | **채널 보기** (View Channels) | 기본 동작 |
| 채팅 | **메시지 보내기** (Send Messages) | 공지 전송 |
| 채팅 | **링크 임베드** (Embed Links) | 공지가 임베드 |
| 채팅 | **반응 추가** (Add Reactions) | ✅ 자동 첨부 |
| 채팅 | **메시지 기록 보기** (Read Message History) | 반응 단 사람·메시지 조회 |
| 음성 | **멤버 이동** (Move Members) | A/B 음성채널 자동분배(Phase 4) |

> ⚠️ 관리자·서버관리 등은 주지 않는다. **최소 권한 원칙.**

생성된 URL로 접속 → 서버 선택 → 초대.

---

## 7. 슬래시 커맨드 등록

길드(서버) 등록은 **즉시 반영**(전역 등록은 ~1시간). 내전용이라 길드 등록이 맞다.

```bash
node --env-file=.env.local scripts/discord-register.mjs
# → ✓ 길드(...)에 N개 커맨드 등록 완료: /내전 — ...
```

- 스크립트는 **PUT(전체 덮어쓰기)** 라 여러 번 돌려도 중복 안 됨.
- 커맨드 정의를 바꾸면(옵션 추가 등) 다시 실행.
- 등록은 **로컬에서 1회**면 됨(Vercel과 무관). 핸들러 코드 배포와는 별개.

---

## 8. 테스트

디스코드에서:
```
/내전 6/10 21:00
```
→ 봇이 모집 임베드 공지 + ✅ 자동 첨부, 실행자에겐 ephemeral 확인 메시지.

> 슬래시 커맨드는 **사람이 디스코드에서 입력**해야 트리거됨(정상 서명은 Discord만 생성).
> 외부에서 `curl`로 흉내 못 냄 → 코드 검증은 로컬 단위테스트, 권한·토큰 검증은 REST 직접 호출로.

---

## 트러블슈팅 (실제로 겪은 것)

| 증상 | 원인 | 해결 |
|---|---|---|
| "엔드포인트 URL을 인증할 수 없습니다" | Vercel **배포 보호(SSO)** 가 차단 | 4-(a) `Require Log In` OFF |
| 엔드포인트 입력란이 https만 받는다 | 파일 경로를 넣음 | **배포된 HTTPS URL** + `/api/discord/interactions` |
| 모든 경로 404 (`civil-war.vercel.app`) | 이름 비슷한 **남의 프로젝트** | 내 계정 스코프 도메인 사용(`...-<team>.vercel.app`) |
| `DISCORD_BOT_TOKEN 가 설정되지 않았습니다` | env 추가 후 **새 배포 안 함** | 4-(c) git push로 새 배포 |
| 커맨드가 입력창에 안 뜸 | 등록 안 됨 / 캐시 | 7번 실행 / 디스코드 Ctrl+R |
| 공지 게시 실패 (403) | 봇이 그 채널에 권한 없음 | 채널 권한에 메시지·반응·임베드 허용 |

---

## 부록 — 동작 원리 요약

- **PING/PONG:** Discord가 엔드포인트 유효성을 주기적으로 PING(type 1)으로 확인 → PONG(type 1) 응답.
- **서명검증(Ed25519):** 헤더 `x-signature-ed25519` + `x-signature-timestamp`, 서명 대상 = `timestamp + rawBody`.
  반드시 **본문 파싱 전 raw 문자열**로 검증. (`node:crypto`의 `verify(null, ...)`)
- **슬래시 응답:** 인터랙션(type 2) → 콜백 type 4(메시지). `flags: 64` = 실행자만 보이는 ephemeral.
- **✅ 자동 첨부:** 인터랙션 응답으론 message.id를 못 받으므로, 공지는 **봇 REST(`POST /channels/{id}/messages`)**
  로 올려 id를 받고 → `PUT .../reactions/✅/@me`로 반응. 인터랙션 응답은 ephemeral 확인용.
