// The browser's client state for the selection rule, and watching it change.
import { test } from "node:test";
import assert from "node:assert/strict";
import { browserClientState, defaultClientState, watchClientState } from "../src/client.ts";

function fakeWindow(dark: boolean, reduce: boolean, dpr: number) {
  const listeners = new Map<string, Set<() => void>>();
  const matchMedia = (query: string) => ({
    matches: query.includes("dark") ? dark : query.includes("reduce") ? reduce : query === `(resolution: ${dpr}dppx)`,
    addEventListener: (_: string, fn: () => void) => { (listeners.get(query) ?? listeners.set(query, new Set()).get(query)!).add(fn); },
    removeEventListener: (_: string, fn: () => void) => { listeners.get(query)?.delete(fn); },
  });
  return { window: { matchMedia, devicePixelRatio: dpr }, fire: (query: string) => { for (const fn of listeners.get(query) ?? []) fn(); }, listeners };
}

test("without a window the state is light, 1x and not reduced", () => {
  assert.deepEqual(defaultClientState({ targetWidth: 200 }), { supportedTypes: ["image/webp", "image/png", "image/jpeg", "image/svg+xml"], colorScheme: "light", reducedMotion: false, scale: 1, targetWidth: 200 });
  assert.deepEqual(browserClientState(), defaultClientState());
});

test("a browser's appearance, motion and density are read, and changes are watched", () => {
  const fake = fakeWindow(true, true, 2);
  (globalThis as any).window = fake.window;
  try {
    assert.deepEqual(browserClientState({ supportedTypes: ["image/avif"] }), { supportedTypes: ["image/avif"], colorScheme: "dark", reducedMotion: true, scale: 2, targetWidth: undefined });

    const seen: string[] = [];
    const stop = watchClientState((state) => seen.push(`${state.colorScheme} ${state.reducedMotion} ${state.scale}`));
    assert.deepEqual(seen, ["dark true 2"], "called once right away");

    fake.window.devicePixelRatio = 3;
    fake.fire("(resolution: 2dppx)");
    assert.equal(seen.at(-1), "dark true 3", "a density change is noticed through the resolution query");

    stop();
    fake.fire("(prefers-color-scheme: dark)");
    assert.equal(seen.length, 2, "nothing after stopping");
    assert.ok([...fake.listeners.values()].every((set) => set.size === 0), "every listener is removed");
  } finally {
    delete (globalThis as any).window;
  }
});
