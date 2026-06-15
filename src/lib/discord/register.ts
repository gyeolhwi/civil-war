// 디스코드 `/내전-프로필` — 오버워치 내전 프로필 등록/수정 (서버리스 / HTTP 인터랙션).
//
// 흐름 (모든 응답은 인터랙션 HTTP 응답, 추가 REST 호출 없음):
//   /내전-프로필 ─APPLICATION_COMMAND→ (기존 계정) 메인 화면 / (신규) 배틀태그 모달
//   메인 화면: 닉네임·배틀태그·현황 요약 + 주 포지션 셀렉트 + 부 포지션 셀렉트
//             + [티어·등급][영웅][맵][배틀태그][완료] + [🌐 웹에서 설정하기]
//             · 포지션은 셀렉트 1개씩(placeholder=라벨). "선택 안 함"으로 해제, 주≠부 강제.
//   [티어·등급]/[영웅]/[맵] → 같은 메시지가 해당 화면으로 전환(UPDATE_MESSAGE), [↩️뒤로]
//     · 티어·등급 화면: 고른 주/부 포지션의 티어·등급만(역할 탭/토글 없음). 역할 최대 2개라
//       2×(티어+등급)=4셀렉트+뒤로=5행으로 한 화면에 다 들어감. 포지션 미선택이면 안내.
//
// 누구나(권한 무관) 본인 프로필을 등록/수정. 채널은 guild_id → channels.discord_guild_id.
// 멤버는 discord_user_id 로 식별 → 재실행 시 본인 행을 찾아 수정.
//
// ⚠️ 모달 안 셀렉트(Label)는 이 환경에서 거부돼 "응답 없음"이 나므로 쓰지 않는다.
//    자유 텍스트(배틀태그)만 모달, 나머지 선택값은 메시지 셀렉트로 받는다.
// 웹 멤버폼과 표기 통일: 역할=돌격/공격/지원, 등급="N티어", 맵=모드별.

import { ROLE_LABEL_KO } from "@/constants/heroes";
import { MODE_LABEL_KO } from "@/constants/maps";
import { TIER_LABEL_KO, TIER_ORDER } from "@/constants/tiers";
import type { Division, GameMode, RefData, Role, Tier } from "@/domain/types";
import {
  ensureChannelMembership,
  replaceHeroPrefs,
  replaceMapPrefs,
  upsertMemberCore,
  upsertRoleRating,
} from "@/lib/member-write";
import { getRefData } from "@/lib/ref-data";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Discord enum (공식 문서) ──────────────────────────────────────────────
const CallbackType = {
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  UPDATE_MESSAGE: 7,
  MODAL: 9,
} as const;
const ComponentType = {
  ACTION_ROW: 1,
  BUTTON: 2,
  STRING_SELECT: 3,
  TEXT_INPUT: 4,
} as const;
const ButtonStyle = { PRIMARY: 1, SECONDARY: 2, SUCCESS: 3, LINK: 5 } as const;
const TextInputStyle = { SHORT: 1 } as const;
const InteractionType = {
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  MODAL_SUBMIT: 5,
} as const;
const EPHEMERAL = 64;

const ROLES: Role[] = ["tank", "dps", "support"];
const MODE_ORDER: GameMode[] = [
  "control",
  "escort",
  "hybrid",
  "push",
  "flashpoint",
  "clash",
];
const MODE_EMOJI: Record<string, string> = {
  control: "🟦",
  escort: "🚚",
  hybrid: "🔀",
  push: "🤖",
  flashpoint: "⚡",
  clash: "⚔️",
};
const MAX_HEROES = 5;
const SELECT_OPTION_CAP = 25; // 셀렉트 1개당 옵션 상한
const MAX_MAP_SELECTS = 4; // 맵 화면: 셀렉트 4 + 뒤로 1 = 5행
const DEFAULT_DIVISION: Division = 3;

