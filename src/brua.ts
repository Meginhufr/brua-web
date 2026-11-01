// Reading assets from the edge by id (SPEC.md 5.3): the page holds a reference, Brua decides which version is live.
import type { AssetResponse } from "./types.ts";

export interface BruaOptions {
  /** The organization's asset prefix on the edge, such as https://cdn.brua.dev/assets/{org}. */
  base: string;
  /** The language for alt text and language-specific files; left out, the browser's Accept-Language decides. */
  lang?: string;
  /** How long a fetched asset is reused before it is asked for again, in milliseconds: the edge's own minute by default. */
  maxAge?: number;
  /** The fetch to use; the global one by default. */
  fetch?: typeof fetch;
}

/** Assets by id from the edge, with no key and no backend: each id costs one small request a minute at most. */
export interface Brua {
  /** The JSON URL of the asset's current release. */
  url(id: string): string;
  /** The asset's current release, or undefined when the id is unknown or nothing is released. */
  asset(id: string): Promise<AssetResponse | undefined>;
}

export function createBrua(options: BruaOptions): Brua {
  const base = options.base.replace(/\/+$/, "");
  const maxAge = options.maxAge ?? 60_000;
  const query = options.lang ? `?lang=${encodeURIComponent(options.lang)}` : "";
  const held = new Map<string, { at: number; result: Promise<AssetResponse | undefined> }>();

  const url = (id: string) => `${base}/${encodeURIComponent(id)}.json${query}`;

  return {
    url,
    asset(id) {
      const now = Date.now();
      const have = held.get(id);
      if (have && now - have.at < maxAge) return have.result;

      const request = options.fetch ?? fetch;
      const result = request(url(id)).then(async (response) => {
        if (response.status === 404) return undefined;
        if (!response.ok) throw new Error(`Brua: ${id} answered ${response.status}`);
        return (await response.json()) as AssetResponse;
      });
      held.set(id, { at: now, result });
      // A failure is asked again next time, not remembered for a minute.
      result.catch(() => {
        if (held.get(id)?.result === result) held.delete(id);
      });
      return result;
    },
  };
}
