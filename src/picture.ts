import type { AssetResponse, AssetVariant } from "./types.ts";
import { objectFitOf, objectPositionOf } from "./sizing.ts";

export interface PictureOptions {
  /** The `sizes` attribute for flexible assets; defaults to the asset's width in CSS pixels. */
  sizes?: string;
  loading?: "lazy" | "eager";
  className?: string;
  /**
   * "light" or "dark" to render that scheme's files only, for apps that switch themes themselves. Left out,
   * the dark files go behind a media query and the browser follows the system setting.
   */
  colorScheme?: "light" | "dark";
  /**
   * How the img fills its box: "contain" or "cover" overrides the asset's own fit, and "none" leaves the fit and
   * the position to the page's CSS. Left out, the asset's fit is used.
   */
  objectFit?: "contain" | "cover" | "none";
  /** Where the img sits in its box, as "x% y%"; left out, the asset's position. */
  objectPosition?: string;
}

/** A `<source>` of the picture: one format, optionally one color scheme. */
export interface PictureSource {
  type: string;
  media?: string;
  srcset: string;
  sizes?: string;
}

/** The `<img>` fallback and its attributes. */
export interface PictureImage {
  src: string;
  srcset?: string;
  sizes?: string;
  width: number;
  height: number;
  alt: string;
  lang?: string;
  loading: "lazy" | "eager";
  decoding: "async";
  className?: string;
  /** The object-fit and object-position the img is drawn with, when the asset or the call site gives a fill. */
  objectFit?: "contain" | "cover";
  objectPosition?: string;
}

/** What a picture element for the asset consists of; the HTML renderer and the framework components build from it. */
export interface PictureModel {
  sources: PictureSource[];
  img: PictureImage;
}

const SVG = "image/svg+xml";

/** Formats offered as <source> elements, best first; anything else becomes the <img> fallback. */
const SOURCE_TYPES = ["image/avif", "image/webp"];

/**
 * The picture for an asset (SPEC.md 7.2): dark-mode sources behind a media query, modern formats as
 * sources, and alt, lang, width and height on the img. The browser picks the variant, so this works
 * without client hints and switches live with the color scheme. Animations aren't rendered; their stills are.
 */
export function pictureModel(asset: AssetResponse, options: PictureOptions = {}): PictureModel {
  let images = asset.variants.filter((v) => v.type.startsWith("image/") && v.type !== "image/gif");
  if (images.some((v) => v.prefersReducedMotion === undefined)) {
    images = images.filter((v) => v.prefersReducedMotion === undefined);
  }

  const sizes = options.sizes ?? `${asset.width}px`;
  const dark = images.filter((v) => v.prefersColorScheme === "dark");
  const light = images.filter((v) => v.prefersColorScheme !== "dark");
  // A given scheme stands alone; otherwise the dark files go behind a media query, and the img is light.
  const groups: [AssetVariant[], string | undefined][] =
    options.colorScheme === undefined ? [[dark, "(prefers-color-scheme: dark)"], [light, undefined]]
    : options.colorScheme === "dark" && dark.length > 0 ? [[dark, undefined]]
    : [[light, undefined]];
  const sources: PictureSource[] = [];

  for (const [group, media] of groups) {
    // An SVG fits every density, so it stands in for the rasters; in the img's own group it is the img.
    const svg = group.find((v) => v.type === SVG);
    if (svg) {
      if (media !== undefined) sources.push({ type: SVG, media, srcset: svg.url });
      continue;
    }
    for (const type of SOURCE_TYPES) {
      const variants = group.filter((v) => v.type === type);
      if (variants.length === 0) continue;
      sources.push({ type, media, srcset: srcset(variants), sizes: needsSizes(variants) ? sizes : undefined });
    }
  }

  const own = groups[groups.length - 1][0];
  const ownSvg = own.find((v) => v.type === SVG);
  const fallback = ownSvg ? [ownSvg] : own.filter((v) => !SOURCE_TYPES.includes(v.type));
  const smallest = [...fallback].sort((a, b) => (a.scale ?? a.pixelWidth ?? 0) - (b.scale ?? b.pixelWidth ?? 0))[0];
  return {
    sources,
    img: {
      src: smallest?.url ?? asset.url,
      srcset: fallback.length > 1 ? srcset(fallback) : undefined,
      sizes: needsSizes(fallback) ? sizes : undefined,
      width: asset.width,
      height: asset.height,
      alt: asset.alt,
      lang: asset.lang,
      loading: options.loading ?? "lazy",
      decoding: "async",
      className: options.className,
      ...fill(asset, options),
    },
  };
}

/**
 * The fill to put on the img: the call site's or the asset's, cleaned to what CSS takes. A response from before the
 * fill, with no override either, gets none, so the page draws it as it always has.
 */
function fill(asset: AssetResponse, options: PictureOptions): Pick<PictureImage, "objectFit" | "objectPosition"> {
  if (options.objectFit === "none") return {};
  if (asset.objectFit === undefined && asset.objectPosition === undefined && options.objectFit === undefined && options.objectPosition === undefined) return {};
  return { objectFit: objectFitOf(asset, options.objectFit), objectPosition: objectPositionOf(asset, options.objectPosition) };
}

/** The img's fill as a style attribute's value. */
export function fillStyle(img: PictureImage): string | undefined {
  return img.objectFit === undefined ? undefined : `object-fit: ${img.objectFit}; object-position: ${img.objectPosition}`;
}

/** The picture as an HTML string, for innerHTML or server-rendered pages. */
export function pictureHtml(asset: AssetResponse, options: PictureOptions = {}): string {
  const { sources, img } = pictureModel(asset, options);
  const rendered = sources.map((s) => tag("source", { type: s.type, media: s.media, srcset: s.srcset, sizes: s.sizes }));
  rendered.push(tag("img", {
    src: img.src,
    srcset: img.srcset,
    sizes: img.sizes,
    width: String(img.width),
    height: String(img.height),
    alt: img.alt,
    lang: img.lang,
    loading: img.loading,
    decoding: img.decoding,
    class: img.className,
    style: fillStyle(img),
  }));
  return `<picture>${rendered.join("")}</picture>`;
}

function srcset(variants: AssetVariant[]): string {
  return variants
    .map((v) => (v.pixelWidth !== undefined ? `${v.url} ${v.pixelWidth}w` : v.scale !== undefined ? `${v.url} ${v.scale}x` : v.url))
    .join(", ");
}

function needsSizes(variants: AssetVariant[]): boolean {
  return variants.some((v) => v.pixelWidth !== undefined);
}

function tag(name: string, attributes: Record<string, string | undefined>): string {
  const rendered = Object.entries(attributes)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([key, value]) => ` ${key}="${escapeAttribute(value)}"`)
    .join("");
  return `<${name}${rendered}>`;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
