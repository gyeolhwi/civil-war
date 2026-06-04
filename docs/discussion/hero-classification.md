# 영웅 특성 분류 (조합 밸런스용) — 초안

> **작성:** 2026-06-05 / 상태: 검수 대기
>
> [`balancing-data-review.md`](balancing-data-review.md) §A의 후속. 조합 밸런스를 위해 영웅마다 특성을 정리한다.
> **이 초안의 태그를 직접 고쳐서 확정한다.** (특히 ⚠️·빈칸 ▢)

---

## 확정된 프레임

- **두 축으로 태깅**
  - **`comp` (조합 성향)**: `dive` / `brawl` / `poke` — 팀 응집 판정용. **전 역할 공통**, 복수 가능
  - **`func` (역할 내 기능)**: within-role 체크용 (메인힐 0명 등)
- **`comp` 절제 규율**: 기본 **1개**, 진짜 유연한 영웅만 **최대 2개**, 3개는 거의 금지
  - 이유: 다 붙이면 누구나 모든 컨셉에 맞아서 **감점이 영영 안 터짐**
- **감점만** (시너지 가점 `comboBonus`는 끔 — 현행 유지)
- 분류는 **코드에 유지** (밸런싱 판단이라 DB 콘텐츠 아님)

### 어휘

| comp | 뜻 |
|---|---|
| `dive` | 기동으로 후방 진입 |
| `brawl` | 한 덩어리 근접 난전 |
| `poke` | 사거리 우위 견제 |

| func (딜) | func (힐) |
|---|---|
| `hitscan` 메인딜·앵커 | `main_heal` 메인힐 |
| `flanker` 침투 변수 | `off_heal` 유틸·보조힐 |
| `projectile` 투사체 | `damage` 공격형 힐 |
| `sub` 유틸·세컨딜 | |

> 탱커는 `comp`가 곧 기능이라 `func` 없음.
> ⚠️ = 내가 분류에 확신이 덜한 것(검수 요망), ▢ = 내 지식으로 검증 불가(네가 채워야 함).

---

## 돌격 (Tank) — comp만

| 영웅 | comp | 비고 |
|---|---|---|
| 라인하르트 | `brawl` | |
| 자리야 | `brawl` | |
| 정커퀸 | `brawl` | |
| 라마트라 | `brawl`, `poke` | ✅ 유지력 중심(brawl) + 님로드 poke |
| 마우가 | `brawl` | |
| 로드호그 | `brawl` | |
| 윈스턴 | `dive` | |
| D.Va | `dive` | |
| 둠피스트 | `dive` | |
| 레킹볼 | `dive` | |
| 해저드 | `dive` | ✅ 궁=광역 속박(유틸) |
| 시그마 | `poke` | |
| 오리사 | `poke`, `brawl` | |
| 도미나 | `poke`, `brawl` | ✅ 사용자 확정 |

## 공격 (Damage) — comp + func

| 영웅 | comp | func | 비고 |
|---|---|---|---|
| 솔저: 76 | `poke`, `brawl` | `hitscan` | |
| 캐서디 | `brawl` | `hitscan` | |
| 애쉬 | `poke` | `hitscan` | |
| 소전 | `poke` | `hitscan` | ✅ 기동 없음·폭딜 |
| 바스티온 | `poke`, `brawl` | `hitscan` | ✅ 지속딜 |
| 한조 | `poke` | `projectile` | |
| 위도우메이커 | `poke` | `hitscan` | |
| 프레야 | `dive` | `projectile` | ✅ 고화력 |
| 엠레 | `poke` | `hitscan` | ✅ 사용자 |
| 트레이서 | `dive` | `flanker` | |
| 겐지 | `dive` | `flanker` | |
| 솜브라 | `dive` | `flanker` | |
| 리퍼 | `brawl` | `flanker` | 근접 침투 |
| 에코 | `dive` | `projectile` | ✅ 암살(백라인) |
| 파라 | `poke` | `projectile` | ✅ 진형 붕괴·공중 견제 |
| 벤처 | `dive`, `brawl` | `projectile` | 굴착 기동 |
| 시에라 | `dive` | `flanker`·`hitscan` | ✅ 사용자 |
| 안란 | `poke` | `flanker`·`sub` | ✅ 사용자 |
| 벤데타 | `dive` | `sub` | ✅ 사용자 |
| 메이 | `brawl` | `sub` | 벽·빙결 유틸 |
| 시메트라 | `poke`, `brawl` | `sub` | 터렛·텔포 |
| 토르비욘 | `brawl`, `poke` | `sub` | 터렛 |
| 정크랫 | `brawl` | `sub` | 지역 장악 |

