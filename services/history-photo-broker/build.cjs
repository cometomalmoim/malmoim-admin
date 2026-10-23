/* eslint-disable @typescript-eslint/no-require-imports -- Standalone photo broker CommonJS entry point. */
// Build only: Node runtime never needs TypeScript or a Next.js runtime.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),ts=require('typescript');
const root=path.resolve(__dirname,'../..'),out=process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(path.join(os.tmpdir(),'malmoim-photo-broker-build-'));
fs.mkdirSync(out,{recursive:true});
for(const name of ['service-handler','broker-https','broker-oidc','verified-finalization','limited-storage','photo-policy','server-capabilities','server-db','server-receipts','receipt-generations','storage-token-issuer','broker-composition']){
 // server-only is a Next.js bundler marker. This output runs ONLY in a Node service.
 const source=fs.readFileSync(path.join(root,'src/lib/history-activities',name+'.ts'),'utf8').replace(/^import ["']server-only["'];?\r?\n/gm,'');
 fs.writeFileSync(path.join(out,name+'.js'),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
}
console.log(JSON.stringify({bundle:out}));
