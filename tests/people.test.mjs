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
  const f = form(); f.set('instagram', '@malmoim'); assert.equal(peopleInput(f).instagram, 'https://www.instagram.com/malmoim/');
  f.set('instagram', 'malmoim.official'); assert.equal(peopleInput(f).instagram, 'https://www.instagram.com/malmoim.official/');
  f.set('instagram', '@bad/name'); assert.throws(() => peopleInput(f));
});
test('uploaded photo paths and file types are validated', async () => {
  const { photoExtension, PHOTO_LIMIT } = await import('../src/lib/people-photo.ts');
  assert.equal(photoExtension(new Uint8Array([255,216,255,0]), 'image/jpeg'), 'jpg');
  assert.equal(photoExtension(new Uint8Array([137,80,78,71,13,10,26,10]), 'image/png'), 'png');
  assert.throws(() => photoExtension(new TextEncoder().encode('<svg/>'), 'image/png'));
  assert.throws(() => photoExtension(new Uint8Array(PHOTO_LIMIT + 1), 'image/jpeg'));
  const f = form(); f.set('photo_url', '/api/admin/people/photos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg');
  assert.equal(peopleInput(f).photo_url, f.get('photo_url'));
  f.set('photo_url', '/api/admin/people/photos/../../private'); assert.throws(() => peopleInput(f));
});
test('reject forged relation IDs and deduplicate links', () => {
  const f = form(); f.append('event_ids', 'fake'); assert.throws(() => peopleInput(f));
  f.delete('event_ids');
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  f.append('event_ids', id); f.append('event_ids', id); assert.deepEqual(peopleInput(f).event_ids, [id]);
});
