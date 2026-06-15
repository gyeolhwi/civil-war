// 디스코드 `/등록` 멤버 등록/수정 위저드 (서버리스 / HTTP 인터랙션).
//
// 흐름 (모달 체인 — 모든 응답은 인터랙션 HTTP 응답, 추가 REST 호출 없음):
//   /등록  ─APPLICATION_COMMAND→ [모달 reg:basic] 배틀태그+포지션+티어
//          ─MODAL_SUBMIT→ 멤버 저장 + ephemeral 메뉴(영웅/맵/완료 버튼)
//   [영웅 버튼] ─MESSAGE_COMPONENT→ [모달 reg:heroes] 탱/딜/힐 셀렉트
//          ─MODAL_SUBMIT→ 영웅 저장 + 메뉴
//   [맵 버튼]   ─MESSAGE_COMPONENT→ [모달 reg:maps] 모드별 셀렉트
//          ─MODAL_SUBMIT→ 맵 저장 + 메뉴
//   [완료 버튼] ─MESSAGE_COMPONENT→ ephemeral "완료"
//
// 채널 컨텍스트는 웹 세션이 없으므로 guild_id → channels.discord_guild_id 로 정한다.
// 멤버는 discord_user_id 로 식별 → 재실행 시 본인 행을 찾아 프리필·수정한다.
// 모달 안 셀렉트 메뉴는 Label(type 18) 안에 배치한다 (2025+ 표준, docs.discord.com).

import { ROLE_LABEL_KO } from "@/constants/heroes";
import { TIER_LABEL_KO, TIER_ORDER } from "@/constants/tiers";
import type { Division, Role, Tier } from "@/domain/types";
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
  MODAL: 9,
} as const;
const ComponentType = {
  ACTION_ROW: 1,
  BUTTON: 2,
  STRING_SELECT: 3,
  TEXT_INPUT: 4,
  LABEL: 18,
} as const;
const ButtonStyle = { PRIMARY: 1, SECONDARY: 2, SUCCESS: 3 } as const;
const TextInputStyle = { SHORT: 1 } as const;
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

// ── 채널·멤버 해석 ─────────────────────────────────────────────────────────
type Sb = ReturnType<typeof createAdminClient>;

/** guild_id → 내전 채널. 없으면 v1 단일 채널을 자동 연결(1:1 운영 전제). */
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

  // 미연결 + 채널이 정확히 1개면 이 길드에 자동 연결한다.
  const { data: all } = await sb.from("channels").select("id").limit(2);
  if (all && all.length === 1) {
    await sb
      .from("channels")
      .update({ discord_guild_id: guildId })
      .eq("id", all[0].id);
    return all[0].id as string;
  }
  return null; // 채널이 여러 개라 모호 → 관리자 연결 필요
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

interface ExistingProfile {
  battleTag: string;
  primaryRole: Role | null;
  secondaryRole: Role | null;
  tier: Tier | null;
  division: Division | null;
  heroCodes: string[];
  mapCodes: string[];
}

