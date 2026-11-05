// Reading assets from the edge by id (SPEC.md 5.3): the page holds a reference, Brua decides which version is live.
import type { AssetResponse } from "./types.ts";

export interface BruaOptions {
  /** The organization's asset prefix on the edge, such as https://cdn.brua.dev/assets/{org}. */
  base: string;
  /** The language for alt text and language-specific files; left out, the browser's languages decide. */
  lang?: string;
  /** How long a fetched asset is reused before it is asked for again, in milliseconds; by default the edge's max-age. */
  maxAge?: number;
  /** The fetch to use; the global one by default. */
  fetch?: typeof fetch;
}

/**
 * Assets by id from the edge, with no key and no backend. Every release read is remembered: answered from memory for
 * the edge's minute, asked for again after that, and kept when the edge can't be reached, so a merge lands within
 * the minute and a page that loses its connection keeps its images.
 */
export interface Brua {
  /** The JSON URL of the asset's current release. */
  url(id: string): string;
  /**
   * The asset's current release, or undefined when the id is unknown or nothing is released. Reads of one id at the
   * same time share a request. Rejects only when the edge can't be reached and no release of the id is known.
   */
  asset(id: string): Promise<AssetResponse | undefined>;
  /** The last release of the id this Brua has read, however old, or undefined: for a component's first render. */
  cachedAsset(id: string): AssetResponse | undefined;
  /** Reads these ids at the same time, so a list's pictures render at once when it appears. */
  prefetch(ids: string[]): Promise<void>;
}

interface Entry {
  asset: AssetResponse | undefined;
  freshUntil: number;
}

/** "nb-NO, en;q=0.9": the browser's languages in order, with falling quality values, as the edge reads ?lang=. */
function acceptLanguage(languages: readonly string[]): string {
  return languages.slice(0, 5).map((language, index) => (index === 0 ? language : `${language};q=${(1 - index * 0.1).toFixed(1)}`)).join(", ");
}

/** The edge's max-age in milliseconds, or undefined when the response doesn't say. */
function maxAgeOf(response: Response): number | undefined {
  const match = /(?:^|,)\s*max-age\s*=\s*(\d+)/i.exec(response.headers.get("Cache-Control") ?? "");
  return match ? Number(match[1]) * 1000 : undefined;
}

export function createBrua(options: BruaOptions): Brua {
  const base = options.base.replace(/\/+$/, "");
  const entries = new Map<string, Entry>();
  const reads = new Map<string, Promise<Entry>>();

  // Without a language, the browser's languages go in the query (in a browser only, not on a server), so each has
  // its own entry here and in the HTTP cache, the same as the other SDKs.
  const languages = () => options.lang ?? (typeof window !== "undefined" && typeof navigator !== "undefined" ? acceptLanguage(navigator.languages ?? []) : "");
  const url = (id: string) => {
    const lang = languages();
    return `${base}/${encodeURIComponent(id)}.json${lang ? `?lang=${encodeURIComponent(lang)}` : ""}`;
  };

  const read = async (id: string, at: string): Promise<Entry> => {
    const response = await (options.fetch ?? fetch)(at);
    const freshFor = options.maxAge ?? maxAgeOf(response) ?? 60_000;
    if (response.status === 404) return { asset: undefined, freshUntil: Date.now() + freshFor };
    if (!response.ok) throw new Error(`Brua: ${id} answered ${response.status}`);
    return { asset: (await response.json()) as AssetResponse, freshUntil: Date.now() + freshFor };
  };

  const brua: Brua = {
    url,
    async asset(id) {
      const at = url(id);
      const known = entries.get(at);
      if (known && Date.now() < known.freshUntil) return known.asset;

      let running = reads.get(at);
      if (!running) {
        running = read(id, at).then(
          (entry) => { entries.set(at, entry); return entry; },
        ).finally(() => reads.delete(at));
        reads.set(at, running);
      }
      try {
        return (await running).asset;
      } catch (error) {
        const kept = entries.get(at);
        if (kept) return kept.asset;
        throw error;
      }
    },
    cachedAsset(id) {
      return entries.get(url(id))?.asset;
    },
    async prefetch(ids) {
      await Promise.all([...new Set(ids)].map((id) => brua.asset(id).catch(() => undefined)));
    },
  };
  return brua;
}
