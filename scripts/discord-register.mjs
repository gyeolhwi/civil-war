// 슬래시 커맨드를 디스코드에 "글로벌" 등록한다.
// 글로벌 등록은 봇이 들어간 모든 서버에서 보인다(반영 ~1시간). 멀티 서버 운영용.
//
// 실행: node --env-file=.env.local scripts/discord-register.mjs
// 필요한 env: DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN
// 선택   env: DISCORD_GUILD_ID — 있으면 그 길드에 남아있던 "길드 등록" 커맨드를
//             지워 글로벌과 중복 표시되는 것을 방지한다(과거 길드 등록 흔적 청소).
//
// PUT(전체 덮어쓰기) 방식이라 여러 번 실행해도 중복되지 않는다.

const APP_ID = process.env.DISCORD_APPLICATION_ID;
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID; // 선택(청소용)

for (const [key, value] of Object.entries({
  DISCORD_APPLICATION_ID: APP_ID,
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
    name: "내전-프로필",
    description: "오버워치 내전 프로필 등록/수정 (배틀태그·포지션·티어·선호 영웅·맵)",
  },
  {
    name: "패치노트",
    description: "오버워치 신규 소식·내전 봇 업데이트를 확인합니다",
  },
];

const headers = {
  Authorization: `Bot ${TOKEN}`,
  "Content-Type": "application/json",
};

// 1) 글로벌 등록
const res = await fetch(
  `https://discord.com/api/v10/applications/${APP_ID}/commands`,
  { method: "PUT", headers, body: JSON.stringify(commands) },
);

if (!res.ok) {
  console.error(`✖ 글로벌 커맨드 등록 실패 (${res.status})`);
  console.error(await res.text());
  process.exit(1);
}

const registered = await res.json();
console.log(`✓ 글로벌로 ${registered.length}개 커맨드 등록 완료 (반영 ~1시간):`);
for (const c of registered) {
  console.log(`  /${c.name} — ${c.description}`);
}

// 2) (선택) 과거 길드 등록 커맨드 청소 — 글로벌과 중복 표시 방지
if (GUILD_ID) {
  const clr = await fetch(
    `https://discord.com/api/v10/applications/${APP_ID}/guilds/${GUILD_ID}/commands`,
    { method: "PUT", headers, body: "[]" },
  );
  if (clr.ok) {
    console.log(`✓ 길드(${GUILD_ID}) 길드-등록 커맨드 청소 완료 (중복 방지)`);
  } else {
    console.warn(`⚠ 길드 커맨드 청소 실패 (${clr.status}) — 무시 가능`);
  }
}