## 지원 (Support) — comp + func

| 영웅 | comp | func | 비고 |
|---|---|---|---|
| 아나 | `poke` | `main_heal` | |
| 바티스트 | `poke`, `brawl` | `main_heal` | |
| 모이라 | `brawl`, `dive` | `main_heal` | |
| 키리코 | `dive`, `brawl` | `main_heal` | |
| 주노 | `dive`, `poke` | `main_heal` | ✅ 기동 힐러 |
| 라이프위버 | `brawl` | `main_heal` | 지속·유틸 |
| 루시우 | `dive`, `brawl` | `off_heal` | 속도 유틸 |
| 메르시 | `dive` | `off_heal` | 비행수 보좌 |
| 브리기테 | `brawl` | `off_heal` | 아머·근접 |
| 미즈키 | `brawl` | `off_heal` | ✅ 사용자 · 속박·유틸 |
| 우양 | `poke` | `damage` | ✅ 사용자 |
| 제트팩 캣 | `dive` | `off_heal` | ✅ 플랭킹·비행 인에이블 (comp=dive 해석) |
| 젠야타 | `poke` | `damage` | |
| 일리아리 | `poke` | `damage` | |

---

## ▢ 8명 — ✅ 사용자 확정 완료 (2026-06-05)

| 영웅 | 역할 | 사용자 입력 | 반영 (comp / func) |
|---|---|---|---|
| 도미나 | 탱 | poke, brawl | `poke`,`brawl` / — |
| 엠레 | 딜 | poke, hitscan | `poke` / `hitscan` |
| 시에라 | 딜 | dive, flanker, hitscan | `dive` / `flanker`·`hitscan` |
| 안란 | 딜 | poke, flanker, sub | `poke` / `flanker`·`sub` |
| 벤데타 | 딜 | dive, sub | `dive` / `sub` |
| 미즈키 | 힐 | brawl, off_heal, 속박·유틸 | `brawl` / `off_heal` |
| 우양 | 힐 | poke, damage | `poke` / `damage` |
| 제트팩 캣 | 힐 | flanker, off_heal, 비행유틸 | `dive` / `off_heal` |

> **해석 메모** — 내 스키마는 `comp ∈ {dive,brawl,poke}` 라서:
> - 제트팩 캣 "flanker(비행)" → **comp=`dive`** 로 매핑 (지원군 비행 침투 = dive 성향). 다르게 보면 알려줘.
> - 안란 `flanker`+`sub`, 시에라 `flanker`+`hitscan` 는 func 복수로 그대로 수용.

---

## 다음 단계 (확정 후) — ✅ 구현 완료 (2026-06-05)

1. ✅ `types.ts` `Comp`/`HeroFunc` 타입 + `Hero.comp`/`Hero.func` (기존 `SubRole`·`normalizedSubRole` 대체)
2. ✅ `heroes.ts` 51명 전원 comp/func 재태깅 + `COMP_LABEL_KO`/`FUNC_LABEL_KO`
3. ✅ `scoring.ts` `comboPenalty` 재작성 — comp 응집(탱 컨셉 미스매치 멤버당 `compMismatch`) + func within-role(`noAnchorDps`/`noMainHeal`/힐러 편중). 기존 "탱-딜 불일치/딜러 동일유형" 흡수
4. ✅ `team-builder.ts` `ownedSubRoles` → `comps`/`funcs`
5. ✅ `scoring.test.ts` 신규 8케이스 (전체 32/32 통과)

> **남은 튜닝(선택)**: `COMBO_PENALTY` 수치(`compMismatch` 150 등)는 실사용 보며 조정. 시너지 가점은 끈 상태 유지.
