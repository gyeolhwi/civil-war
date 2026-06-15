// 디스코드 `/내전-프로필` — 오버워치 내전 프로필 등록/수정 (서버리스 / HTTP 인터랙션).
//
// 흐름:
//   /내전-프로필 → [설문 모달] 배틀태그 + 주/부 포지션 + 주/부 티어 (한 번에 제출)
//     · 제출 시 검증(주≠부) + 저장 → 요약 메시지 + [등급][영웅][맵][수정][완료] 버튼
//   [등급]/[영웅]/[맵] → 같은 메시지가 해당 화면으로 전환(UPDATE_MESSAGE), [↩️뒤로]로 복귀
//   [수정] → 설문 모달 다시 (현재 값 프리필)
//
// 설문 모달은 한 번 제출이라 클릭마다 로딩이 없고, 모든 항목이 한눈에 보인다.
// ⚠️ 모달 안 셀렉트(Label, type 18)는 required 기본값이 true다. 선택형(min_values:0)
//    으로 쓰려면 required:false 를 반드시 줘야 한다(안 주면 모순 → 모달 거부).
// 누구나(권한 무관) 본인 프로필을 등록/수정. 채널은 guild_id → channels.discord_guild_id.
// 웹 멤버폼과 표기 통일: 역할=돌격/공격/지원, 등급="N티어", 맵=모드별.

import { ROLE_LABEL_KO } from "@/constants/heroes";
import { MODE_LABEL_KO } from "@/constants/maps";
import { TIER_LABEL_KO, TIER_ORDER } from "@/constants/tiers";
import type { Division, GameMode, RefData, Role, Tier } from "@/domain/types";
import {
  replaceHeroPrefs,
  replaceMapPrefs,
  upsertChannelMembership,
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
  LABEL: 18, // 모달에서 텍스트/셀렉트를 감싸는 컨테이너 (2025+ 표준)
} as const;
const ButtonStyle = { PRIMARY: 1, SECONDARY: 2, SUCCESS: 3 } as const;
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
const SELECT_OPTION_CAP = 25;
const MAX_MAP_SELECTS = 4;
const DEFAULT_DIVISION: Division = 3;

const BATTLE_TAG_RE = /^.+#\d{3,}$/u;

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
  primaryRole: Role | null;
  secondaryRole: Role | null;
  ratings: Partial<Record<Role, RoleRating>>;
  heroCodes: string[];
  mapCodes: string[];
}

