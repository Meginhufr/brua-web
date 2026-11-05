/** The asset contract (SPEC.md 5): the HTML picture model as JSON. */
export interface AssetResponse {
  id: string;
  version: number;
  url: string;
  width: number;
  height: number;
  alt: string;
  lang?: string;
  variants: AssetVariant[];
  /** How a layout's box of another shape holds the asset, as CSS object-fit: "contain" or "cover". */
  objectFit?: string;
  /** Where it sits in the box, as CSS object-position: "50% 35%", the point a cover crop keeps in view. */
  objectPosition?: string;
}

/**
 * Why a picture has none to show, with the same reasons on every platform's SDK: nothing is released under the id (the
 * edge answered 404, usually draw nothing), the edge can't be reached and no release is known, or the file failed.
 */
export type BruaImageError =
  | { reason: "notReleased" }
  | { reason: "unreachable"; cause: unknown }
  | { reason: "file"; url: string };

/** Value fields are plain strings, not unions, so new values from the API never break decoding (SPEC.md 14). */
export interface AssetVariant {
  type: string;
  url: string;
  prefersColorScheme?: string;
  prefersReducedMotion?: string;
  lang?: string;
  scale?: number;
  pixelWidth?: number;
}

export interface ClientState {
  /** Media types the client can render, most preferred first. */
  supportedTypes: string[];
  colorScheme: "light" | "dark";
  reducedMotion: boolean;
  /** Device pixels per CSS pixel. */
  scale: number;
  /** Displayed width in CSS pixels, for flexible assets. */
  targetWidth?: number;
}