/** 프리필용 기존 값 로드 (없으면 null). */
async function loadExisting(
  sb: Sb,
  channelId: string,
  memberId: string,
): Promise<ExistingProfile | null> {
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
  // 주 포지션의 티어를 프리필 (모달은 주 티어만 받음)
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

function selectLabel(
  labelText: string,
  customId: string,
  options: Option[],
  opts: { min: number; max: number; placeholder: string },
) {
  return {
    type: ComponentType.LABEL,
    label: labelText,
    component: {
      type: ComponentType.STRING_SELECT,
      custom_id: customId,
      placeholder: opts.placeholder,
      min_values: opts.min,
      max_values: Math.min(opts.max, options.length || 1),
      options,
    },
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

function divisionOptions(selected: Division | null): Option[] {
  return ([5, 4, 3, 2, 1] as Division[]).map((d) => ({
    label: `${d}`,
    value: String(d),
    default: selected === d,
  }));
}

/** 기본정보 모달 (배틀태그 + 포지션 + 티어). */
function basicModal(existing: ExistingProfile | null) {
  return {
    type: CallbackType.MODAL,
    data: {
      custom_id: "reg:basic",
      title: "내전 멤버 등록",
      components: [
        {
          type: ComponentType.LABEL,
          label: "배틀태그 (예: 홍길동#1234)",
          component: {
            type: ComponentType.TEXT_INPUT,
            custom_id: "battle_tag",
            style: TextInputStyle.SHORT,
            required: true,
            min_length: 3,
            max_length: 30,
            value: existing?.battleTag ?? "",
            placeholder: "이름#숫자",
          },
        },
        selectLabel(
          "주 포지션",
          "primary_role",
          roleOptions(existing?.primaryRole ?? null),
          {
            min: 1,
            max: 1,
            placeholder: "주 포지션",
          },
        ),
        selectLabel(
          "부 포지션 (선택)",
          "secondary_role",
          roleOptions(existing?.secondaryRole ?? null),
          { min: 0, max: 1, placeholder: "부 포지션" },
        ),
        selectLabel(
          "티어 (주 포지션 기준, 선택)",
          "tier",
          tierOptions(existing?.tier ?? null),
          {
            min: 0,
            max: 1,
            placeholder: "티어",
          },
        ),
        selectLabel(
          "디비전 (선택)",
          "division",
          divisionOptions(existing?.division ?? null),
          {
            min: 0,
            max: 1,
            placeholder: "디비전 (5=하위 ~ 1=상위)",
          },
        ),
      ],
    },
  };
}

/** 등록 단계 메뉴 (영웅/맵/완료 버튼). */
function menuMessage(content: string) {
  return {
    type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      flags: EPHEMERAL,
      components: [
        {
          type: ComponentType.ACTION_ROW,
          components: [
            {
              type: ComponentType.BUTTON,
              style: ButtonStyle.PRIMARY,
              label: "선호 영웅",
              emoji: { name: "⭐" },
              custom_id: "reg:open_heroes",
            },
            {
              type: ComponentType.BUTTON,
              style: ButtonStyle.PRIMARY,
              label: "선호 맵",
              emoji: { name: "🗺️" },
              custom_id: "reg:open_maps",
            },
            {
              type: ComponentType.BUTTON,
              style: ButtonStyle.SUCCESS,
              label: "완료",
              emoji: { name: "✅" },
              custom_id: "reg:done",
            },
          ],
        },
      ],
    },
  };
}

async function heroesModal(existing: ExistingProfile | null) {
  const { heroesByRole } = await getRefData();
  const selected = new Set(existing?.heroCodes ?? []);
  const components = ROLES.map((role) => {
    const opts: Option[] = heroesByRole[role]
      .filter((h) => h.isActive)
      .slice(0, SELECT_OPTION_CAP)
      .map((h) => ({
        label: h.nameKo,
        value: h.code,
        default: selected.has(h.code),
      }));
    return selectLabel(`${ROLE_LABEL_KO[role]} 영웅`, `hero_${role}`, opts, {
      min: 0,
      max: MAX_HEROES,
      placeholder: "선호 영웅 (전체 합쳐 최대 5)",
    });
  });
  return {
    type: CallbackType.MODAL,
    data: { custom_id: "reg:heroes", title: "선호 영웅 (최대 5)", components },
  };
}

async function mapsModal(existing: ExistingProfile | null) {
  const { maps } = await getRefData();
  const selected = new Set(existing?.mapCodes ?? []);
  const active = maps.filter((m) => m.isActive);
  const allOptions: Option[] = active.map((m) => ({
    label: `${MODE_EMOJI[m.mode] ?? ""} ${m.nameKo}`.trim(),
    value: m.code,
    default: selected.has(m.code),
  }));
  // 셀렉트당 25개 제한 → 청크로 분할 (37개 → 2개)
  const components = [];
  for (let i = 0; i < allOptions.length; i += SELECT_OPTION_CAP) {
    const chunk = allOptions.slice(i, i + SELECT_OPTION_CAP);
    const n = Math.floor(i / SELECT_OPTION_CAP) + 1;
    components.push(
      selectLabel(`선호 맵 (${n})`, `map_${n}`, chunk, {
        min: 0,
        max: chunk.length,
        placeholder: "선호 맵 선택",
      }),
    );
  }
  return {
    type: CallbackType.MODAL,
    data: { custom_id: "reg:maps", title: "선호 맵", components },
  };
}

// ── 모달 제출 값 파싱 ──────────────────────────────────────────────────────
type Submitted = Record<string, { value?: string; values?: string[] }>;

/** Label/ActionRow 중첩을 재귀로 훑어 custom_id 별 값을 모은다. */
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
const InteractionType = {
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  MODAL_SUBMIT: 5,
} as const;

/** `/등록` 관련 인터랙션 처리. 반환값은 인터랙션 응답 body. */
export async function handleRegister(
  interaction: Interaction,
): Promise<object> {
  const user = getUser(interaction);
  const discordUserId = user?.id;
  if (!discordUserId)
    return ephemeral("디스코드 사용자 정보를 찾을 수 없어요.");

  const sb = createAdminClient();

  // 모달은 defer(응답 지연)가 불가 → 3초 내 응답해야 한다.
  // 길드 ↔ 그룹 연결은 채널(그룹) 등록 시 discord_guild_id 로 설정한다.
  // 채널·멤버 조회를 병렬로 돌려 응답 시간을 줄인다.
  const [channelId, memberId] = await Promise.all([
    resolveChannelId(sb, interaction.guild_id),
    resolveMemberId(sb, discordUserId),
  ]);
  if (!channelId) {
    return ephemeral(
      "이 서버는 아직 내전 채널과 연결되지 않았어요. 채널 관리자에게 문의해주세요.",
    );
  }

  // 1) 슬래시 `/등록` → 기본정보 모달 (기존값 프리필)
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const existing = memberId
      ? await loadExisting(sb, channelId, memberId)
      : null;
    return basicModal(existing);
  }

  // 2) 버튼 → 영웅/맵 모달 or 완료
  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    const cid = interaction.data?.custom_id;
    const existing = memberId
      ? await loadExisting(sb, channelId, memberId)
      : null;
    if (cid === "reg:open_heroes") return heroesModal(existing);
    if (cid === "reg:open_maps") return mapsModal(existing);
    if (cid === "reg:done") {
      return ephemeral("🎉 등록 완료! 웹에서 더 자세히 수정할 수 있어요.");
    }
    return ephemeral("알 수 없는 동작이에요.");
  }

  // 3) 모달 제출 → 저장
  if (interaction.type === InteractionType.MODAL_SUBMIT) {
    const cid = interaction.data?.custom_id;
    const sub = collectSubmitted(interaction.data?.components);

    if (cid === "reg:basic") {
      return saveBasic(sb, channelId, discordUserId, getDiscordName(user), sub);
    }
    if (cid === "reg:heroes") {
      return saveHeroes(sb, channelId, discordUserId, sub);
    }
    if (cid === "reg:maps") {
      return saveMaps(sb, channelId, discordUserId, sub);
    }
    return ephemeral("알 수 없는 양식이에요.");
  }

  return ephemeral("처리할 수 없는 요청이에요.");
}

