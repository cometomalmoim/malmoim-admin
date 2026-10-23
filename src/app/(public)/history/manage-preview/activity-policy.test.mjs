import { policyModule } from '../../../../lib/history-activities/photo-policy.test-support.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const loaded = { exports: {} };
let decodes = 0;
const { outputText } = ts.transpileModule(readFileSync(new URL('./activity-types.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
runInNewContext(outputText, { exports: loaded.exports, module: loaded, Date, Uint8Array, require: name => { assert.ok(name.endsWith("photo-policy")); return policyModule; }, createImageBitmap: async () => { decodes++; return { close() {} }; } });
const { validatePhotoSelection, validatePhotoFiles } = loaded.exports;
const MB = 1024 * 1024;
const jpg = size => ({ size, type: 'image/jpeg', slice: () => ({ arrayBuffer: async () => Uint8Array.from([255,216,255,0,0,0,0,0,0,0,0,0]).buffer }) });
test('10 photos at 4.5MB each are allowed; 11 are rejected', async () => {
  assert.equal(validatePhotoSelection(10, 45 * MB), '');
  assert.equal(await validatePhotoFiles(Array.from({ length: 10 }, () => jpg(4.5 * MB))), '');
  assert.match(validatePhotoSelection(11, 11), /10장/);
});
test('45MB boundary is inclusive; one byte over is rejected', () => {
  assert.equal(validatePhotoSelection(10, 45 * MB - 1), '');
  assert.equal(validatePhotoSelection(10, 45 * MB), '');
  assert.match(validatePhotoSelection(10, 45 * MB + 1), /45MB/);
});
test('per-photo 4.5MB boundary is inclusive and oversized files stop before decoding', async () => {
  assert.equal(await validatePhotoFiles([jpg(4.5 * MB - 1)]), '');
  assert.equal(await validatePhotoFiles([jpg(4.5 * MB)]), '');
  const before = decodes;
  assert.match(await validatePhotoFiles([jpg(4.5 * MB + 1)]), /4.5MB/);
  assert.equal(decodes, before);
  assert.match(await validatePhotoFiles([jpg(0)]), /빈 파일/);
});
test('activity adapter retains representative plus all 9 additional photos in order', () => {
  const activity = { id: 'mock', category: 'regular', cohort: 9, title: '입력 제목', date: '2026-01-01', description: '입력 설명', cover: { url: 'blob:cover', alt: '대표' }, additional: Array.from({ length: 9 }, (_, i) => ({ url: `blob:${i}`, alt: `사진 ${i}` })) };
  const photo = loaded.exports.toHistoryPhoto(activity);
  assert.equal(photo.src, 'blob:cover'); assert.equal(photo.additionalPhotos.length, 9);
  assert.equal(photo.additionalPhotos[8].src, 'blob:8');
  assert.equal(photo.title, activity.title); assert.equal(photo.description, activity.description);
});
test('shared activity policy uses exact binary byte limits independently of display labels',()=>{
 assert.equal(policyModule.activityPhotoPolicy.maxFiles,10);
 assert.equal(policyModule.activityPhotoPolicy.maxBytes,4_718_592);
 assert.equal(policyModule.activityPhotoPolicy.totalBytes,47_185_920);
});
