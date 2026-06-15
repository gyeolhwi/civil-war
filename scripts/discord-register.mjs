// 슬래시 커맨드를 디스코드 길드(서버)에 등록한다.
// 길드 등록은 즉시 반영된다(전역 등록은 ~1시간). 내전용이라 길드 등록이 맞다.
//
// 실행: node --env-file=.env.local scripts/discord-register.mjs
// 필요한 env: DISCORD_APPLICATION_ID, DISCORD_GUILD_ID, DISCORD_BOT_TOKEN
//
// PUT(전체 덮어쓰기) 방식이라 여러 번 실행해도 중복되지 않는다.

const APP_ID = process.env.DISCORD_APPLICATION_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const TOKEN = process.env.DISCORD_BOT_TOKEN;

for (const [key, value] of Object.entries({
  DISCORD_APPLICATION_ID: APP_ID,
  DISCORD_GUILD_ID: GUILD_ID,
  DISCORD_BOT_TOKEN: TOKEN,
})) {
  if (!value) {
    console.error(`✖ ${key} 가 설정되지 않았습니다 (.env.local 확인)`);
    process.exit(1);
  }
}

const commands = [
  {
    name: "내전",
    description: "오버워치 내전 참가자 모집 공지를 올립니다",
    options: [
      { name: "날짜", description: "내전 날짜 (예: 6/10)", type: 3, required: true },
      { name: "시간", description: "내전 시간 (예: 21:00)", type: 3, required: true },
    ],
  },
  {
    name: "등록",
    description: "내전 멤버 등록/수정 (배틀태그·포지션·티어·선호 영웅·맵)",
  },
];

const res = await fetch(
  `https://discord.com/api/v10/applications/${APP_ID}/guilds/${GUILD_ID}/commands`,
  {
    method: "PUT",
    headers: {
      Authorization: `Bot ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  },
);

if (!res.ok) {
  console.error(`✖ 커맨드 등록 실패 (${res.status})`);
  console.error(await res.text());
  process.exit(1);
}

const registered = await res.json();
console.log(`✓ 길드(${GUILD_ID})에 ${registered.length}개 커맨드 등록 완료:`);
for (const c of registered) {
  console.log(`  /${c.name} — ${c.description}`);
}
