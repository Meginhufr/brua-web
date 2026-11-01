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
}

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
