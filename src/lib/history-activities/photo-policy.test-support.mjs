import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const loaded={exports:{}};
const {outputText}=ts.transpileModule(readFileSync(new URL('./photo-policy.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
runInNewContext(outputText,{module:loaded,exports:loaded.exports});
export const policyModule=loaded.exports;
