// 채널 + 채널 관리자 발급 (슈퍼관리자 운영 도구, SC-01).
//
// 사용법:
//   node --env-file=.env.local scripts/provision-channel.mjs \
//     --user=아이디 --pass=비밀번호 --channel="채널명" [--super]
//
// 동작: auth 유저(아이디@<내부도메인>) 생성/갱신 → admins 행 보장 →
//       채널 생성(소유자=그 관리자) → anon 로그인 검증.
// 필요한 env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//            NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_INTERNAL_EMAIL_DOMAIN
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const { values } = parseArgs({
  options: {
    user: { type: "string" },
    pass: { type: "string" },
    channel: { type: "string" },
    super: { type: "boolean", default: false },
  },
});

if (!values.user || !values.pass || !values.channel) {
  console.error(
    '사용법: node --env-file=.env.local scripts/provision-channel.mjs --user=아이디 --pass=비번 --channel="채널명" [--super]',
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const domain = process.env.NEXT_PUBLIC_INTERNAL_EMAIL_DOMAIN || "civilwar.local";
if (!url || !serviceKey || !anonKey) {
  console.error("env 누락: URL / SERVICE_ROLE_KEY / ANON_KEY 확인");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const { user, pass, channel } = values;
const email = `${user}@${domain}`;

async function main() {
  // 1. auth 유저 생성 (있으면 비번/인증 갱신)
  let userId;
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password: pass,
    email_confirm: true,
  });
  if (cErr) {
    // 이미 존재 → 찾아서 갱신
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list.users.find((u) => u.email === email);
    if (!existing) {
      console.error("❌ 유저 생성 실패:", cErr.message);
      process.exit(1);
    }
    userId = existing.id;
    await admin.auth.admin.updateUserById(userId, {
      password: pass,
      email_confirm: true,
    });
    console.log(`↻ 기존 유저 ${email} 비번 갱신`);
  } else {
    userId = created.user.id;
    console.log(`✅ 유저 생성: ${email}`);
  }

  // 2. admins 행 보장 (트리거가 만들지만 멱등 보강) + 슈퍼 여부
  await admin
    .from("admins")
    .upsert(
      { id: userId, username: user, display_name: user, is_super: !!values.super },
      { onConflict: "id" },
    );
  console.log(`✅ admins 행 보장 (super=${!!values.super})`);

  // 3. 채널 생성 (동일 소유자+이름 중복은 건너뜀)
  const { data: dup } = await admin
    .from("channels")
    .select("id")
    .eq("owner_admin_id", userId)
    .eq("name", channel)
    .maybeSingle();
  if (dup) {
    console.log(`↻ 채널 "${channel}" 이미 존재 — 건너뜀`);
  } else {
    const { error: chErr } = await admin
      .from("channels")
      .insert({ name: channel, owner_admin_id: userId });
    if (chErr) {
      console.error("❌ 채널 생성 실패:", chErr.message);
      process.exit(1);
    }
    console.log(`✅ 채널 생성: "${channel}"`);
  }

  // 4. 로그인 검증 (앱과 동일 경로)
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: si, error: siErr } = await anon.auth.signInWithPassword({
    email,
    password: pass,
  });
  if (siErr || !si.session) {
    console.error("❌ 로그인 검증 실패:", siErr?.message);
    process.exit(1);
  }
  console.log("✅ 로그인 검증 성공");

  console.log(
    `\n━━━ 발급 완료 ━━━\n로그인 아이디: ${user}\n비밀번호: ${pass}\n채널: ${channel}${values.super ? "\n권한: 슈퍼관리자" : ""}`,
  );
}

main().catch((e) => {
  console.error("예외:", e);
  process.exit(1);
});
