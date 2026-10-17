import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName, PDFString, degrees } from 'pdf-lib';
import { constrainRect, parseSettings, toDisplay, toPdf } from '../src/lib/pdf-fields.ts';
import { validateFieldPdf } from '../src/lib/pdf-fields-validation.ts';

const viewBox = [20, 30, 420, 630];
const pages = [
  { rotation: 0, width: 400, height: 600, transform: [1, 0, 0, -1, -20, 630] },
  { rotation: 90, width: 600, height: 400, transform: [0, 1, 1, 0, -30, -20] },
  { rotation: 180, width: 400, height: 600, transform: [-1, 0, 0, 1, 420, -30] },
  { rotation: 270, width: 600, height: 400, transform: [0, -1, -1, 0, 630, 420] },
].map((p, i) => ({ ...p, pageNumber: i + 1, viewBox, userUnit: 1 }));
const fingerprint = 'a'.repeat(64);
const close = (a, b) => { for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(a[key] - b[key]) < 1e-8, key); };

test('PDF rotation 0/90/180/270 + offset crop: display/PDF roundtrip and exact placement', () => {
  const original = { x: 60, y: 150, width: 100, height: 60 };
  close(toDisplay(original, pages[0]), { x: .1, y: .7, width: .25, height: .1 });
  close(toDisplay(original, pages[1]), { x: .2, y: .1, width: .1, height: .25 });
  for (const p of pages) close(toPdf(toDisplay(original, p), p), original);
});
test('UserUnit scaling preserves original PDF units and zoom-independent normalized geometry', () => {
  const p = { ...pages[1], userUnit: 2, width: 1200, height: 800, transform: pages[1].transform.map(n => n * 2) };
  const r = { x: .12, y: .21, width: .3, height: .08 };
  close(toDisplay(toPdf(r, p), p), r);
  close(toPdf(r, p), toPdf(r, pages[1]));
});
test('movement/resize clamps to page and minimum field size', () => {
  assert.deepEqual(constrainRect({ x: -1, y: 2, width: .3, height: .1 }), { x: 0, y: .9, width: .3, height: .1 });
  const r = constrainRect({ x: .99, y: .99, width: -4, height: 3 });
  assert.equal(r.width, .015); assert.equal(r.height, 1); assert.equal(r.y, 0); assert.ok(r.x + r.width <= 1);
});
test('settings restore exact same document and preserve page-specific multiple fields', () => {
  const fields = pages.flatMap(p => [1, 2].map(n => ({ id: `p${p.pageNumber}-${n}`, pageNumber: p.pageNumber, rect: toPdf({ x: .1 * n, y: .2, width: .2, height: .1 }, p) })));
  assert.deepEqual(parseSettings(JSON.stringify({ version: 1, fingerprint, pages, fields }), fingerprint, pages), fields);
});
test('settings reject different document/page metadata, duplicate IDs, invalid pages and bounds', () => {
  const field = { id: 'one', pageNumber: 1, rect: toPdf({ x: .1, y: .2, width: .2, height: .1 }, pages[0]) };
  const valid = { version: 1, fingerprint, pages, fields: [field] };
  for (const v of [null, { ...valid, version: 2 }, { ...valid, fingerprint: 'b' }, { ...valid, pages: [] }, { ...valid, fields: [field, field] }, { ...valid, fields: [{ ...field, pageNumber: 9 }] }, { ...valid, fields: [{ ...field, rect: { x: -500, y: 0, width: 50, height: 50 } }] }, { ...valid, fields: Array(201).fill(field) }, { ...valid, fields: [{ ...field, rect: { ...field.rect, width: 0 } }] }]) assert.throws(() => parseSettings(JSON.stringify(v), fingerprint, pages));
  assert.throws(() => parseSettings(' '.repeat(200001), fingerprint, pages));
});
test('valid rotated multi-page PDFs accepted, including blank OS MIME', async () => {
  const doc = await PDFDocument.create();
  for (const rotation of [0, 90, 180, 270]) doc.addPage([500, 700]).setRotation(degrees(rotation));
  const bytes = await doc.save();
  await validateFieldPdf('sample.pdf', 'application/pdf', bytes);
  await validateFieldPdf('sample.PDF', '', bytes);
});
test('reject wrong file format, empty/oversized/broken/truncated PDF and >50 pages', async () => {
  const doc = await PDFDocument.create(); doc.addPage(); const valid = await doc.save();
  for (const [name, mime, bytes] of [['a.png', 'application/pdf', valid], ['a.pdf', 'image/png', valid], ['a.pdf', '', new Uint8Array()], ['a.pdf', '', new Uint8Array(5242881)], ['a.pdf', '', new TextEncoder().encode('%PDF-1.7 garbage %%EOF')], ['a.pdf', '', valid.slice(0, -100)]]) await assert.rejects(() => validateFieldPdf(name, mime, bytes));
  for (let i = 1; i < 51; i++) doc.addPage();
  await assert.rejects(() => doc.save().then(bytes => validateFieldPdf('a.pdf', '', bytes)), /50/);
});
test('reject encryption dictionary and executable content (including escaped names)', async () => {
  const action = await PDFDocument.create(); action.addPage();
  action.catalog.set(PDFName.of('OpenAction'), action.context.obj({ S: 'JavaScript', JS: PDFString.of('alert(1)') }));
  await assert.rejects(() => action.save().then(b => validateFieldPdf('a.pdf', '', b)));
  const escaped = await PDFDocument.create(); escaped.addPage();
  escaped.context.register(escaped.context.obj({ S: PDFName.of('J#61vaScript') }));
  await assert.rejects(() => escaped.save({ useObjectStreams: false }).then(b => validateFieldPdf('a.pdf', '', b)));
  const encrypted = await PDFDocument.create(); encrypted.addPage();
  encrypted.context.trailerInfo.Encrypt = encrypted.context.register(encrypted.context.obj({ Filter: 'Standard', V: 1, R: 2 }));
  await assert.rejects(() => encrypted.save().then(b => validateFieldPdf('a.pdf', '', b)), /암호화/);
});
