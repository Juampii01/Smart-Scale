/**
 * Cifrado de tokens OAuth (IG/YT) en reposo — AES-256-GCM.
 *
 * Los access/refresh tokens se guardan en public.social_connections. Aunque esa
 * tabla tiene RLS bloqueada (solo service role), ciframos igual como defensa en
 * profundidad: un snapshot/backup de la DB no expone tokens en texto plano.
 *
 * Clave: 64 hex chars (32 bytes) en OAUTH_TOKEN_ENCRYPTION_KEY.
 * Generala con:  openssl rand -hex 32
 *
 * Formato del ciphertext: `v1.<iv>.<tag>.<ct>` (todo base64url). El prefijo de
 * versión permite distinguir ciphertext de texto plano legacy.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

const KEY_ENV = "OAUTH_TOKEN_ENCRYPTION_KEY"
const IV_LENGTH_BYTES = 12 // estándar GCM
const VERSION = "v1"

function getKey(): Buffer | null {
  const raw = process.env[KEY_ENV]
  if (!raw) return null
  if (!/^[0-9a-f]{64}$/i.test(raw)) {
    console.error(`[social/crypto] ${KEY_ENV} debe ser exactamente 64 hex chars`)
    return null
  }
  return Buffer.from(raw, "hex")
}

/** Cifra un token. Lanza si la clave no está seteada (no guardamos texto plano). */
export function encryptToken(plaintext: string): string {
  const key = getKey()
  if (!key) {
    throw new Error(`${KEY_ENV} no está seteada — me niego a guardar el token en texto plano`)
  }
  const iv = randomBytes(IV_LENGTH_BYTES)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".")
}

/** Descifra un payload versionado. Texto plano legacy pasa sin cambios. */
export function decryptToken(payload: string): string {
  if (!payload.startsWith(`${VERSION}.`)) return payload // legacy plaintext
  const parts = payload.split(".")
  if (parts.length !== 4) {
    throw new Error(`Token cifrado malformado (esperaba 4 partes, hay ${parts.length})`)
  }
  const key = getKey()
  if (!key) throw new Error(`${KEY_ENV} no está seteada — no puedo descifrar`)
  const [, ivB64, tagB64, ctB64] = parts
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"))
  const decrypted = Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()])
  return decrypted.toString("utf8")
}
