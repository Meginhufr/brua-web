import type { AssetResponse, AssetVariant, ClientState } from "./types.ts";

const KNOWN_COLOR_SCHEMES = new Set(["light", "dark"]);
const KNOWN_REDUCED_MOTION = new Set(["reduce"]);

/** The variant selection rule (SPEC.md 7.3, fixtures/README.md). Returns the URL to load. */
export function selectUrl(asset: AssetResponse, client: ClientState): string {
  return selectVariant(asset, client)?.url ?? asset.url;
}

export function selectVariant(asset: AssetResponse, client: ClientState): AssetVariant | undefined {
  // 1. Usable: a supported type, and no value this client doesn't know.
  let candidates = asset.variants.filter(
    (v) =>
      client.supportedTypes.includes(v.type) &&
      (v.prefersColorScheme === undefined || KNOWN_COLOR_SCHEMES.has(v.prefersColorScheme)) &&
      (v.prefersReducedMotion === undefined || KNOWN_REDUCED_MOTION.has(v.prefersReducedMotion)),
  );

  // 2. Motion.
  const reduced = candidates.filter((v) => v.prefersReducedMotion === "reduce");
  const moving = candidates.filter((v) => v.prefersReducedMotion === undefined);
  if (client.reducedMotion) {
    if (reduced.length > 0) candidates = reduced;
  } else if (moving.length > 0) {
    candidates = moving;
  }

  // 3. Color scheme.
  candidates = firstNonEmpty(
    candidates.filter((v) => v.prefersColorScheme === client.colorScheme),
    candidates.filter((v) => v.prefersColorScheme === undefined),
    candidates.filter((v) => v.prefersColorScheme === "light"),
    candidates,
  );

  // 4. Language.
  candidates = firstNonEmpty(
    candidates.filter((v) => v.lang !== undefined && v.lang === asset.lang),
    candidates.filter((v) => v.lang === undefined),
    candidates,
  );

  // 5. Type.
  const type = client.supportedTypes.find((t) => candidates.some((v) => v.type === t));
  candidates = candidates.filter((v) => v.type === type);
  if (candidates.length === 0) return undefined;

  // 6. Size.
  if (candidates.some((v) => v.scale !== undefined)) {
    return pickAtLeast(candidates, (v) => v.scale ?? 1, client.scale);
  }
  if (candidates.some((v) => v.pixelWidth !== undefined)) {
    const need = client.targetWidth === undefined ? Infinity : client.targetWidth * client.scale;
    return pickAtLeast(candidates, (v) => v.pixelWidth ?? 0, need);
  }
  return candidates[0];
}

function firstNonEmpty<T>(...lists: T[][]): T[] {
  return lists.find((list) => list.length > 0) ?? [];
}

/** The smallest value at or above `target`, else the largest. */
function pickAtLeast(variants: AssetVariant[], value: (v: AssetVariant) => number, target: number): AssetVariant {
  const sorted = [...variants].sort((a, b) => value(a) - value(b));
  return sorted.find((v) => value(v) >= target) ?? sorted[sorted.length - 1];
}
