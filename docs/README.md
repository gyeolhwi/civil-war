# Civil War — 문서 지도

오버워치 디스코드 채널별 내전 편성·운영·기록 웹앱.

> **새 세션을 시작한다면 → [`STATUS.md`](STATUS.md) 부터 읽으세요.** 지금 어디까지 됐고 다음에 뭘 할지가 정리돼 있습니다.

## 📁 폴더 구조

| 경로 | 내용 | 성격 |
|---|---|---|
| [`STATUS.md`](STATUS.md) | **현재 진행 상태 + 다음 할 일** (세션 이어가기 진입점) | 자주 갱신 |
| [`ROADMAP.md`](ROADMAP.md) | 단계별(Phase) 전체 계획 | 가끔 갱신 |
| [`spec/`](spec/) | 기획·명세 — **Source of Truth** | 확정 후 안정 |
| `spec/requirements.md` | 요구사항 정의 (기능 F1~, 점수·조합 룰, 데이터 모델 개요) | |
| `spec/workflow.md` | 내전 진행 워크플로우 [1]~[13] | |
| `spec/erd.md` | 데이터 모델 ERD (10개 테이블 + RLS) | |
| `spec/scenarios.md` | 시나리오 케이스 (SC-01~) | |
| [`design/design.md`](design/design.md) | 디자인 시스템 (Linear 다크 + 모션 + 토스식 UX) | |
| [`ops/supabase-setup.md`](ops/supabase-setup.md) | DB 마이그레이션·계정·시드 실행 가이드 | 셋업 시 |
| [`ops/discord-bot-setup.md`](ops/discord-bot-setup.md) | 디스코드 봇 처음부터 끝까지 셋업(권한·env·Vercel·트러블슈팅) | 봇 작업 시 |
| [`ops/channel-link-guide.md`](ops/channel-link-guide.md) | 새 디스코드 서버↔채널 연결(서버 ID 안내문·운영자 매핑) | 채널 추가 시 |

## 🧭 빠른 컨텍스트

- **운영 모델**: 디스코드 채널 = 독립 내전 그룹. 채널 관리자가 멤버 등록·팀 편성·결과 기록. 매주 금요일 1회, 채널당 10~30명.
- **인증**: 아이디(또는 이메일) + 비밀번호 (Supabase Auth). 슈퍼관리자가 계정 발급.
- **핵심 흐름**: 로그인 → 대시보드 → 참가자 10명 선택 → 팀 빌딩(자동/팀장) → 드래프트 → 맵/밴 → 결과 입력 → 다음 판.
- **기준**: 오버워치 2, 5v5 (1탱-2딜-2힐). 6v6은 v2.

## 🛠 기술 스택

Next.js 16 (App Router/Turbopack) · React 19 · TypeScript · Tailwind v4 · shadcn/ui · TanStack Query · react-hook-form + zod · dnd-kit · Supabase(Postgres/Auth) · Vercel · Biome · Vitest · pnpm

## 📄 PDF 생성 (선택)

문서를 PDF로 보려면:

```bash
npx md-to-pdf docs/spec/requirements.md   # docs/spec/requirements.pdf 생성
```

PDF는 `.gitignore` 처리됨 (md가 원본).
