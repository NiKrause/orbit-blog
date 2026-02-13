// Browser shim for @protobufjs/inquire.
// The real module uses eval("require") to optionally load Node deps, which triggers
// an esbuild "direct-eval" warning during Vite builds. In the browser bundle,
// returning null is acceptable: callers treat missing optional deps as "not available".
export default function inquire(_moduleName: string): null {
  return null
}

