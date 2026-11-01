import type { AssetResponse } from "../src/types.ts";

/** A fixed-size icon with a dark override, three scales and three formats, as the delivery API returns it. */
export const icon: AssetResponse = {
  id: "gift-icon",
  version: 3,
  url: "https://cdn.test/assets/gift-icon/3",
  width: 96,
  height: 48,
  alt: "Gavekort",
  lang: "nb",
  variants: [1, 2, 3].flatMap((scale) =>
    (["image/avif", "image/webp", "image/png"] as const).flatMap((type) => {
      const ext = type.split("/")[1];
      return [
        { type, url: `https://cdn.test/assets/gift-icon/3/default@${scale}x.${ext}`, scale },
        { type, url: `https://cdn.test/assets/gift-icon/3/dark@${scale}x.${ext}`, scale, prefersColorScheme: "dark" },
      ];
    }),
  ),
};

/** A flexible photo with a width ladder. */
export const photo: AssetResponse = {
  id: "beach",
  version: 1,
  url: "https://cdn.test/assets/beach/1",
  width: 1600,
  height: 1067,
  alt: "Beach at dusk",
  lang: "en",
  variants: [160, 320, 640, 1280].flatMap((pixelWidth) => [
    { type: "image/avif", url: `https://cdn.test/assets/beach/1/${pixelWidth}.avif`, pixelWidth },
    { type: "image/jpeg", url: `https://cdn.test/assets/beach/1/${pixelWidth}.jpg`, pixelWidth },
  ]),
};

/** Every URL in a rendered picture, for comparing renderers. */
export function urlsIn(html: string): string[] {
  return [...html.matchAll(/https:\/\/cdn\.test\/[^\s",]+/g)].map((m) => m[0]).sort();
}
