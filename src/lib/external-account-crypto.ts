import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function key() {
  const value = process.env.EXTERNAL_ACCOUNTS_ENCRYPTION_KEY ?? '';
  if (!/^[a-f\d]{64}$/i.test(value)) throw new Error('계정 암호화 키 설정을 확인해주세요.');
  return Buffer.from(value, 'hex');
}
export function encryptAccountPassword(password: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
}
export function decryptAccountPassword(value: string) {
  const [version, iv, tag, ciphertext] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !ciphertext) throw new Error('Invalid ciphertext');
  const cipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  cipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([cipher.update(Buffer.from(ciphertext, 'base64')), cipher.final()]).toString('utf8');
}
