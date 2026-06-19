// POC: member ↔ discord_user_id 연동률 측정 (읽기 전용)
// 실행: node --env-file=.env.local scripts/poc-linkage.mjs
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const q = async (path) =>
  (await fetch(`${URL}/rest/v1/${path}`, { headers: H })).json();

const [members, channels, links] = await Promise.all([
  q("members?select=id,discord_user_id,battle_tag"),
  q("channels?select=id,name,discord_guild_id"),
  q("channel_members?select=channel_id,member_id"),
]);

const linkedById = new Map(members.map((m) => [m.id, !!m.discord_user_id]));
const totalLinked = members.filter((m) => m.discord_user_id).length;
console.log(
  `전체 멤버: ${members.length}명 · 디스코드 연동됨: ${totalLinked}명 (${Math.round((totalLinked / Math.max(members.length, 1)) * 100)}%)`,
);
console.log("─".repeat(56));
for (const c of channels) {
  const ids = links.filter((l) => l.channel_id === c.id).map((l) => l.member_id);
  const linked = ids.filter((id) => linkedById.get(id)).length;
  console.log(
    `[${c.name}] 멤버 ${ids.length}명 · 연동 ${linked}명 (${ids.length ? Math.round((linked / ids.length) * 100) : 0}%) · guild ${c.discord_guild_id ? "✓" : "✗"}`,
  );
}
