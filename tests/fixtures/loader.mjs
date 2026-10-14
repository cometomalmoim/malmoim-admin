import ts from "typescript";

export default function sourceLoader(source) {
  if (this.resourcePath.endsWith(".css")) {
    return "const style=document.createElement('style');style.textContent=" + JSON.stringify(source) + ";document.head.appendChild(style);";
  }
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    fileName: this.resourcePath,
  }).outputText;
}
