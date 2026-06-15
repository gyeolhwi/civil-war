// 디스코드 `/등록` — 오버워치 내전 프로필 등록/수정 (서버리스 / HTTP 인터랙션).
//
// 흐름 (모든 응답은 인터랙션 HTTP 응답, 추가 REST 호출 없음):
//   /등록 ─APPLICATION_COMMAND→ [모달] 배틀태그(자유 텍스트)
//        ─MODAL_SUBMIT→ 멤버 저장 + [메시지] 주/부 포지션·티어 셀렉트 + 영웅/맵/완료 버튼
//   [포지션/티어 셀렉트] ─MESSAGE_COMPONENT→ 즉시 저장 후 메시지 갱신(UPDATE_MESSAGE)
//   [영웅 버튼] → [메시지] 탱/딜/힐 셀렉트, [맵 버튼] → [메시지] 모드별 셀렉트 (즉시 저장)
//
// 누구나(권한 무관) 본인 프로필을 등록/수정할 수 있다 (권한 게이트 없음).
// 채널 컨텍스트는 웹 세션이 없으므로 guild_id → channels.discord_guild_id 로 정한다.
// 멤버는 discord_user_id 로 식별 → 재실행 시 본인 행을 찾아 수정한다.
//
// ⚠️ 모달 안 셀렉트(Label, 2025 신기능)는 이 환경에서 거부돼 "응답 없음"이 나므로
//    쓰지 않는다. 자유 텍스트(배틀태그)만 모달, 나머지 선택값은 메시지 셀렉트로 받는다.

import { ROLE_LABEL_KO } from "@/constants/heroes";
import { TIER_LABEL_KO, TIER_ORDER } from "@/constants/tiers";
import type { Division, RefData, Role, Tier } from "@/domain/types";
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
const ButtonStyle = { PRIMARY: 1, SECONDARY: 2, SUCCESS: 3 } as const;
const TextInputStyle = { SHORT: 1 } as const;
const InteractionType = {
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  MODAL_SUBMIT: 5,
} as const;
const EPHEMERAL = 64;

const ROLES: Role[] = ["tank", "dps", "support"];
const ROLE_PICK_LABEL: Record<Role, string> = {
  tank: "탱커",
  dps: "딜러",
  support: "힐러",
};
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
const DEFAULT_DIVISION: Division = 3; // 디스코드는 티어만 받고 디비전은 기본값(웹에서 조정)

// 배틀태그: 이름#1234 (members/schema.ts 와 동일 규칙)
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

