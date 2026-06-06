// POC: 서버리스(Vercel) Discord 봇이 성립하려면 반드시 통과해야 하는 단 하나의 관문 —
// Ed25519 인터랙션 서명검증 + PING→PONG 응답 — 을 무의존성(node:crypto)으로 실제 검증.
//
// 실행: node poc/discord-interactions-verify.mjs
// 의존성 없음. 앱 코드와 무관. Discord 토큰/서버 불필요(암호학적 동작만 증명).
//
// 검증 포인트:
//  1) Discord 공식 방식 그대로 — 공개키 hex, 서명 hex, 메시지 = timestamp + rawBody.
//  2) 정상 서명 PING → 200 + {"type":1}(PONG).
//  3) 서명/본문/타임스탬프 변조 → 401 (위조 차단).
//  4) Vercel Edge 런타임에서 쓰는 WebCrypto 경로로도 동일 결과.

import {
  createPublicKey,
  generateKeyPairSync,
  sign as edSign,
  verify as edVerify,
  webcrypto,
} from "node:crypto";

// ── 0. Discord 앱 키 시뮬레이션 ─────────────────────────────
// 실제로는 Developer Portal이 발급한 Public Key(hex 64자)를 env로 받는다.
const { publicKey, privateKey } = generateKeyPairSync("ed25519");

// 공개키를 Discord가 주는 형식(raw 32바이트 hex)으로 — 실제 env 값과 동일 형태
const rawPub = publicKey.export({ type: "spki", format: "der" }).subarray(-32);
const DISCORD_PUBLIC_KEY_HEX = rawPub.toString("hex");

// 보내는 쪽(Discord) 서명 흉내: ed25519 → algorithm null
function discordSign(timestamp, body) {
  return edSign(null, Buffer.from(timestamp + body), privateKey).toString("hex");
}

// ── 1. 검증 함수 — Vercel 라우트가 그대로 쓸 코드 ───────────
// raw 32바이트 hex 공개키 → KeyObject (SPKI DER prefix + raw 32)
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const APP_PUBKEY = createPublicKey({
  key: Buffer.concat([SPKI_PREFIX, Buffer.from(DISCORD_PUBLIC_KEY_HEX, "hex")]),
  format: "der",
  type: "spki",
});

function verifyDiscordRequest({ rawBody, signatureHex, timestamp }) {
  if (!signatureHex || !timestamp) return false;
  try {
    const msg = Buffer.from(timestamp + rawBody);
    const sig = Buffer.from(signatureHex, "hex");
    return edVerify(null, msg, APP_PUBKEY, sig);
  } catch {
    return false;
  }
}

// ── 2. 인터랙션 핸들러 (라우트 본체) ────────────────────────
function handleInteraction({ rawBody, signatureHex, timestamp }) {
  if (!verifyDiscordRequest({ rawBody, signatureHex, timestamp })) {
    return { status: 401, body: "invalid request signature" };
  }
  const interaction = JSON.parse(rawBody);
  if (interaction.type === 1) {
    return { status: 200, body: JSON.stringify({ type: 1 }) }; // PONG
  }
  // type 2 = APPLICATION_COMMAND → 메시지(4) 응답 예시
  return {
    status: 200,
    body: JSON.stringify({ type: 4, data: { content: "ok" } }),
  };
}

// ── 3. 테스트 ───────────────────────────────────────────────
let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(`  ❌ ${name}`);
  }
}

console.log("POC: Discord 인터랙션 서명검증 + PING/PONG\n");
console.log(`공개키(hex, env 형태): ${DISCORD_PUBLIC_KEY_HEX}\n`);

// (a) 정상 PING → PONG
{
  const ts = "1700000000";
  const body = JSON.stringify({ type: 1 });
  const sig = discordSign(ts, body);
  const res = handleInteraction({ rawBody: body, signatureHex: sig, timestamp: ts });
  check("정상 PING → 200", res.status === 200);
  check("정상 PING → PONG(type:1)", res.body === JSON.stringify({ type: 1 }));
}

// (b) 서명 변조 → 401
{
  const ts = "1700000000";
  const body = JSON.stringify({ type: 1 });
  const sig0 = discordSign(ts, body);
  const sig = (sig0[0] === "a" ? "b" : "a") + sig0.slice(1);
  const res = handleInteraction({ rawBody: body, signatureHex: sig, timestamp: ts });
  check("서명 변조 → 401", res.status === 401);
}

// (c) 본문 변조(서명은 원본) → 401
{
  const ts = "1700000000";
  const body = JSON.stringify({ type: 1 });
  const sig = discordSign(ts, body);
  const res = handleInteraction({
    rawBody: JSON.stringify({ type: 2 }),
    signatureHex: sig,
    timestamp: ts,
  });
  check("본문 변조 → 401", res.status === 401);
}

// (d) 타임스탬프 변조 → 401
{
  const ts = "1700000000";
  const body = JSON.stringify({ type: 1 });
  const sig = discordSign(ts, body);
  const res = handleInteraction({ rawBody: body, signatureHex: sig, timestamp: "1700000001" });
  check("타임스탬프 변조 → 401", res.status === 401);
}

// (e) 슬래시 커맨드(type 2) → 메시지(type 4)
{
  const ts = "1700000050";
  const body = JSON.stringify({ type: 2, data: { name: "내전" } });
  const sig = discordSign(ts, body);
  const res = handleInteraction({ rawBody: body, signatureHex: sig, timestamp: ts });
  check("슬래시 커맨드 → 200 + type:4", res.status === 200 && JSON.parse(res.body).type === 4);
}

// (f) WebCrypto(Edge 런타임) 경로 교차검증
{
  const key = await webcrypto.subtle.importKey(
    "raw",
    rawPub,
    { name: "Ed25519" },
    false,
    ["verify"],
  );
  const ts = "1700000099";
  const body = JSON.stringify({ type: 1 });
  const sig = Buffer.from(discordSign(ts, body), "hex");
  const ok = await webcrypto.subtle.verify(
    { name: "Ed25519" },
    key,
    sig,
    Buffer.from(ts + body),
  );
  check("WebCrypto(Edge) 검증도 통과", ok === true);
}

console.log(`\n결과: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
