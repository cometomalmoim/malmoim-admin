import assert from 'node:assert/strict';
import { test } from 'node:test';
import { peopleInput } from '../src/lib/people-validation.ts';
const form = () => { const f = new FormData(); f.set('name', ' 운영진 '); return f; };
test('profile requires name and enforces field limits', () => {
  assert.throws(() => peopleInput(new FormData()));
  const f = form(); assert.equal(peopleInput(f).name, '운영진');
  f.set('bio', 'a'.repeat(5001)); assert.throws(() => peopleInput(f));
});
test('reject unsafe photo URLs, invalid emails and non-Instagram links', () => {
  for (const [key, value] of [['photo_url', 'javascript:alert(1)'], ['photo_url', 'https://user:secret@example.com'], ['email', 'bad'], ['instagram', 'https://evil.com/instagram.com']]) {
    const f = form(); f.set(key, value); assert.throws(() => peopleInput(f));
  }
  const f = form(); f.set('instagram', 'https://www.instagram.com/malmoim/'); assert.ok(peopleInput(f).instagram);
});
test('reject forged relation IDs and deduplicate links', () => {
  const f = form(); f.append('event_ids', 'fake'); assert.throws(() => peopleInput(f));
  f.delete('event_ids');
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  f.append('event_ids', id); f.append('event_ids', id); assert.deepEqual(peopleInput(f).event_ids, [id]);
});
