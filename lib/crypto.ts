import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// AES-256-GCM para segredos em repouso (ex: chaves de API de motores de IA).
// Formato armazenado: "<iv>:<authTag>:<ciphertext>", tudo em hex.
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY não está definida no .env. Gere uma com: openssl rand -hex 32"
    );
  }
  if (key.length !== 64) {
    throw new Error("ENCRYPTION_KEY precisa ter 64 caracteres hex (32 bytes). Gere uma com: openssl rand -hex 32");
  }
  return Buffer.from(key, "hex");
}

export function encrypt(plainText: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);

  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decrypt(payload: string): string {
  const [ivHex, authTagHex, dataHex] = payload.split(":");
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error("Payload criptografado em formato inválido.");
  }

  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}

export function formatMaskedKey(last4: string): string {
  return `${"•".repeat(9)}${last4}`;
}
