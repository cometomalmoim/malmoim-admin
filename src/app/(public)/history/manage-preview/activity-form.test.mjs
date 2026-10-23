import { policyModule } from '../../../../lib/history-activities/photo-policy.test-support.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const loaded = { exports: {} };
  const { outputText } = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
  runInNewContext(outputText, { exports: loaded.exports, module: loaded, Date, Uint8Array, createImageBitmap: async () => ({ close() {} }), require: key => key.endsWith('photo-policy') ? policyModule : key in mocks ? mocks[key] : require(key) });
  return loaded.exports;
}
test('actual file-input handler adds 9 previews, saves 10 photos, then rejects the 11th', async () => {
  let index = 0; const hooks = []; let saved;
  const react = { ...require('react'), useEffect() {}, useState(initial) { const i = index++; if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial; return [hooks[i], value => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value; }]; }, useRef(initial) { const i = index++; return hooks[i] ??= { current: initial }; } };
  const { ActivityForm } = load('./activity-form.tsx', { react, 'next/image': { default: () => null }, './activity-dialog': { ActivityDialog: () => null }, './activity-types': load('./activity-types.ts') });
  const activity = { id: 'mock', category: 'regular', cohort: 9, title: '제목', date: '2026-01-01', description: '설명', cover: { id: 'cover', url: 'blob:cover', name: '대표', alt: '대표', size: 10 }, additional: [] };
  const flatten = n => !n || typeof n !== 'object' ? [] : Array.isArray(n) ? n.flatMap(flatten) : [n, ...flatten(n.props?.children)];
  const render = () => { index = 0; return flatten(ActivityForm({ activity, close() {}, save(item) { saved = item; }, release() {}, makeAsset: file => ({ id: file.name, url: `blob:${file.name}`, name: file.name, alt: file.name, size: file.size }) })); };
  const file = i => ({ name: `mock-${i}.jpg`, size: 10, type: 'image/jpeg', slice: () => ({ arrayBuffer: async () => Uint8Array.from([255,216,255]).buffer }) });
  async function select(files) {
    const input = render().find(n => n.props?.id === 'activity-additional');
    const target = { files, value: 'mock-selection' }; input.props.onChange({ target });
    assert.equal(target.value, ''); await new Promise(resolve => setImmediate(resolve));
  }
  await select(Array.from({ length: 9 }, (_, i) => file(i)));
  assert.equal(render().filter(n => n.type === 'figure' && n.props.className === 'activity-asset').length, 10);
  render().find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(saved.additional.length, 9);
  await select([file(10)]);
  const nodes = render();
  assert.ok(nodes.some(n => n.props?.role === 'alert' && /전체 10장/.test(n.props.children)));
  assert.equal(nodes.filter(n => n.type === 'figure' && n.props.className === 'activity-asset').length, 10);
});
