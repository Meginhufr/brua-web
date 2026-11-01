import type { ClientState } from "./types.ts";

export interface ClientOptions {
  /** Media types the page can show, most preferred first. The default leaves AVIF out, since support can't be read synchronously. */
  supportedTypes?: string[];
  /** Displayed width in CSS pixels, for flexible assets. */
  targetWidth?: number;
}

const DEFAULT_TYPES = ["image/webp", "image/png", "image/jpeg", "image/svg+xml"];

/** The client state when nothing can be read, such as on a server: light, 1x, no reduced motion. */
export function defaultClientState(options: ClientOptions = {}): ClientState {
  return {
    supportedTypes: options.supportedTypes ?? DEFAULT_TYPES,
    colorScheme: "light",
    reducedMotion: false,
    scale: 1,
    targetWidth: options.targetWidth,
  };
}

/** The browser's current appearance, motion setting and pixel density, for the selection rule (SPEC.md 7.3). */
export function browserClientState(options: ClientOptions = {}): ClientState {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return defaultClientState(options);
  return {
    supportedTypes: options.supportedTypes ?? DEFAULT_TYPES,
    colorScheme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    scale: window.devicePixelRatio || 1,
    targetWidth: options.targetWidth,
  };
}

/**
 * Calls back with the browser's client state now and whenever the appearance, motion setting or pixel
 * density changes (a window moved to another screen). Returns a function that stops watching.
 */
export function watchClientState(callback: (state: ClientState) => void, options: ClientOptions = {}): () => void {
  callback(browserClientState(options));
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};

  const queries = [
    window.matchMedia("(prefers-color-scheme: dark)"),
    window.matchMedia("(prefers-reduced-motion: reduce)"),
  ];
  const notify = () => callback(browserClientState(options));
  for (const query of queries) query.addEventListener("change", notify);

  // The density has no event of its own: a query that matches only the current value stops matching when it changes.
  let density = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  const onDensity = () => {
    density.removeEventListener("change", onDensity);
    density = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    density.addEventListener("change", onDensity);
    notify();
  };
  density.addEventListener("change", onDensity);

  return () => {
    for (const query of queries) query.removeEventListener("change", notify);
    density.removeEventListener("change", onDensity);
  };
}
