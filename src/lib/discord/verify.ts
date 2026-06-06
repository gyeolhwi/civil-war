// Discord 인터랙션 요청의 Ed25519 서명을 검증한다.
// Discord는 요청마다 헤더로 서명(x-signature-ed25519)과 타임스탬프(x-signature-timestamp)를
// 보내며, 서명 대상 메시지는 정확히 `timestamp + rawBody` 다.
// 따라서 라우트는 본문을 파싱하기 전에 raw 문자열을 그대로 넘겨야 한다.
//
// 구현은 poc/discord-interactions-verify.mjs 에서 7/7 통과로 증명된 node:crypto 경로와 동일.
// (Discord의 raw 32바이트 hex 공개키 → SPKI DER prefix 결합 → KeyObject)

import { createPublicKey, verify as edVerify } from "node:crypto";

// raw 32바이트 Ed25519 공개키 앞에 붙이는 SPKI DER 헤더.
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/**
 * @param rawBody       요청 본문 원문(파싱 전). `request.text()` 결과를 그대로.
 * @param signatureHex  헤더 `x-signature-ed25519`
 * @param timestamp     헤더 `x-signature-timestamp`
 * @param publicKeyHex  Discord Developer Portal의 Public Key(hex 64자)
 */
export function verifyDiscordRequest(
  rawBody: string,
  signatureHex: string | null,
  timestamp: string | null,
  publicKeyHex: string,
): boolean {
  if (!signatureHex || !timestamp) return false;
  try {
    const key = createPublicKey({
      key: Buffer.concat([SPKI_PREFIX, Buffer.from(publicKeyHex, "hex")]),
      format: "der",
      type: "spki",
    });
    return edVerify(
      null,
      Buffer.from(timestamp + rawBody),
      key,
      Buffer.from(signatureHex, "hex"),
    );
  } catch {
    return false;
  }
}
