import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

// Compile real project sources with explicitly injected dependencies, never real Auth.
export function load(file, mocks = {}) {
  const source = readFileSync(new URL("../../" + file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const loaded = { exports: {} };
  runInNewContext(outputText, {
    module: loaded, exports: loaded.exports,
    process: { env: { NODE_ENV: "test" } },
    require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name),
  });
  return loaded.exports;
}