interface Profile {
  battleTag: string;
  primaryRole: Role | null;
  secondaryRole: Role | null;
  tier: Tier | null;
  division: Division | null;
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
  const primaryRole = (cm.data?.primary_role ?? null) as Role | null;
  const primaryRating = ratings.data?.find((r) => r.role === primaryRole);
  return {
    battleTag: m.data.battle_tag as string,
    primaryRole,
    secondaryRole: (cm.data?.secondary_role ?? null) as Role | null,
    tier: (primaryRating?.tier ?? null) as Tier | null,
    division: (primaryRating?.division ?? null) as Division | null,
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
  return {
    type: ComponentType.BUTTON,
    style,
    label,
    emoji: { name: emoji },
    custom_id: customId,
  };
}

function roleOptions(selected: Role | null): Option[] {
  return ROLES.map((r) => ({
    label: ROLE_PICK_LABEL[r],
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
  const role = (r: Role | null) => (r ? ROLE_PICK_LABEL[r] : "—");
  const lines = [
    `✅ **${p.battleTag}** 내전 프로필`,
    `· 주 포지션: ${role(p.primaryRole)}  · 부 포지션: ${role(p.secondaryRole)}  · 티어: ${p.tier ? TIER_LABEL_KO[p.tier] : "—"}`,
    `· 선호 영웅 ${p.heroCodes.length}개  · 선호 맵 ${p.mapCodes.length}개`,
    "아래에서 고르면 바로 저장돼요. (영웅·맵은 버튼)",
  ];
  if (note) lines.push(`\n${note}`);
  return lines.join("\n");
}

/** 메인 프로필 메시지 (포지션·티어 셀렉트 + 영웅/맵/완료 버튼). */
function profileResponse(callbackType: number, p: Profile, note?: string) {
  return {
    type: callbackType,
    data: {
      content: profileSummary(p, note),
      flags: EPHEMERAL,
      components: [
        selectRow("reg:primary", "주 포지션", roleOptions(p.primaryRole), 0, 1),
        selectRow(
          "reg:secondary",
          "부 포지션 (선택)",
          roleOptions(p.secondaryRole),
          0,
          1,
        ),
        selectRow(
          "reg:tier",
          "티어 (주 포지션 기준)",
          tierOptions(p.tier),
          0,
          1,
        ),
        {
          type: ComponentType.ACTION_ROW,
          components: [
            button(ButtonStyle.PRIMARY, "선호 영웅", "⭐", "reg:open_heroes"),
            button(ButtonStyle.PRIMARY, "선호 맵", "🗺️", "reg:open_maps"),
            button(ButtonStyle.SUCCESS, "완료", "✅", "reg:done"),
          ],
        },
      ],
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
      content: `⭐ 선호 영웅 (전체 합쳐 최대 ${MAX_HEROES}개) — 현재 ${p.heroCodes.length}개${note ? `\n${note}` : ""}`,
      flags: EPHEMERAL,
      components: rows,
    },
  };
}

/** 활성 맵을 25개 청크로 나눈 목록 (셀렉트 옵션 상한 때문). */
function mapChunks(
  ref: RefData,
): { code: string; nameKo: string; mode: string }[][] {
  const active = ref.maps.filter((m) => m.isActive);
  const chunks = [];
  for (let i = 0; i < active.length; i += SELECT_OPTION_CAP) {
    chunks.push(active.slice(i, i + SELECT_OPTION_CAP));
  }
  return chunks;
}

function mapResponse(callbackType: number, p: Profile, ref: RefData) {
  const selected = new Set(p.mapCodes);
  const rows = mapChunks(ref).map((chunk, n) =>
    selectRow(
      `reg:map_${n}`,
      `선호 맵 ${n + 1}`,
      chunk.map((m) => ({
        label: `${MODE_EMOJI[m.mode] ?? ""} ${m.nameKo}`.trim(),
        value: m.code,
        default: selected.has(m.code),
      })),
      0,
      chunk.length,
    ),
  );
  return {
    type: callbackType,
    data: {
      content: `🗺️ 선호 맵 — 현재 ${p.mapCodes.length}개`,
      flags: EPHEMERAL,
      components: rows,
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
 * `/등록` 관련 인터랙션 처리. 반환값은 인터랙션 응답 body.
 * 예외·지연은 타임아웃("응답 없음") 대신 ephemeral 에러로 노출한다.
 */
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

  // 슬래시 `/등록` → 즉시 배틀태그 모달 (DB 미접근, 3초 한도 회피).
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    return basicModal(null);
  }

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

  if (interaction.type === InteractionType.MODAL_SUBMIT) {
    return handleModalSubmit(sb, channelId, discordUserId, user, interaction);
  }

  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    if (!memberId) {
      return ephemeral("먼저 `/등록`으로 배틀태그를 입력해주세요.");
    }
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

  // 포지션 — 해당 컬럼만 갱신 (다른 값 보존)
  if (cid === "reg:primary" || cid === "reg:secondary") {
    const field = cid === "reg:primary" ? "primary_role" : "secondary_role";
    const role = asRole(values[0]);
    await sb
      .from("channel_members")
      .update({ [field]: role })
      .match({ channel_id: channelId, member_id: memberId });
    const p = await loadProfile(sb, channelId, memberId);
    if (!p) return ephemeral("프로필을 불러오지 못했어요.");
    return profileResponse(CallbackType.UPDATE_MESSAGE, p);
  }

  // 티어 — 주 포지션 기준으로 저장 (디비전은 기존값 또는 기본값)
  if (cid === "reg:tier") {
    const p = await loadProfile(sb, channelId, memberId);
    if (!p) return ephemeral("프로필을 불러오지 못했어요.");
    if (!p.primaryRole) {
      return profileResponse(
        CallbackType.UPDATE_MESSAGE,
        p,
        "⚠️ 티어는 주 포지션 기준이라, 주 포지션을 먼저 선택해주세요.",
      );
    }
    const tier = asTier(values[0]);
    if (tier) {
      const rr = await upsertRoleRating(
        sb,
        channelId,
        memberId,
        p.primaryRole,
        tier,
        p.division ?? DEFAULT_DIVISION,
      );
      if (!rr.ok) return ephemeral(`저장 실패: ${rr.error}`);
      p.tier = tier;
    }
    return profileResponse(CallbackType.UPDATE_MESSAGE, p);
  }

  if (cid === "reg:open_heroes" || cid === "reg:open_maps") {
    const [ref, p] = await Promise.all([
      getRefData(),
      loadProfile(sb, channelId, memberId),
    ]);
    if (!p) return ephemeral("프로필을 불러오지 못했어요.");
    return cid === "reg:open_heroes"
      ? heroResponse(CallbackType.CHANNEL_MESSAGE_WITH_SOURCE, p, ref)
      : mapResponse(CallbackType.CHANNEL_MESSAGE_WITH_SOURCE, p, ref);
  }

  if (cid.startsWith("reg:hero_")) {
    const role = asRole(cid.slice("reg:hero_".length));
    const [ref, p] = await Promise.all([
      getRefData(),
      loadProfile(sb, channelId, memberId),
    ]);
    if (!p || !role) return ephemeral("프로필을 불러오지 못했어요.");
    // 이 역할의 기존 선택을 빼고 새 선택으로 교체 (다른 역할 영웅은 보존)
    const kept = p.heroCodes.filter((c) => ref.heroByCode[c]?.role !== role);
    const next = [...kept, ...values];
    if (next.length > MAX_HEROES) {
      return heroResponse(
        CallbackType.UPDATE_MESSAGE,
        p,
        ref,
        `⚠️ 전체 합쳐 최대 ${MAX_HEROES}개예요 (지금 ${next.length}개). 저장 안 됨.`,
      );
    }
    const r = await replaceHeroPrefs(sb, channelId, memberId, next);
    if (!r.ok) return ephemeral(`저장 실패: ${r.error}`);
    p.heroCodes = next;
    return heroResponse(CallbackType.UPDATE_MESSAGE, p, ref);
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
    const chunkCodes = (mapChunks(ref)[n] ?? []).map((m) => m.code);
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
