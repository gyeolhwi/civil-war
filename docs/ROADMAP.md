# ROADMAP — 단계별 계획

전체 흐름을 Phase로 나눈 계획. 세부 현재 상태는 [`STATUS.md`](STATUS.md) 참조.
표기: ✅ 완료 · 🔶 진행중 · ⬜ 예정

---

## Phase 0 — 기획 ✅

- 요구사항·워크플로우·ERD·시나리오·디자인 문서 (`spec/`, `design/`)
- 2회 검토(구현·사용성 / 제품 완결성) 반영

## Phase 1 — 스캐폴딩 ✅

- Next.js 16 + Supabase + shadcn/ui
- 디자인 토큰(Linear 다크 + 모션), 도메인 상수(HEROES/MAPS/TIER/scoring)
- Supabase 클라이언트 3종 + 세션 가드 미들웨어
- 기본 페이지: 랜딩 / 로그인(아이디·이메일) / 대시보드 메뉴 허브

## Phase 2 — DB 셋업 🔶

- ✅ 스키마 마이그레이션 (`supabase/migrations/0001_init.sql`) 실행
- ✅ 관리자 계정 생성 + 로그인 동작
- 🔶 채널 시드 (슈퍼관리자 승격 + 첫 채널) — STATUS "다음 할 일 0"

## Phase 3 — 멤버 관리 ⬜  (F3·F4)

- `/app/members`: 멤버 목록 + 추가/수정/삭제
- 입력 폼: 배틀태그, 디코명, 역할별 티어, 주/부 포지션, 선호 영웅(자동완성), 선호 맵
- `getMyChannel()` 헬퍼, Server Action CRUD
- 참조: `spec/scenarios.md` SC-10~14, `spec/erd.md` 2.3~2.7

## Phase 4 — 내전 워크플로우 ⬜  (F5~F11)

`spec/workflow.md` [3]~[12] 를 화면으로:

- [3] 참가자 10명 선택
- [4] 모드 선택 (기본 / 팀장 4모드)
- [5] 팀 빌딩 — 자동 밸런스(조합 brute-force + 점수차 최소 상위10 랜덤) / 팀장 확정
- [6] 스네이크 드래프트 — dnd-kit, **실시간 점수**(카운트업 모션)
- [7] 팀 확정 + **디스코드 복사**(F12b)
- [8] 맵 자동 선정 (선호 합집합 랜덤)
- [9] 영웅 밴 (팀당 1명)
- [11] 결과 입력 (승팀·스코어 필수, 영웅 자동완성 선택)
- [12] 다음 판 분기 (4버튼)

## Phase 5 — 통계·매치 관리 ⬜  (F12·F12c)

- `/app/stats`: 매치 이력(날짜 그루핑), 개인 전적
- 매치 수정·삭제 (오기입 복구)
- `/app/channel`: 채널 정보

## Phase 6 — 폴리싱 ⬜

- 모션 다듬기 (`design/design.md` Motion: 점수 카운트업, 드롭 스냅, 단계 전환)
- 반응형 (참가자 선택·결과 입력 모바일)
- 영웅/맵 이미지 배치 (`/public/heroes/`, `/public/maps/`)
- 접근성(`prefers-reduced-motion` 이미 적용)
- 로그인 에러 메시지 일반화, middleware→proxy 정리

## Phase 7 — 배포 ⬜

- Vercel 연결 + 환경변수
- Supabase 프로덕션 점검 (RLS, 백업)

---

## v2 백로그 (범위 밖)

6v6 · 노쇼/페널티 · 영웅 밴 2~3명 · 디스코드 봇 연동 · 자체 MMR(TrueSkill) · 실시간 드래프트(다중 접속) · 토너먼트 · OP.GG 연동 · 영웅·맵 마스터 DB 이관 · 멤버 엑셀 일괄 등록 · 누적 랭킹·시즌제

(상세: `spec/requirements.md` §11)