// 배틀태그: 이름#1234 (members/schema.ts 와 동일 규칙)
const BATTLE_TAG_RE = /^.+#\d{3,}$/u;

// 웹 멤버폼 링크용 베이스 URL. 인터랙션 요청 헤더(호스트)에서 받아 채운다.
// 이 배포로 오는 요청은 모두 같은 도메인이라 모듈 변수로 둬도 안전하다.
let webBaseUrl: string | undefined;

// ── 인터랙션 타입 (필요한 필드만) ─────────────────────────────────────────
interface Interaction {
  type: number;
  guild_id?: string;
  member?: { user?: DiscordUser; permissions?: string };
  user?: DiscordUser;
  data?: {
    name?: string;
    custom_id?: string;
    values?: string[];
    components?: unknown;
  };
}
interface DiscordUser {
  id?: string;
  username?: string;
  global_name?: string | null;
}

function getUser(i: Interaction): DiscordUser | undefined {
  return i.member?.user ?? i.user;
}
function getDiscordName(u: DiscordUser | undefined): string | null {
  return u?.global_name?.trim() || u?.username?.trim() || null;
}

function ephemeral(content: string) {
  return {
    type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, flags: EPHEMERAL },
  };
}

/** 디스코드 3초 한도 안에 끝나도록, 느린 작업에 타임아웃을 건다. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label}이(가) ${ms}ms 안에 끝나지 않았어요`)),
        ms,
      ),
    ),
  ]);
}

// ── 채널·멤버 해석 ─────────────────────────────────────────────────────────
type Sb = ReturnType<typeof createAdminClient>;

/** guild_id → 내전 그룹(채널). 미연결이고 그룹이 정확히 1개면 자동 연결. */
async function resolveChannelId(
  sb: Sb,
  guildId: string | undefined,
): Promise<string | null> {
  if (!guildId) return null;
  const { data } = await sb
    .from("channels")
    .select("id")
    .eq("discord_guild_id", guildId)
    .maybeSingle();
  if (data) return data.id as string;

  const { data: all } = await sb.from("channels").select("id").limit(2);
  if (all && all.length === 1) {
    await sb
      .from("channels")
      .update({ discord_guild_id: guildId })
      .eq("id", all[0].id);
    return all[0].id as string;
  }
  return null;
}

async function resolveMemberId(
  sb: Sb,
  discordUserId: string,
): Promise<string | null> {
  const { data } = await sb
    .from("members")
    .select("id")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();
  return data?.id ?? null;
}

type RoleRating = { tier: Tier; division: Division };

interface Profile {
  battleTag: string;
  discordName: string | null;
  primaryRole: Role | null;
  secondaryRole: Role | null;
  ratings: Partial<Record<Role, RoleRating>>; // 역할별 티어·등급
  heroCodes: string[];
  mapCodes: string[];
}

/** 프리필/요약용 기존 값 로드 (멤버 없으면 null). */
async function loadProfile(
  sb: Sb,
  channelId: string,
  memberId: string,
): Promise<Profile | null> {
  const [m, cm, ratings, heroes, maps] = await Promise.all([
    sb
      .from("members")
      .select("battle_tag, discord_name")
      .eq("id", memberId)
      .maybeSingle(),
    sb
      .from("channel_members")
      .select("primary_role,secondary_role")
      .match({ channel_id: channelId, member_id: memberId })
      .maybeSingle(),
    sb
      .from("member_role_ratings")
      .select("role,tier,division")
      .match({ channel_id: channelId, member_id: memberId }),
    sb
      .from("member_hero_preferences")
      .select("hero_code")
      .match({ channel_id: channelId, member_id: memberId }),
    sb
      .from("member_map_preferences")
      .select("map_code")
      .match({ channel_id: channelId, member_id: memberId }),
  ]);
  if (!m.data) return null;
  const ratingMap: Partial<Record<Role, RoleRating>> = {};
  for (const r of ratings.data ?? []) {
    ratingMap[r.role as Role] = {
      tier: r.tier as Tier,
      division: r.division as Division,
    };
  }
  return {
    battleTag: m.data.battle_tag as string,
    discordName: (m.data.discord_name ?? null) as string | null,
    primaryRole: (cm.data?.primary_role ?? null) as Role | null,
    secondaryRole: (cm.data?.secondary_role ?? null) as Role | null,
    ratings: ratingMap,
    heroCodes: (heroes.data ?? []).map((h) => h.hero_code as string),
    mapCodes: (maps.data ?? []).map((mm) => mm.map_code as string),
  };
}