async function loadProfile(
  sb: Sb,
  channelId: string,
  memberId: string,
): Promise<Profile | null> {
  const [m, cm, ratings, heroes, maps] = await Promise.all([
    sb.from("members").select("battle_tag").eq("id", memberId).maybeSingle(),
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

function backRow() {
  return {
    type: ComponentType.ACTION_ROW,
    components: [button(ButtonStyle.SECONDARY, "뒤로", "↩️", "reg:back")],
  };
}

function roleOptions(selected: Role | null): Option[] {
  return ROLES.map((r) => ({
    label: ROLE_LABEL_KO[r],
    value: r,
    default: selected === r,
  }));
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

/** 역할별 티어·등급 가로 요약 ("탱커 : 마스터 4티어"). */
function tierLines(p: Profile): string {
  return ROLES.map((r) => {
    const x = p.ratings[r];
    return `${ROLE_LABEL_KO[r]} : ${x ? `${TIER_LABEL_KO[x.tier]} ${x.division}티어` : "—"}`;
  }).join("\n");
}

// ── 설문 모달 (배틀태그 + 주/부 포지션 + 주/부 티어) ──────────────────────
/** 모달용 Label 래퍼. 셀렉트/텍스트입력을 감싼다. */
function label(text: string, component: object) {
  return { type: ComponentType.LABEL, label: text, component };
}
function modalSelect(customId: string, options: Option[], placeholder: string) {
  return {
    type: ComponentType.STRING_SELECT,
    custom_id: customId,
    placeholder,
    // 모달 셀렉트의 required 기본값은 true이고, required가 true면 min_values는
    // 1 이상이어야 한다. 선택(포지션·티어)이라 min_values:0 → required:false 필수.
    // (이걸 빼면 모순 페이로드라 Discord가 모달을 거부 → "응답하지 않았어요".)
    required: false,
    min_values: 0,
    max_values: 1,
    options,
  };
}

function surveyModal(existing: Profile | null) {
  const battle: Record<string, unknown> = {
    type: ComponentType.TEXT_INPUT,
    custom_id: "battle_tag",
    style: TextInputStyle.SHORT,
    required: true,
    min_length: 3,
    max_length: 30,
    placeholder: "이름#숫자",
  };
  if (existing?.battleTag) battle.value = existing.battleTag; // 빈 value 금지

  const pTier = existing?.primaryRole
    ? (existing.ratings[existing.primaryRole]?.tier ?? null)
    : null;
  const sTier = existing?.secondaryRole
    ? (existing.ratings[existing.secondaryRole]?.tier ?? null)
    : null;

  return {
    type: CallbackType.MODAL,
    data: {
      custom_id: "reg:survey",
      title: "오버워치 - 내전 프로필",
      components: [
        label("배틀태그 (예: 홍길동#1234)", battle),
        label(
          "주 포지션",
          modalSelect(
            "primary_role",
            roleOptions(existing?.primaryRole ?? null),
            "안 골라도 됨",
          ),
        ),
        label(
          "부 포지션 (주와 다르게)",
          modalSelect(
            "secondary_role",
            roleOptions(existing?.secondaryRole ?? null),
            "안 골라도 됨",
          ),
        ),
        label(
          "주 포지션 티어",
          modalSelect("primary_tier", tierOptions(pTier), "티어 (선택)"),
        ),
        label(
          "부 포지션 티어",
          modalSelect("secondary_tier", tierOptions(sTier), "티어 (선택)"),
        ),
      ],
    },
  };
}

// ── 요약 메시지 (제출 후 / 뒤로) ──────────────────────────────────────────
function profileSummary(p: Profile, note?: string): string {
  const pos = (r: Role | null) => (r ? ROLE_LABEL_KO[r] : "—");
  const lines = [
    `✅ **${p.battleTag}** 내전 프로필`,
    `· 주 포지션: ${pos(p.primaryRole)}   · 부 포지션: ${pos(p.secondaryRole)}`,
    "· 티어",
    tierLines(p)
      .split("\n")
      .map((l) => `   ${l}`)
      .join("\n"),
    `· 선호 영웅 ${p.heroCodes.length}개   · 선호 맵 ${p.mapCodes.length}개`,
    "수정하려면 [수정], 등급·영웅·맵은 각 버튼에서.",
  ];
  if (note) lines.push(`\n${note}`);
  return lines.join("\n");
}

function profileResponse(callbackType: number, p: Profile, note?: string) {
  return {
    type: callbackType,
    data: {
      content: profileSummary(p, note),
      flags: EPHEMERAL,
      components: [
        {
          type: ComponentType.ACTION_ROW,
          components: [
            button(ButtonStyle.PRIMARY, "등급", "🎚️", "reg:open_div"),
            button(ButtonStyle.PRIMARY, "선호 영웅", "⭐", "reg:open_heroes"),
            button(ButtonStyle.PRIMARY, "선호 맵", "🗺️", "reg:open_maps"),
            button(ButtonStyle.SECONDARY, "수정", "✏️", "reg:edit"),
            button(ButtonStyle.SUCCESS, "완료", "✅", "reg:done"),
          ],
        },
      ],
    },
  };
}

/** 등급(디비전) 화면 — 티어가 입력된 포지션별 등급 셀렉트. */
function divResponse(callbackType: number, p: Profile, note?: string) {
  const roles = ROLES.filter((r) => p.ratings[r]);
  if (!roles.length) {
    return {
      type: callbackType,
      data: {
        content:
          "먼저 [수정]에서 포지션과 티어를 입력해주세요. 그다음 등급을 정할 수 있어요.",
        flags: EPHEMERAL,
        components: [backRow()],
      },
    };
  }
  const rows = roles.map((r) =>
    selectRow(
      `reg:div_${r}`,
      `${ROLE_LABEL_KO[r]} 등급(디비전)`,
      divisionOptions(p.ratings[r]?.division ?? null),
      0,
      1,
    ),
  );
  return {
    type: callbackType,
    data: {
      content: `🎚️ 포지션별 등급(디비전)을 골라주세요.\n${tierLines(p)}${note ? `\n${note}` : ""}`,
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
      content: `🗺️ 선호 맵 — 모드별로 고르세요. (현재 ${p.mapCodes.length}개)`,
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
export async function handleRegister(
  interaction: Interaction,
): Promise<object> {
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

  // 슬래시 → 설문 모달 (기존 계정이면 현재 값 프리필).
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const existing = memberId
      ? await loadProfile(sb, channelId, memberId)
      : null;
    return surveyModal(existing);
  }

  if (interaction.type === InteractionType.MODAL_SUBMIT) {
    return handleSurveySubmit(sb, channelId, discordUserId, user, interaction);
  }

  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    if (!memberId)
      return ephemeral("먼저 `/내전-프로필` 로 등록을 시작해주세요.");
    return handleComponent(sb, channelId, memberId, interaction);
  }

  return ephemeral("처리할 수 없는 요청이에요.");
}

async function handleSurveySubmit(
  sb: Sb,
  channelId: string,
  discordUserId: string,
  user: DiscordUser | undefined,
  interaction: Interaction,
): Promise<object> {
  if (interaction.data?.custom_id !== "reg:survey") {
    return ephemeral("알 수 없는 양식이에요.");
  }
  const sub = collectSubmitted(interaction.data?.components);
  const battleTag = (firstValue(sub, "battle_tag") ?? "").trim();
  if (!BATTLE_TAG_RE.test(battleTag)) {
    return ephemeral("배틀태그는 이름#숫자 형식이어야 해요 (예: 홍길동#1234).");
  }
  const primaryRole = asRole(firstValue(sub, "primary_role"));
  let secondaryRole = asRole(firstValue(sub, "secondary_role"));
  const pTier = asTier(firstValue(sub, "primary_tier"));
  const sTier = asTier(firstValue(sub, "secondary_tier"));

  // 주/부 포지션이 같으면 부 포지션은 비운다.
  let note: string | undefined;
  if (primaryRole && secondaryRole && primaryRole === secondaryRole) {
    secondaryRole = null;
    note = "⚠️ 주/부 포지션이 같아 부 포지션은 비웠어요. (다르게 골라주세요)";
  }

  const core = await upsertMemberCore(sb, {
    battleTag,
    discordName: getDiscordName(user),
    discordUserId,
  });
  if (!core.ok) return ephemeral(`저장 실패: ${core.error}`);
  const memberId = core.memberId;

  const cm = await upsertChannelMembership(sb, channelId, memberId, {
    primaryRole,
    secondaryRole,
  });
  if (!cm.ok) return ephemeral(`저장 실패: ${cm.error}`);

  // 포지션별 티어 저장 (등급은 기존값 또는 기본값). 티어 미입력이면 건너뜀.
  const existing = await loadProfile(sb, channelId, memberId);
  for (const [role, tier] of [
    [primaryRole, pTier],
    [secondaryRole, sTier],
  ] as const) {
    if (role && tier) {
      const div = existing?.ratings[role]?.division ?? DEFAULT_DIVISION;
      const rr = await upsertRoleRating(
        sb,
        channelId,
        memberId,
        role,
        tier,
        div,
      );
      if (!rr.ok) return ephemeral(`저장 실패: ${rr.error}`);
    }
  }

  const profile = await loadProfile(sb, channelId, memberId);
  if (!profile) return ephemeral("저장 실패: 프로필을 불러오지 못했어요.");
  return profileResponse(
    CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
    profile,
    note,
  );
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

  // 수정 → 설문 모달 다시 (현재 값 프리필)
  if (cid === "reg:edit") {
    const p = await loadProfile(sb, channelId, memberId);
    return surveyModal(p);
  }

  if (cid === "reg:back") {
    const p = await loadProfile(sb, channelId, memberId);
    if (!p) return ephemeral("프로필을 불러오지 못했어요.");
    return profileResponse(CallbackType.UPDATE_MESSAGE, p);
  }

  // 등급 화면
  if (cid === "reg:open_div") {
    const p = await loadProfile(sb, channelId, memberId);
    if (!p) return ephemeral("프로필을 불러오지 못했어요.");
    return divResponse(CallbackType.UPDATE_MESSAGE, p);
  }
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
    }
    return divResponse(CallbackType.UPDATE_MESSAGE, p);
  }

  // 영웅/맵 화면
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
