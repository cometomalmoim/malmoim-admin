import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import webpackPackage from "next/dist/compiled/webpack/webpack.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, ".next/profile-fixture");
await mkdir(output, { recursive: true });
const { webpack } = webpackPackage;
// A standalone test bundle, not an app route or an authentication bypass.
const compiler = webpack({
  mode: "development", devtool: false, target: "web",
  entry: path.join(root, "tests/fixtures/profile-entry.tsx"),
  output: { path: output, filename: "bundle.js" },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    alias: { "./logout-form$": path.join(root, "tests/fixtures/logout-stub.tsx") },
  },
  module: { rules: [{ test: /\.(tsx?|css)$/, use: [path.join(root, "tests/fixtures/loader.mjs")] }] },
});
await new Promise((resolve, reject) => compiler.run((error, stats) => {
  if (error || stats.hasErrors()) reject(error ?? new Error(stats.toString({ all: false, errors: true })));
  else resolve();
}));
await new Promise((resolve, reject) => compiler.close(error => error ? reject(error) : resolve()));
const bundle = await readFile(path.join(output, "bundle.js"));
const html = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>독립 프로필 UI 테스트</title><div id="root"></div><script src="/bundle.js"></script></html>';
const server = createServer(async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  if (request.url === "/") { response.setHeader("Content-Type", "text/html; charset=utf-8"); response.end(html); }
  else if (request.url === "/bundle.js") { response.setHeader("Content-Type", "application/javascript"); response.end(bundle); }
  else { response.statusCode = 404; response.end(); }
});
server.listen(3102, "0.0.0.0", () => console.log("Isolated profile UI fixture: http://localhost:3102 (no authentication)"));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