// ── 컴포넌트 빌더 ──────────────────────────────────────────────────────────
type Option = { label: string; value: string; default?: boolean };

function selectRow(
  customId: string,
  placeholder: string,
  options: Option[],
  min: number,
  max: number,
) {
  return {
    type: ComponentType.ACTION_ROW,
    components: [
      {
        type: ComponentType.STRING_SELECT,
        custom_id: customId,
        placeholder,
        min_values: min,
        max_values: Math.min(max, options.length || 1),
        options,
      },
    ],
  };
}

function button(style: number, label: string, emoji: string, customId: string) {
  const b: Record<string, unknown> = {
    type: ComponentType.BUTTON,
    style,
    label,
    custom_id: customId,
  };
  if (emoji) b.emoji = { name: emoji };
  return b;
}

/** 하위 화면(티어/영웅/맵)에서 메인 프로필로 돌아가는 버튼 행. */
function backRow() {
  return {
    type: ComponentType.ACTION_ROW,
    components: [button(ButtonStyle.SECONDARY, "뒤로", "↩️", "reg:back")],
  };
}

/** 메인 화면의 포지션 셀렉트. slot=P(주)/S(부). placeholder 에 "주/부 포지션 ·
 *  현재: X" 를 항상 띄워 글 안내 없이도 무엇을 고르는지 자명하게 한다.
 *  옵션에 "선택 안 함"을 넣어 해제 가능. 주≠부는 핸들러에서 강제. */
function posSelect(slot: "P" | "S", selected: Role | null) {
  const opts: Option[] = [
    { label: "선택 안 함", value: "none" },
    ...ROLES.map((r) => ({ label: ROLE_LABEL_KO[r], value: r })),
  ];
  const cur = selected ? ROLE_LABEL_KO[selected] : "없음";
  const label = slot === "P" ? "주 포지션" : "부 포지션";
  return selectRow(`reg:pos_${slot}`, `${label} · 현재: ${cur}`, opts, 1, 1);
}

/** 역할별 티어·등급 가로 요약 ("탱커 : 마스터 4티어 (주)" 줄 나열). 미기재는 "—". */
function tierLines(p: Profile): string {
  return ROLES.map((r) => {
    const x = p.ratings[r];
    const tag =
      p.primaryRole === r ? " (주)" : p.secondaryRole === r ? " (부)" : "";
    const rating = x ? `${TIER_LABEL_KO[x.tier]} ${x.division}티어` : "—";
    return `${ROLE_LABEL_KO[r]} : ${rating}${tag}`;
  }).join("\n");
}
function tierOptions(selected: Tier | null): Option[] {
  return TIER_ORDER.map((t) => ({
    label: TIER_LABEL_KO[t],
    value: t,
    default: selected === t,
  }));
}
function divisionOptions(selected: Division | null): Option[] {
  return ([5, 4, 3, 2, 1] as Division[]).map((d) => ({
    label: `${d}티어`,
    value: String(d),
    default: selected === d,
  }));
}

