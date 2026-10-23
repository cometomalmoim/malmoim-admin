import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function setup(count = 10) {
  let index = 0; const hooks = [];
  const react = { ...require('react'), useEffect() {}, useId: () => 'test-id',
    useState(initial) { const i = index++; if (!(i in hooks)) hooks[i] = initial; return [hooks[i], value => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value; }]; },
    useRef(initial) { const i = index++; return hooks[i] ??= { current: initial }; },
  };
  const loaded = { exports: {} };
  const { outputText } = ts.transpileModule(readFileSync(new URL('./history-photo-dialog.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
  runInNewContext(outputText, { exports: loaded.exports, module: loaded, Array, Math, require: name => name === 'react' ? react : name === 'next/image' ? { default: () => null } : name === './history-data' ? { displayDate: value => value } : require(name) });
  let closed = 0;
  const photo = { id: 'mock', category: 'regular', cohort: 9, title: '입력한 제목', date: '2026-01-01', description: '입력한 설명', src: 'blob:mock-cover', alt: '대표', additionalPhotos: Array.from({ length: count - 1 }, (_, i) => ({ src: `blob:mock-${i}`, alt: `추가 ${i}` })) };
  const flatten = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(flatten) : [node, ...flatten(node.props?.children)];
  function render() { index = 0; return flatten(loaded.exports.HistoryPhotoDialog({ photo, close: () => closed++ })); }
  function button(label) { return render().find(node => node.type === 'button' && node.props['aria-label'] === label); }
  const position = () => render().find(node => node.props?.role === 'status').props.children.join('');
  function swipe(dx, dy = 0, cancel = false) {
    const stage = render().find(node => node.props?.className === 'history-photo-stage');
    stage.props.onTouchStart({ touches: [{ identifier: 1, clientX: 100, clientY: 100 }] });
    if (cancel) stage.props.onTouchCancel();
    stage.props.onTouchEnd({ touches: [], changedTouches: [{ identifier: 1, clientX: 100 + dx, clientY: 100 + dy }] });
  }
  return { render, button, position, swipe, closed: () => closed };
}
test('10 photos expose thumbnails, position and entered activity information', () => {
  const view = setup(); const nodes = view.render();
  assert.equal(view.position(), '사진 1 / 10');
  assert.equal(nodes.filter(node => node.props?.['aria-label']?.endsWith('번 사진 보기')).length, 10);
  for (const text of ['입력한 제목', '입력한 설명', '2026-01-01']) assert.ok(nodes.some(node => node.props?.children === text));
});
test('arrows and thumbnails navigate; first and last wrap', () => {
  const view = setup(); view.button('이전 사진').props.onClick(); assert.equal(view.position(), '사진 10 / 10');
  view.button('다음 사진').props.onClick(); assert.equal(view.position(), '사진 1 / 10');
  view.button('5번 사진 보기').props.onClick(); assert.equal(view.position(), '사진 5 / 10');
});
test('horizontal swipes navigate, vertical/short/cancelled gestures do not', () => {
  const view = setup(); view.swipe(-60); assert.equal(view.position(), '사진 2 / 10');
  view.swipe(60); assert.equal(view.position(), '사진 1 / 10');
  view.swipe(-20); view.swipe(-60, 100); view.swipe(-60, 0, true); assert.equal(view.position(), '사진 1 / 10');
});
test('keyboard arrows navigate and do not bubble to a parent dialog', () => {
  const view = setup(); let prevented = false; let stopped = false;
  view.render()[0].props.onKeyDown({ key: 'ArrowRight', preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
  assert.ok(prevented && stopped); assert.equal(view.position(), '사진 2 / 10');
});
test('close button and native Escape cancellation call close', () => {
  const view = setup();
  view.render().find(node => node.type === 'button' && node.props.children === '닫기').props.onClick();
  view.render()[0].props.onCancel({ preventDefault() {} }); assert.equal(view.closed(), 2);
});
test('one photo has no navigation buttons and ignores swipe', () => {
  const view = setup(1); assert.equal(view.button('다음 사진'), undefined);
  view.swipe(-80); assert.equal(view.position(), '사진 1 / 1');
});
