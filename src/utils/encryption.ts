import { createCipheriv, createDecipheriv, createHash, createHmac } from 'node:crypto';

/**
 * Field-level encryption utility (Strapi 5)
 *
 * Algorithm : AES-256-GCM  (Authenticated Encryption — แก้ข้อมูลแล้วถอดไม่ผ่าน)
 * Key       : 32 bytes อนุพันธ์จาก ENCRYPTION_KEY ใน .env (SHA-256)
 * Nonce/IV  : deterministic = HMAC-SHA256(key, plaintext) ตัด 12 bytes
 *             -> ค่าเดิมเข้ารหัสได้ค่าเดิมเสมอ
 *             -> ทำให้ unique constraint และการค้นหาด้วยค่าตรงกันยังทำงานได้
 *             (ข้อแลกเปลี่ยน: ค่าเท่ากันจะเห็นว่าเท่ากัน แต่ไม่รู้เนื้อหาข้างใน)
 *
 * รูปแบบที่จัดเก็บ: enc:v1:<iv_b64url>:<tag_b64url>:<ciphertext_b64url>
 */

const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'enc:v1:';
const IV_BYTES = 12;

let cachedKey: Buffer | null = null;

const getKey = (): Buffer => {
  if (cachedKey) return cachedKey;

  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('[encryption] ไม่พบ ENCRYPTION_KEY ใน .env');
  }

  // อนุพันธ์คีย์ 32 bytes จาก secret ความยาวเท่าไรก็ได้
  cachedKey = createHash('sha256').update(secret, 'utf8').digest();
  return cachedKey;
};

/** ตรวจว่าค่าถูกเข้ารหัสด้วย utility นี้แล้วหรือยัง */
export const isEncrypted = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith(PREFIX);

/** เข้ารหัส plaintext -> ciphertext (deterministic) */
export const encrypt = (plain: string): string => {
  const key = getKey();
  const iv = createHmac('sha256', key).update(plain, 'utf8').digest().subarray(0, IV_BYTES);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX + iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
};

/** ถอดรหัส ciphertext -> plaintext (ค่าที่ไม่ได้เข้ารหัสจะคืนค่าเดิม) */
export const decrypt = (value: string): string => {
  if (!isEncrypted(value)) return value;

  const [iv, tag, ciphertext] = value.slice(PREFIX.length).split(':');
  const key = getKey();

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
};
