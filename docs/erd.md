# ERD — 데이터 모델 설계서

- **프로젝트**: Civil War — 오버워치 디스코드 채널별 내전 운영 웹앱
- **버전**: v1
- **DB**: Supabase Postgres (RLS 사용)
- **연관 문서**: `docs/requirements.md` (§5 데이터 모델), `docs/workflow.md`

---

## 0. 설계 원칙

- 모든 PK는 `uuid` (Supabase `gen_random_uuid()`), 단 매핑·이력성 테이블은 복합 PK 사용
- 시각 컬럼은 `timestamptz` (`created_at`, `updated_at`)
- 마스터 데이터(영웅·맵)는 v1 코드 상수 → 컬럼은 `text` 코드로 저장 (requirements §5.4)
- 채널 격리는 **RLS**로 강제 — 관리자는 자기 소유 채널 데이터만 접근
- 점수 관련 enum/수치는 코드 도메인 모듈에서 계산, DB는 결과 저장

---

## 1. 전체 관계도

```text
                 ┌─────────────┐
                 │   admins    │  (auth.users 1:1)
                 └──────┬──────┘
                        │ owner_admin_id
                        ▼
   ┌─────────────────────────────────────────────┐
   │                  channels                    │
   └───┬───────────────────────────────┬─────────┘
       │                               │
       │ channel_id                    │ channel_id
       ▼                               ▼
 ┌──────────────┐                ┌──────────────┐
 │channel_members│◄── member_id ──│   members    │ (배틀태그 글로벌 유니크)
 └──────┬───────┘                └──────┬───────┘
        │ (channel_id, member_id)        │ member_id
        │                                │
   ┌────┴───────────────────────────────┴────────────┐
   │  member_role_ratings (채널별 역할 티어)            │
   │  member_hero_preferences (채널별 선호 영웅)        │
   │  member_map_preferences (채널별 선호 맵)           │
   └──────────────────────────────────────────────────┘

 channels ──< matches ──< teams ──< team_members ──> members
                (A/B)                  (배정·점수·영웅·픽순서)
```

---

## 2. 테이블 정의

### 2.1 `admins` — 채널 관리자 계정

Supabase `auth.users`와 1:1. 아이디(username) 로그인을 위한 프로필.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | uuid | PK, FK → `auth.users.id` | Supabase Auth 사용자 |
| `username` | text | UNIQUE, NOT NULL | 로그인 아이디 |
| `display_name` | text | | 표시 이름 (예: 벙커) |
| `is_super` | boolean | NOT NULL, default false | 슈퍼관리자 여부 |
| `created_at` | timestamptz | NOT NULL, default now() | |

> 내부 이메일(`{username}@civilwar.local`)은 `auth.users.email`에 저장. `admins`에는 username만.

### 2.2 `channels` — 내전 채널(그룹)

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | uuid | PK | |
| `name` | text | NOT NULL | 채널명 |
| `discord_channel_id` | text | UNIQUE, nullable | 디스코드 채널 ID (연동 시) |
| `owner_admin_id` | uuid | FK → `admins.id` | 소유 관리자 (1:1, v1) |
| `created_at` | timestamptz | NOT NULL, default now() | |

### 2.3 `members` — 글로벌 멤버 마스터

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | uuid | PK | |
| `battle_tag` | text | UNIQUE, NOT NULL | `이름#1234` (글로벌 유니크) |
| `discord_name` | text | nullable | 디스코드 이름 |
| `created_at` | timestamptz | NOT NULL, default now() | |

> 신원 정보만. 티어·선호 등 프로필은 채널별 하위 테이블에.

### 2.4 `channel_members` — 채널↔멤버 매핑 + 기본 프로필

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `channel_id` | uuid | FK → `channels.id` | |
| `member_id` | uuid | FK → `members.id` | |
| `primary_role` | text | nullable | 주 포지션 (tank/dps/support) |
| `secondary_role` | text | nullable | 부 포지션 |
| `joined_at` | timestamptz | NOT NULL, default now() | |
| | | **PK: (channel_id, member_id)** | |