async function saveBasic(
  sb: Sb,
  channelId: string,
  discordUserId: string,
  discordName: string | null,
  sub: Submitted,
): Promise<object> {
  const battleTag = (firstValue(sub, "battle_tag") ?? "").trim();
  if (!BATTLE_TAG_RE.test(battleTag)) {
    return ephemeral("배틀태그는 이름#숫자 형식이어야 해요 (예: 홍길동#1234).");
  }
  const primaryRole = asRole(firstValue(sub, "primary_role"));
  const secondaryRole = asRole(firstValue(sub, "secondary_role"));
  const tier = asTier(firstValue(sub, "tier"));
  const division = asDivision(firstValue(sub, "division"));

  const core = await upsertMemberCore(sb, {
    battleTag,
    discordName,
    discordUserId,
  });
  if (!core.ok) return ephemeral(`저장 실패: ${core.error}`);

  const cm = await upsertChannelMembership(sb, channelId, core.memberId, {
    primaryRole,
    secondaryRole,
  });
  if (!cm.ok) return ephemeral(`저장 실패: ${cm.error}`);

  // 티어는 주 포지션 기준으로만 저장 (다른 역할 티어는 보존)
  if (primaryRole && tier && division) {
    const rr = await upsertRoleRating(
      sb,
      channelId,
      core.memberId,
      primaryRole,
      tier,
      division,
    );
    if (!rr.ok) return ephemeral(`저장 실패: ${rr.error}`);
  }

  return menuMessage(
    `✅ **${battleTag}** 기본 정보가 저장됐어요!\n아래에서 선호 영웅·맵을 추가하거나 **완료**를 눌러주세요.`,
  );
}

async function saveHeroes(
  sb: Sb,
  channelId: string,
  discordUserId: string,
  sub: Submitted,
): Promise<object> {
  const memberId = await resolveMemberId(sb, discordUserId);
  if (!memberId) return ephemeral("먼저 `/등록`으로 기본 정보를 입력해주세요.");

  const codes = [
    ...(sub.hero_tank?.values ?? []),
    ...(sub.hero_dps?.values ?? []),
    ...(sub.hero_support?.values ?? []),
  ];
  if (codes.length > MAX_HEROES) {
    return ephemeral(
      `선호 영웅은 전체 합쳐 최대 ${MAX_HEROES}개예요 (지금 ${codes.length}개 선택). 다시 골라주세요.`,
    );
  }
  const r = await replaceHeroPrefs(sb, channelId, memberId, codes);
  if (!r.ok) return ephemeral(`저장 실패: ${r.error}`);
  return menuMessage(
    `⭐ 선호 영웅 ${codes.length}개 저장됐어요!\n계속 추가하거나 **완료**를 눌러주세요.`,
  );
}

async function saveMaps(
  sb: Sb,
  channelId: string,
  discordUserId: string,
  sub: Submitted,
): Promise<object> {
  const memberId = await resolveMemberId(sb, discordUserId);
  if (!memberId) return ephemeral("먼저 `/등록`으로 기본 정보를 입력해주세요.");

  const codes: string[] = [];
  for (const [key, v] of Object.entries(sub)) {
    if (key.startsWith("map_") && v.values) codes.push(...v.values);
  }
  const r = await replaceMapPrefs(sb, channelId, memberId, codes);
  if (!r.ok) return ephemeral(`저장 실패: ${r.error}`);
  return menuMessage(
    `🗺️ 선호 맵 ${codes.length}개 저장됐어요!\n계속 추가하거나 **완료**를 눌러주세요.`,
  );
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
