import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateSupabaseConfig, getSupabaseConfig, SupabaseConfigError } from '../src/lib/supabase/config.ts';

const key = 'sb_publishable_localTest123';
const local = 'http://127.0.0.1:54321';
const cloud = 'https://project.supabase.co';
const dev = { nodeEnv: 'development', localTest: 'true' };
const reject = (url, value = key, policy = dev) => assert.throws(() => validateSupabaseConfig(url, value, policy), SupabaseConfigError);

test('only explicit development local mode permits exact loopback URLs', () => {
  for (const url of [local, local + '/']) assert.deepEqual(validateSupabaseConfig(url, key, dev), { url, key });
  for (const nodeEnv of ['production', 'test', undefined, '']) {
    for (const url of [local, cloud]) reject(url, key, { nodeEnv, localTest: 'true' });
  }
});
test('default and disabled policies retain HTTPS and publishable validation', () => {
  for (const localTest of [undefined, 'false', '', 'TRUE', '1']) {
    const policy = { nodeEnv: 'development', localTest };
    assert.equal(validateSupabaseConfig(cloud, key, policy).url, cloud);
    reject(local, key, policy);
  }
  assert.equal(validateSupabaseConfig(cloud, key).key, key);
});
test('local mode rejects cloud, alternate hosts, ports and URL normalization aliases', () => {
  for (const url of [cloud, 'https://127.0.0.1:54321', 'http://localhost:54321', 'http://[::1]:54321',
    'http://127.0.0.2:54321', 'http://127.0.0.1:54322', 'http://127.0.0.1',
    'http://127.1:54321', 'http://2130706433:54321', 'http://127.0.0.1:054321',
    local + '/x', local + '/x/..', local + '//', local + '?x=1', local + '#fragment', local + '?',
    'http://user:pass@127.0.0.1:54321', ' ' + local, local + '\n', undefined, 'invalid']) reject(url);
});
test('both modes reject secret, legacy, placeholder and malformed keys and URLs', () => {
  for (const policy of [dev, {}]) {
    const url = policy === dev ? local : cloud;
    reject(url, null, policy);
    assert.throws(() => validateSupabaseConfig(url, undefined, policy), SupabaseConfigError);
    for (const value of ['', 'sb_secret_private', 'eyJhbGciOiJIUzI1NiJ9.legacy',
      'sb_publishable_', ' sb_publishable_valid', 'sb_publishable_in valid', 'sb_publishable_example']) reject(url, value, policy);
    for (const invalid of ['https://user:pass@project.supabase.co', cloud + '/path', cloud + '?x=1', cloud + '#x']) reject(invalid, key, policy);
  }
});
test('environment adapter forwards runtime mode and local flag', () => {
  const names = ['NODE_ENV', 'SUPABASE_LOCAL_TEST', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];
  const old = names.map(name => process.env[name]);
  try {
    process.env.NODE_ENV = 'development'; process.env.SUPABASE_LOCAL_TEST = 'true';
    process.env.NEXT_PUBLIC_SUPABASE_URL = local; process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = key;
    assert.equal(getSupabaseConfig().url, local);
    process.env.NODE_ENV = 'production'; assert.throws(getSupabaseConfig, SupabaseConfigError);
    process.env.NODE_ENV = 'test'; assert.throws(getSupabaseConfig, SupabaseConfigError);
    process.env.SUPABASE_LOCAL_TEST = 'false'; process.env.NEXT_PUBLIC_SUPABASE_URL = cloud;
    assert.equal(getSupabaseConfig().url, cloud);
  } finally {
    names.forEach((name, index) => old[index] === undefined ? delete process.env[name] : process.env[name] = old[index]);
  }
});
