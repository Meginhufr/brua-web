// How a picture fills its box, and how wide that draws it: the step before the selection rule, so a cover picture
// gets a file sharp enough for the size it is drawn at (fixtures/sizing, docs/superpowers/specs/2026-11-05-object-fit-design.md).
import type { AssetResponse } from "./types.ts";

export type ObjectFit = "contain" | "cover";

const POSITION = /^(100|[1-9]?[0-9])% (100|[1-9]?[0-9])%$/;

/** The fit to draw with: the call site's override, else the asset's, else contain. Unknown values are contain. */
export function objectFitOf(asset: Pick<AssetResponse, "objectFit">, override?: string): ObjectFit {
  const fit = override ?? asset.objectFit;
  return fit === "cover" ? "cover" : "contain";
}

/** Where the picture sits in its box, as "x% y%": the call site's, else the asset's, else the centre. */
export function objectPositionOf(asset: Pick<AssetResponse, "objectPosition">, override?: string): string {
  const position = override ?? asset.objectPosition;
  return position !== undefined && POSITION.test(position) ? position : "50% 50%";
}

/**
 * How wide the picture is drawn in a box of this size, in CSS pixels or points, for the selection rule's
 * `targetWidth`. Contain, or a box without a height yet, draws it at the box width; cover at the larger of the box
 * width and the box height times the asset's proportions.
 */
export function targetWidth(
  asset: Pick<AssetResponse, "width" | "height" | "objectFit">, boxWidth: number, boxHeight?: number, objectFit?: string,
): number {
  if (objectFitOf(asset, objectFit) !== "cover" || boxHeight === undefined || boxHeight <= 0 || asset.height <= 0) return boxWidth;
  return Math.max(boxWidth, boxHeight * (asset.width / asset.height));
}
