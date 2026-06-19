// POC: /내전이동 실현 가능성 검증 (읽기 전용 + 게이트된 이동 테스트)
//
// 실행(읽기 전용):  node --env-file=.env.local scripts/poc-voice-move.mjs
// 실제 이동 테스트:  node --env-file=.env.local scripts/poc-voice-move.mjs --move <userId> <voiceChannelId>
//
// 검증 항목:
//   1) 봇 토큰 유효 + 봇 식별
//   2) 봇이 길드 멤버인가 + 역할
//   3) 봇 길드 권한에 ADMINISTRATOR 또는 MOVE_MEMBERS 가 있는가
//   4) 길드 음성채널 열거 (이동 대상 후보)
//   5) voice-states REST 로 "현재 음성 접속" 조회 가능한가 (있으면 사전 필터 UX 가능)
//   6) (게이트) 실제 PATCH 이동 — 권한/미접속 에러 코드 실측

const API = "https://discord.com/api/v10";
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD = process.env.DISCORD_GUILD_ID;

if (!TOKEN) {
  console.error("✖ DISCORD_BOT_TOKEN 없음");
  process.exit(1);
}
const H = { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" };

const PERM = { ADMINISTRATOR: 1n << 3n, MOVE_MEMBERS: 1n << 24n };

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: H,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, ok: res.ok, json };
}

function line() {
  console.log("─".repeat(60));
}

// 1) 봇 식별
line();
const me = await api("GET", "/users/@me");
if (!me.ok) {
  console.error(`✖ 토큰 무효? GET /users/@me → ${me.status}`, me.json);
  process.exit(1);
}
const botId = me.json.id;
console.log(`✓ 봇: ${me.json.username} (id ${botId})`);

if (!GUILD) {
  console.log("\n⚠ DISCORD_GUILD_ID 없음 — 봇이 속한 길드 목록만 출력");
  const gs = await api("GET", "/users/@me/guilds");
  console.log(gs.json);
  process.exit(0);
}

// 2) 봇 길드 멤버십 + 역할
line();
const botMember = await api("GET", `/guilds/${GUILD}/members/${botId}`);
if (!botMember.ok) {
  console.error(
    `✖ 봇이 이 길드 멤버가 아님? GET members/${botId} → ${botMember.status}`,
    botMember.json,
  );
  process.exit(1);
}
console.log(`✓ 봇이 길드(${GUILD}) 멤버. 역할 ${botMember.json.roles.length}개`);

// 3) 권한 계산 (@everyone + 봇 역할들 OR)
const roles = await api("GET", `/guilds/${GUILD}/roles`);
if (!roles.ok) {
  console.error(`✖ 역할 조회 실패 → ${roles.status}`, roles.json);
  process.exit(1);
}
const roleById = new Map(roles.json.map((r) => [r.id, r]));
let perms = 0n;
const everyone = roleById.get(GUILD); // @everyone 역할 id == guild id
if (everyone) perms |= BigInt(everyone.permissions);
for (const rid of botMember.json.roles) {
  const r = roleById.get(rid);
  if (r) perms |= BigInt(r.permissions);
}
const isAdmin = (perms & PERM.ADMINISTRATOR) !== 0n;
const canMove = isAdmin || (perms & PERM.MOVE_MEMBERS) !== 0n;
line();
console.log(`권한 비트필드: ${perms}`);
console.log(`  ADMINISTRATOR : ${isAdmin ? "✓" : "✗"}`);
console.log(
  `  MOVE_MEMBERS  : ${(perms & PERM.MOVE_MEMBERS) !== 0n ? "✓" : "✗"}`,
);
console.log(
  canMove
    ? "✓ 길드 권한상 멤버 이동 가능 (채널별 권한 오버라이트는 별도)"
    : "✗ 길드 권한에 MOVE_MEMBERS 없음 → 봇 역할에 '멤버 이동' 권한 추가 필요",
);

// 4) 음성채널 열거
line();
const ch = await api("GET", `/guilds/${GUILD}/channels`);
if (!ch.ok) {
  console.error(`✖ 채널 조회 실패 → ${ch.status}`, ch.json);
} else {
  const voice = ch.json.filter((c) => c.type === 2 || c.type === 13);
  console.log(`✓ 음성채널 ${voice.length}개:`);
  for (const v of voice) {
    console.log(`  · ${v.name}  (id ${v.id}${v.type === 13 ? ", stage" : ""})`);
  }
}

// 5) voice-states REST 가용성 (현재 음성 접속 사전조회 가능한지)
line();
const vs = await api("GET", `/guilds/${GUILD}/voice-states/${botId}`);
console.log(
  `voice-states REST 조회: status ${vs.status} ${
    vs.status === 404
      ? "(엔드포인트 동작 — 봇이 음성 미접속이라 404. 산 사람 id로는 접속 시 200)"
      : vs.status === 200
        ? "(봇이 음성 접속 중)"
        : "(미지원/권한 문제일 수 있음 — 그러면 사전필터 없이 attempt-and-handle)"
  }`,
);

// 6) 게이트된 실제 이동
const moveIdx = process.argv.indexOf("--move");
if (moveIdx !== -1) {
  const userId = process.argv[moveIdx + 1];
  const channelId = process.argv[moveIdx + 2];
  line();
  console.log(`▶ 실제 이동 시도: user ${userId} → voice ${channelId}`);
  const mv = await api("PATCH", `/guilds/${GUILD}/members/${userId}`, {
    channel_id: channelId,
  });
  console.log(`  status ${mv.status}`, mv.json ?? "(no body)");
  if (mv.ok) console.log("  ✓ 이동 성공");
  else if (mv.json?.code === 40032)
    console.log("  → 대상이 음성 미접속 (권한은 OK, 음성 입장 후엔 성공)");
  else if (mv.status === 403)
    console.log("  → 권한 부족 (MOVE_MEMBERS 또는 채널 접근 권한 확인)");
} else {
  line();
  console.log(
    "ℹ 실제 이동 테스트는: node --env-file=.env.local scripts/poc-voice-move.mjs --move <userId> <voiceChannelId>",
  );
}
line();
