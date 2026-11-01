// The Svelte component is shipped as source next to the compiled modules; this is its shape for the build.
declare module "*.svelte" {
  import type { Component } from "svelte";
  const component: Component<Record<string, unknown>>;
  export default component;
}
