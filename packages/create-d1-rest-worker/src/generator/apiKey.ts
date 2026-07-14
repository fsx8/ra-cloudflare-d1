import crypto from "node:crypto";

export function generateApiKey() {
  return `sk_${crypto.randomBytes(24).toString("hex")}`;
}