/** 배틀태그 입력 모달 (클래식 ActionRow + TextInput). */
function basicModal(existing: Profile | null) {
  const textInput: Record<string, unknown> = {
    type: ComponentType.TEXT_INPUT,
    custom_id: "battle_tag",
    label: "배틀태그 (예: 홍길동#1234)",
    style: TextInputStyle.SHORT,
    required: true,
    min_length: 3,
    max_length: 30,
    placeholder: "이름#숫자",
  };
  if (existing?.battleTag) textInput.value = existing.battleTag;
  return {
    type: CallbackType.MODAL,
    data: {
      custom_id: "reg:basic",
      title: "오버워치 - 내전 프로필 등록/수정",
      components: [{ type: ComponentType.ACTION_ROW, components: [textInput] }],
    },
  };
}

function profileSummary(p: Profile, note?: string): string {
  const lines = [
    "🎮 **내전 프로필**",
    `· 닉네임: ${p.discordName ?? "—"}   · 배틀태그: ${p.battleTag}`,
    tierLines(p)
      .split("\n")
      .map((l) => `· ${l}`)
      .join("\n"),
    `· 선호 영웅 ${p.heroCodes.length}개   · 선호 맵 ${p.mapCodes.length}개`,
  ];
  if (note) lines.push(`\n${note}`);
  return lines.join("\n");
}

/** 링크(URL) 버튼 — custom_id 가 아니라 url 로 외부 페이지를 연다(style 5). */
function linkButton(label: string, emoji: string, url: string) {
  const b: Record<string, unknown> = {
    type: ComponentType.BUTTON,
    style: ButtonStyle.LINK,
    label,
    url,
  };
  if (emoji) b.emoji = { name: emoji };
  return b;
}

/** 메인 프로필 화면 — 닉네임·배틀태그·현황 요약 + 주/부 포지션 버튼 + 작성 버튼 + 웹 링크. */
function profileResponse(callbackType: number, p: Profile, note?: string) {
  const rows: object[] = [
    posSelect("P", p.primaryRole),
    posSelect("S", p.secondaryRole),
    {
      type: ComponentType.ACTION_ROW,
      components: [
        button(ButtonStyle.PRIMARY, "티어 · 등급", "🏅", "reg:open_tier"),
        button(ButtonStyle.PRIMARY, "선호 영웅", "⭐", "reg:open_heroes"),
        button(ButtonStyle.PRIMARY, "선호 맵", "🗺️", "reg:open_maps"),
        button(ButtonStyle.SECONDARY, "배틀태그", "✏️", "reg:edit_tag"),
        button(ButtonStyle.SUCCESS, "완료", "✅", "reg:done"),
      ],
    },
  ];
  if (webBaseUrl) {
    rows.push({
      type: ComponentType.ACTION_ROW,
      components: [
        linkButton("웹에서 설정하기", "🌐", `${webBaseUrl}/app/members`),
      ],
    });
  }
  return {
    type: callbackType,
    data: {
      content: profileSummary(p, note),
      flags: EPHEMERAL,
      components: rows,
    },
  };
}

/** 티어/등급 화면 하단 네비 — [뒤로] + [등급 보기]/[티어 보기] 토글. */
/** 주/부로 고른 역할만 (중복 제거, 순서 주→부). */
function playedRoles(p: Profile): Role[] {
  const out: Role[] = [];
  for (const r of [p.primaryRole, p.secondaryRole]) {
    if (r && !out.includes(r)) out.push(r);
  }
  return out;
}

/**
 * 티어·등급 화면 — 고른 주/부 포지션의 티어·등급만 한 화면에(토글·탭 없음).
 * 역할이 최대 2개라 2×(티어+등급)=4셀렉트 + 뒤로 = 5행으로 한 화면에 다 들어간다.
 */