### 2.5 `member_role_ratings` — 채널별 역할 티어

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `channel_id` | uuid | FK | |
| `member_id` | uuid | FK | |
| `role` | text | CHECK in (tank/dps/support) | 역할 |
| `tier` | text | CHECK in (bronze..champion) | 티어 |
| `division` | smallint | CHECK 1~5 | 디비전 (1=최상) |
| `rating_score` | integer | NOT NULL | 환산 점수 (티어+디비전, §7.1) |
| | | **PK: (channel_id, member_id, role)** | |

> `rating_score`는 입력 시 `tier`/`division`으로부터 계산해 캐시. 티어 없는 역할은 레코드 없음 → 배정 불가.
> **단순화**: `channel_id`·`member_id`는 각각 단순 FK(`channels`/`members`)로 참조하고, `channel_members`와의 정합성은 앱(Server Action)에서 보장. 복합 FK는 v1에서 과하므로 사용하지 않음. (`member_hero_preferences`, `member_map_preferences`도 동일)

### 2.6 `member_hero_preferences` — 채널별 선호 영웅

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `channel_id` | uuid | FK | |
| `member_id` | uuid | FK | |
| `hero_code` | text | NOT NULL | HEROES 상수 코드 (zod enum) |
| | | **PK: (channel_id, member_id, hero_code)** | |

> 멤버당 최대 5개 (앱 레벨 제약). 선호 순위 없음 (has/has-not만, requirements 결정).

### 2.7 `member_map_preferences` — 채널별 선호 맵

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `channel_id` | uuid | FK | |
| `member_id` | uuid | FK | |
| `map_code` | text | NOT NULL | MAPS 상수 코드 (zod enum) |
| | | **PK: (channel_id, member_id, map_code)** | |

### 2.8 `matches` — 한 판의 내전

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | uuid | PK | |
| `channel_id` | uuid | FK → `channels.id` | |
| `played_at` | timestamptz | NOT NULL, default now() | 진행 시각 (날짜로 세션 그루핑) |
| `build_mode` | text | NOT NULL | 팀 빌딩 모드 (basic/captain_top/captain_tank/captain_fun/captain_manual) |
| `map_code` | text | nullable | 선정 맵 |
| `banned_hero_a` | text | nullable | A팀 밴 영웅 |
| `banned_hero_b` | text | nullable | B팀 밴 영웅 |
| `winner_side` | text | CHECK in (A/B), nullable | 승팀 (무승부 NULL) |
| `score_a` | smallint | nullable | A팀 스코어 |
| `score_b` | smallint | nullable | B팀 스코어 |
| `memo` | text | nullable | 메모 |
| `created_at` | timestamptz | NOT NULL, default now() | |

> 결과 미입력 매치는 `winner_side`/score가 NULL 상태로 존재 가능 (workflow 엣지케이스).

### 2.9 `teams` — 매치당 A/B 팀

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | uuid | PK | |
| `match_id` | uuid | FK → `matches.id` | |
| `side` | text | CHECK in (A/B) | |
| `captain_id` | uuid | FK → `members.id`, nullable | 팀장 (기본 모드는 NULL) |
| `total_score` | integer | NOT NULL | 5인 개인 점수 합 |
| `combo_bonus` | integer | NOT NULL, default 0 | 조합 보너스 |
| `combo_penalty` | integer | NOT NULL, default 0 | 조합 패널티 |
| `final_score` | integer | NOT NULL | total + bonus − penalty (캐시) |
| `is_winner` | boolean | nullable | 승패 (winner_side로부터, 무승부 시 false) |
| | | **UNIQUE: (match_id, side)** | |

### 2.10 `team_members` — 팀 소속 5명

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | uuid | PK | |
| `team_id` | uuid | FK → `teams.id` | |
| `member_id` | uuid | FK → `members.id` | |
| `assigned_role` | text | NOT NULL, CHECK in (tank/dps/support) | 배정 포지션 |
| `individual_score` | integer | NOT NULL | 배정 포지션 티어 × 가중치 (§7.3) |
| `hero_used` | text | nullable | 사용 영웅 (결과 입력 시, **선택**. 미입력은 통계 "미기록") |
| `pick_order` | smallint | nullable | 드래프트 픽 순서 1~8 (자동 모드 NULL) |
| | | **UNIQUE: (team_id, member_id)** | |

