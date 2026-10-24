import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encryptAccountPassword, decryptAccountPassword } from '../src/lib/external-account-crypto.ts';
import { renewalDays } from '../src/lib/external-account-types.ts';

test('password encryption uses random authenticated ciphertext and fails closed', () => {
  process.env.EXTERNAL_ACCOUNTS_ENCRYPTION_KEY = 'ab'.repeat(32);
  const password='한글 secret 123!';
  const encrypted=encryptAccountPassword(password);
  assert.equal(decryptAccountPassword(encrypted),password);
  assert.notEqual(encryptAccountPassword(password),encrypted);
  assert.ok(!encrypted.includes(password));
  const parts=encrypted.split('.'); parts[2]=Buffer.alloc(16).toString('base64');
  assert.throws(()=>decryptAccountPassword(parts.join('.')));
  process.env.EXTERNAL_ACCOUNTS_ENCRYPTION_KEY='cd'.repeat(32);
  assert.throws(()=>decryptAccountPassword(encrypted));
  delete process.env.EXTERNAL_ACCOUNTS_ENCRYPTION_KEY;
  assert.throws(()=>encryptAccountPassword(password));
});
test('renewal countdown handles D-7, today, overdue, year boundary and missing dates',()=>{
  assert.equal(renewalDays('2026-10-26','2026-10-19'),7);
  assert.equal(renewalDays('2026-10-19','2026-10-19'),0);
  assert.equal(renewalDays('2026-10-18','2026-10-19'),-1);
  assert.equal(renewalDays('2027-01-01','2026-12-31'),1);
  assert.equal(renewalDays(null,'2026-10-19'),null);
});