function tierResponse(callbackType: number, p: Profile, note?: string) {
  const roles = playedRoles(p);
  if (!roles.length) {
    return {
      type: callbackType,
      data: {
        content:
          "🏅 **티어 · 등급**\n먼저 메인에서 주/부 포지션을 고르면, 그 포지션의 티어·등급을 여기서 정해요.",
        flags: EPHEMERAL,
        components: [backRow()],
      },
    };
  }
  const rows = roles.flatMap((r) => [
    selectRow(
      `reg:tier_${r}`,
      `${ROLE_LABEL_KO[r]} 티어`,
      tierOptions(p.ratings[r]?.tier ?? null),
      0,
      1,
    ),
    selectRow(
      `reg:div_${r}`,
      `${ROLE_LABEL_KO[r]} 등급`,
      divisionOptions(p.ratings[r]?.division ?? null),
      0,
      1,
    ),
  ]);
  const head = ["🏅 **티어 · 등급**", tierLines(p)].join("\n");
  return {
    type: callbackType,
    data: {
      content: `${head}${note ? `\n${note}` : ""}`,
      flags: EPHEMERAL,
      components: [...rows, backRow()],
    },
  };
}

function heroResponse(
  callbackType: number,
  p: Profile,
  ref: RefData,
  note?: string,
) {
  const selected = new Set(p.heroCodes);
  const rows = ROLES.map((role) => {
    const opts: Option[] = ref.heroesByRole[role]
      .filter((h) => h.isActive)
      .slice(0, SELECT_OPTION_CAP)
      .map((h) => ({
        label: h.nameKo,
        value: h.code,
        default: selected.has(h.code),
      }));
    return selectRow(
      `reg:hero_${role}`,
      `${ROLE_LABEL_KO[role]} 영웅`,
      opts,
      0,
      MAX_HEROES,
    );
  });
  return {
    type: callbackType,
    data: {
      content: `⭐ 선호 영웅 — 포지션과 무관하게 **전부 합쳐 최대 ${MAX_HEROES}개**만 저장돼요. (현재 ${p.heroCodes.length}/${MAX_HEROES})${note ? `\n${note}` : ""}`,
      flags: EPHEMERAL,
      components: [...rows, backRow()],
    },
  };
}

/** 활성 맵을 모드별 셀렉트로 묶는다. 모드 수가 한도(4)를 넘으면 작은 모드부터 합침. */
function mapGroups(ref: RefData): {
  codes: { code: string; nameKo: string; mode: GameMode }[];
  modes: GameMode[];
}[] {
  const bins = MODE_ORDER.map((mode) => ({
    modes: [mode] as GameMode[],
    codes: ref.maps
      .filter((m) => m.isActive && m.mode === mode)
      .map((m) => ({ code: m.code, nameKo: m.nameKo, mode: m.mode })),
  })).filter((b) => b.codes.length > 0);

  while (bins.length > MAX_MAP_SELECTS) {
    let smallest = 0;
    for (let i = 1; i < bins.length; i++) {
      if (bins[i].codes.length < bins[smallest].codes.length) smallest = i;
    }
    const target = smallest > 0 ? smallest - 1 : smallest + 1;
    const [from, to] =
      target < smallest ? [smallest, target] : [target, smallest];
    bins[to].codes.push(...bins[from].codes);
    bins[to].modes.push(...bins[from].modes);
    bins.splice(from, 1);
  }
  return bins;
}

function mapResponse(callbackType: number, p: Profile, ref: RefData) {
  const selected = new Set(p.mapCodes);
  const rows = mapGroups(ref).map((g, n) =>
    selectRow(
      `reg:map_${n}`,
      `${g.modes.map((m) => MODE_LABEL_KO[m]).join("·")} 맵`,
      g.codes.map((m) => ({
        label: `${MODE_EMOJI[m.mode] ?? ""} ${m.nameKo}`.trim(),
        value: m.code,
        default: selected.has(m.code),
      })),
      0,
      g.codes.length,
    ),
  );
  return {
    type: callbackType,
    data: {
      content: `🗺️ 선호 맵을 고르세요 — 여러 개 선택할 수 있어요. (현재 ${p.mapCodes.length}개)`,
      flags: EPHEMERAL,
      components: [...rows, backRow()],
    },
  };
}