---

## 3. 관계 요약 (카디널리티)

| 부모 | 자식 | 관계 | ON DELETE |
|---|---|---|---|
| `auth.users` | `admins` | 1:1 | CASCADE |
| `admins` | `channels` | 1:N (v1은 1:1 운영) | RESTRICT |
| `channels` | `channel_members` | 1:N | CASCADE |
| `members` | `channel_members` | 1:N | CASCADE |
| `channel_members` | `member_role_ratings` | 1:N | CASCADE |
| `channel_members` | `member_hero_preferences` | 1:N | CASCADE |
| `channel_members` | `member_map_preferences` | 1:N | CASCADE |
| `channels` | `matches` | 1:N | CASCADE |
| `matches` | `teams` | 1:2 | CASCADE |
| `teams` | `team_members` | 1:5 | CASCADE |
| `members` | `team_members` | 1:N | RESTRICT |

> 매치 이력의 `member_id`는 RESTRICT — 멤버 삭제 시 과거 전적 보존을 위해 막음. (삭제 대신 `channel_members`에서만 제거 권장)

---

## 4. 인덱스

| 테이블 | 인덱스 | 목적 |
|---|---|---|
| `members` | `battle_tag` (unique) | 등록 시 충돌 체크 |
| `channels` | `owner_admin_id` | 관리자별 채널 조회 |
| `matches` | `(channel_id, played_at)` | 채널 전적·날짜 그루핑 |
| `team_members` | `member_id` | 개인 전적 집계 (F12) |
| `teams` | `match_id` | 매치별 팀 조회 |

---

## 5. RLS 정책 (개념)

> 모든 테이블 RLS 활성화. 핵심은 "자기 소유 채널 격리".

| 테이블 | SELECT/WRITE 조건 |
|---|---|
| `channels` | `owner_admin_id = auth.uid()` (슈퍼관리자는 전체) |
| `channel_members`, `member_*` | 소속 `channel_id`가 본인 소유 채널일 때 |
| `matches`, `teams`, `team_members` | 매치의 `channel_id`가 본인 소유 채널일 때 |
| `members` | 글로벌 마스터 — 직접 노출 안 함 |
| `admins` | 본인 행만 SELECT, 슈퍼관리자는 전체 (계정 발급용) |

> **단순화 방침**: `members`는 글로벌이라 RLS만으로 격리가 어려우므로, **멤버 조회·등록·수정은 전부 Server Action에서 채널 컨텍스트를 강제**한다. RLS는 채널 소유 기준 단순 정책만 두고, `members` 자체는 클라이언트에서 직접 쿼리하지 않는다 (이중 정책 방지).

---

## 6. 점수 계산과 DB의 경계

- **계산 위치**: 개인 점수·조합 보너스/패널티는 **도메인 모듈(TypeScript)** 에서 계산
- **저장 위치**: 계산 결과만 `teams`/`team_members`에 캐시 (`final_score`, `individual_score` 등)
- **재현성**: `member_role_ratings.rating_score`, `team_members.assigned_role`이 있으면 언제든 재계산 가능
- 점수표·가중치·패널티 수치는 코드 상수 (`SCORING` 모듈) — requirements §7, §8과 동기화

---

## 7. 미확정 / 후속

| # | 항목 | 비고 |
|---|---|---|
| E1 | `members.discord_name`을 채널별로 다르게 둘지 | v1은 글로벌 단일 |
| ~~E2~~ | ~~팀장의 배정 포지션 저장 시점~~ | ✅ **확정** → 드래프트 시작 전 지정, `team_members.assigned_role`에 저장 (workflow [5-B]) |
| E3 | 결과 미입력 매치 자동 정리 | 수동 삭제(F12c)는 v1 지원. 자동 정리는 후속 |
| E4 | 공정성 보정(최근 같은 팀)을 위한 쿼리 최적화 | `team_members` 이력 조회 — 데이터 누적 후 |
