import "server-only";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type {
  Comp,
  GameMap,
  GameMode,
  Hero,
  HeroFunc,
  RefData,
  Role,
} from "@/domain/types";

/**
 * 영웅·맵 마스터를 DB에서 로드 (0003 마이그레이션). 코드 상수를 대체한다.
 * - 읽기 전용 공개 데이터라 쿠키 없는 anon 클라이언트 + unstable_cache로 캐시.
 * - role/mode enum 위반 시 조용히 무시하지 않고 throw (밸런싱 오작동 방지).
 * - 영웅·맵 추가/수정 후엔 revalidateTag("ref-data")로 갱신.
 */

const ROLES: Role[] = ["tank", "dps", "support"];
const MODES: GameMode[] = [
  "control",
  "escort",
  "hybrid",
  "push",
  "flashpoint",
  "clash",
];

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { auth: { persistSession: false } },
  );
}

interface HeroRow {
  code: string;
  name_ko: string;
  role: string;
  comp: string[] | null;
  func: string[] | null;
  is_active: boolean;
}

interface MapRow {
  code: string;
  name_ko: string;
  mode: string;
  is_active: boolean;
}

function toHero(r: HeroRow): Hero {
  if (!ROLES.includes(r.role as Role)) {
    throw new Error(`heroes.${r.code}: 알 수 없는 role "${r.role}"`);
  }
  return {
    code: r.code,
    nameKo: r.name_ko,
    role: r.role as Role,
    comp: (r.comp ?? []) as Comp[],
    func: (r.func ?? []) as HeroFunc[],
    image: `/images/heroes/${r.code}.png`,
    isActive: r.is_active,
  };
}

function toMap(r: MapRow): GameMap {
  if (!MODES.includes(r.mode as GameMode)) {
    throw new Error(`maps.${r.code}: 알 수 없는 mode "${r.mode}"`);
  }
  return {
    code: r.code,
    nameKo: r.name_ko,
    mode: r.mode as GameMode,
    image: `/images/maps/${r.code}.jpg`,
    isActive: r.is_active,
  };
}

const load = unstable_cache(
  async (): Promise<RefData> => {
    const sb = anonClient();
    const [heroRes, mapRes] = await Promise.all([
      sb
        .from("heroes")
        .select("code,name_ko,role,comp,func,is_active")
        .order("sort_order"),
      sb.from("maps").select("code,name_ko,mode,is_active").order("sort_order"),
    ]);
    if (heroRes.error)
      throw new Error(`heroes 로드 실패: ${heroRes.error.message}`);
    if (mapRes.error)
      throw new Error(`maps 로드 실패: ${mapRes.error.message}`);

    const heroes = (heroRes.data as HeroRow[]).map(toHero);
    const maps = (mapRes.data as MapRow[]).map(toMap);

    const heroByCode: Record<string, Hero> = {};
    for (const h of heroes) heroByCode[h.code] = h;
    const mapByCode: Record<string, GameMap> = {};
    for (const m of maps) mapByCode[m.code] = m;
    const heroesByRole: Record<Role, Hero[]> = {
      tank: [],
      dps: [],
      support: [],
    };
    for (const h of heroes) heroesByRole[h.role].push(h);

    return { heroes, maps, heroByCode, mapByCode, heroesByRole };
  },
  ["ref-data"],
  { tags: ["ref-data"], revalidate: 3600 },
);

/** 영웅·맵 마스터 (캐시됨). 서버 컴포넌트·액션·로더에서 호출. */
export function getRefData(): Promise<RefData> {
  return load();
}