// ── 모달 제출 값 파싱 ──────────────────────────────────────────────────────
type Submitted = Record<string, { value?: string; values?: string[] }>;

function collectSubmitted(root: unknown): Submitted {
  const out: Submitted = {};
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const n of node) walk(n);
      return;
    }
    if (node && typeof node === "object") {
      const o = node as Record<string, unknown>;
      if (typeof o.custom_id === "string" && ("value" in o || "values" in o)) {
        out[o.custom_id] = {
          value: typeof o.value === "string" ? o.value : undefined,
          values: Array.isArray(o.values) ? (o.values as string[]) : undefined,
        };
      }
      if (o.component) walk(o.component);
      if (o.components) walk(o.components);
    }
  };
  walk(root);
  return out;
}

function firstValue(sub: Submitted, key: string): string | undefined {
  const v = sub[key];
  if (!v) return undefined;
  if (v.values?.length) return v.values[0];
  return v.value || undefined;
}

// ── 핸들러 ─────────────────────────────────────────────────────────────────
/**
 * `/내전-프로필` 관련 인터랙션 처리. 반환값은 인터랙션 응답 body.
 * 예외·지연은 타임아웃("응답 없음") 대신 ephemeral 에러로 노출한다.
 */
export async function handleRegister(
  interaction: Interaction,
  baseUrl?: string,
): Promise<object> {
  if (baseUrl) webBaseUrl = baseUrl;
  try {
    return await withTimeout(handleRegisterInner(interaction), 2500, "처리");
  } catch (e) {
    return ephemeral(
      `등록 처리 중 오류: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

async function handleRegisterInner(interaction: Interaction): Promise<object> {
  const user = getUser(interaction);
  const discordUserId = user?.id;
  if (!discordUserId)
    return ephemeral("디스코드 사용자 정보를 찾을 수 없어요.");

  const sb = createAdminClient();
  const [channelId, memberId] = await Promise.all([
    resolveChannelId(sb, interaction.guild_id),
    resolveMemberId(sb, discordUserId),
  ]);
  if (!channelId) {
    return ephemeral(
      "이 서버는 아직 내전 채널과 연결되지 않았어요. 채널 관리자에게 문의해주세요.",
    );
  }

  // 슬래시: 이미 등록된 계정이면 곧장 수정 화면, 신규면 배틀태그 모달.
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    if (memberId) {
      await ensureChannelMembership(sb, channelId, memberId);
      const p = await loadProfile(sb, channelId, memberId);
      if (p)
        return profileResponse(CallbackType.CHANNEL_MESSAGE_WITH_SOURCE, p);
    }
    return basicModal(null);
  }

  if (interaction.type === InteractionType.MODAL_SUBMIT) {
    return handleModalSubmit(sb, channelId, discordUserId, user, interaction);
  }

  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    if (!memberId) return ephemeral("먼저 등록을 시작해주세요.");
    return handleComponent(sb, channelId, memberId, interaction);
  }

  return ephemeral("처리할 수 없는 요청이에요.");
}

async function handleModalSubmit(
  sb: Sb,
  channelId: string,
  discordUserId: string,
  user: DiscordUser | undefined,
  interaction: Interaction,
): Promise<object> {
  if (interaction.data?.custom_id !== "reg:basic") {
    return ephemeral("알 수 없는 양식이에요.");
  }
  const sub = collectSubmitted(interaction.data?.components);
  const battleTag = (firstValue(sub, "battle_tag") ?? "").trim();
  if (!BATTLE_TAG_RE.test(battleTag)) {
    return ephemeral("배틀태그는 이름#숫자 형식이어야 해요 (예: 홍길동#1234).");
  }

  const core = await upsertMemberCore(sb, {
    battleTag,
    discordName: getDiscordName(user),
    discordUserId,
  });
  if (!core.ok) return ephemeral(`저장 실패: ${core.error}`);

  const ensured = await ensureChannelMembership(sb, channelId, core.memberId);
  if (!ensured.ok) return ephemeral(`저장 실패: ${ensured.error}`);

  const profile = await loadProfile(sb, channelId, core.memberId);
  if (!profile) return ephemeral("저장 실패: 프로필을 불러오지 못했어요.");
  return profileResponse(CallbackType.CHANNEL_MESSAGE_WITH_SOURCE, profile);
}

async function handleComponent(
  sb: Sb,
  channelId: string,
  memberId: string,
  interaction: Interaction,
): Promise<object> {
  const cid = interaction.data?.custom_id ?? "";
  const values = interaction.data?.values ?? [];

  if (cid === "reg:done") {
    return ephemeral(
      "🎉 내전 프로필 저장 완료! 웹에서 더 자세히 수정할 수 있어요.",
    );
  }

  // 배틀태그 수정 → 프리필된 모달 (버튼 → 모달 허용)
  if (cid === "reg:edit_tag") {
    const p = await loadProfile(sb, channelId, memberId);
    return basicModal(p);
  }

  // 뒤로 → 메인 프로필 (같은 메시지 갱신)
  if (cid === "reg:back") {
    const p = await loadProfile(sb, channelId, memberId);
    if (!p) return ephemeral("프로필을 불러오지 못했어요.");
    return profileResponse(CallbackType.UPDATE_MESSAGE, p);
  }

  // 메인 화면 주/부 포지션 셀렉트 — "선택 안 함"이면 해제. 주≠부 강제.
  // reg:pos_P|reg:pos_S, 값 = none|tank|dps|support.
  if (cid === "reg:pos_P" || cid === "reg:pos_S") {
    const slot = cid === "reg:pos_P" ? "P" : "S";
    const role = asRole(values[0]); // "none" → null
    const p = await loadProfile(sb, channelId, memberId);
    if (!p) return ephemeral("프로필을 불러오지 못했어요.");
    const patch: { primary_role?: Role | null; secondary_role?: Role | null } =
      {};
    if (slot === "P") {
      patch.primary_role = role;
      if (role && p.secondaryRole === role) patch.secondary_role = null;
    } else {
      patch.secondary_role = role;
      if (role && p.primaryRole === role) patch.primary_role = null;
    }
    await sb
      .from("channel_members")
      .update(patch)
      .match({ channel_id: channelId, member_id: memberId });
    if (patch.primary_role !== undefined) p.primaryRole = patch.primary_role;
    if (patch.secondary_role !== undefined)
      p.secondaryRole = patch.secondary_role;
    return profileResponse(CallbackType.UPDATE_MESSAGE, p);
  }

  // 티어·등급 화면 (고른 주/부 포지션만 한 화면)
  if (cid === "reg:open_tier") {
    const p = await loadProfile(sb, channelId, memberId);
    if (!p) return ephemeral("프로필을 불러오지 못했어요.");
    return tierResponse(CallbackType.UPDATE_MESSAGE, p);
  }

  // 역할별 티어 — 등급(디비전)은 기존값 또는 기본값
  if (cid.startsWith("reg:tier_")) {
    const role = asRole(cid.slice("reg:tier_".length));
    const tier = asTier(values[0]);
    const p = await loadProfile(sb, channelId, memberId);
    if (!p || !role) return ephemeral("프로필을 불러오지 못했어요.");
    if (tier) {
      const division = p.ratings[role]?.division ?? DEFAULT_DIVISION;
      const rr = await upsertRoleRating(
        sb,
        channelId,
        memberId,
        role,
        tier,
        division,
      );
      if (!rr.ok) return ephemeral(`저장 실패: ${rr.error}`);
      p.ratings[role] = { tier, division };
    }
    return tierResponse(CallbackType.UPDATE_MESSAGE, p);
  }

  // 역할별 등급(디비전) — 그 역할 티어가 먼저 있어야 함
  if (cid.startsWith("reg:div_")) {
    const role = asRole(cid.slice("reg:div_".length));
    const division = asDivision(values[0]);
    const p = await loadProfile(sb, channelId, memberId);
    if (!p || !role) return ephemeral("프로필을 불러오지 못했어요.");
    const curTier = p.ratings[role]?.tier;
    if (division && curTier) {
      const rr = await upsertRoleRating(
        sb,
        channelId,
        memberId,
        role,
        curTier,
        division,
      );
      if (!rr.ok) return ephemeral(`저장 실패: ${rr.error}`);
      p.ratings[role] = { tier: curTier, division };
      return tierResponse(CallbackType.UPDATE_MESSAGE, p);
    }
    return tierResponse(
      CallbackType.UPDATE_MESSAGE,
      p,
      "⚠️ 먼저 그 역할의 티어를 선택해주세요.",
    );
  }

  // 영웅/맵 화면 열기 (같은 메시지 전환)
  if (cid === "reg:open_heroes" || cid === "reg:open_maps") {
    const [ref, p] = await Promise.all([
      getRefData(),
      loadProfile(sb, channelId, memberId),
    ]);
    if (!p) return ephemeral("프로필을 불러오지 못했어요.");
    return cid === "reg:open_heroes"
      ? heroResponse(CallbackType.UPDATE_MESSAGE, p, ref)
      : mapResponse(CallbackType.UPDATE_MESSAGE, p, ref);
  }

  if (cid.startsWith("reg:hero_")) {
    const role = asRole(cid.slice("reg:hero_".length));
    const [ref, p] = await Promise.all([
      getRefData(),
      loadProfile(sb, channelId, memberId),
    ]);
    if (!p || !role) return ephemeral("프로필을 불러오지 못했어요.");
    // 이 역할의 기존 선택을 빼고 새 선택으로 교체. 합쳐 5개 초과면 방금 고른 것 우선으로 잘라 저장.
    const others = p.heroCodes.filter((c) => ref.heroByCode[c]?.role !== role);
    let next = [...values, ...others];
    let note: string | undefined;
    if (next.length > MAX_HEROES) {
      next = next.slice(0, MAX_HEROES);
      note = `⚠️ 합쳐 ${MAX_HEROES}개까지만 저장돼요. 다른 역할 일부는 제외했어요.`;
    }
    const r = await replaceHeroPrefs(sb, channelId, memberId, next);
    if (!r.ok) return ephemeral(`저장 실패: ${r.error}`);
    p.heroCodes = next;
    return heroResponse(CallbackType.UPDATE_MESSAGE, p, ref, note);
  }

  if (cid.startsWith("reg:map_")) {
    const n = Number(cid.slice("reg:map_".length));
    const [ref, p] = await Promise.all([
      getRefData(),
      loadProfile(sb, channelId, memberId),
    ]);
    if (!p || !Number.isInteger(n)) {
      return ephemeral("프로필을 불러오지 못했어요.");
    }
    const chunkCodes = (mapGroups(ref)[n]?.codes ?? []).map((m) => m.code);
    const kept = p.mapCodes.filter((c) => !chunkCodes.includes(c));
    const next = [...kept, ...values];
    const r = await replaceMapPrefs(sb, channelId, memberId, next);
    if (!r.ok) return ephemeral(`저장 실패: ${r.error}`);
    p.mapCodes = next;
    return mapResponse(CallbackType.UPDATE_MESSAGE, p, ref);
  }

  return ephemeral("알 수 없는 동작이에요.");
}

// ── 값 변환 가드 ───────────────────────────────────────────────────────────
function asRole(v: string | undefined): Role | null {
  return v === "tank" || v === "dps" || v === "support" ? v : null;
}
function asTier(v: string | undefined): Tier | null {
  return v && (TIER_ORDER as string[]).includes(v) ? (v as Tier) : null;
}
function asDivision(v: string | undefined): Division | null {
  const n = Number(v);
  return n >= 1 && n <= 5 ? (n as Division) : null;
}
