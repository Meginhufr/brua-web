import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pictureHtml } from "../src/picture.ts";
import type { AssetResponse } from "../src/types.ts";

const fixtures = [join(import.meta.dirname, "../fixtures/selection"), join(import.meta.dirname, "../../../fixtures/selection")].find(existsSync)!;
const fixture = (name: string) => JSON.parse(readFileSync(join(fixtures, name), "utf8")).asset;

const mark: AssetResponse = {
  id: "mark", version: 1, url: "https://cdn.example/assets/mark/1", width: 28, height: 28, alt: "",
  variants: [
    { type: "image/svg+xml", url: "https://cdn.example/mark/light.svg" },
    { type: "image/png", url: "https://cdn.example/mark/light@1x.png", scale: 1 },
    { type: "image/avif", url: "https://cdn.example/mark/light@2x.avif", scale: 2 },
    { type: "image/svg+xml", url: "https://cdn.example/mark/dark.svg", prefersColorScheme: "dark" },
    { type: "image/png", url: "https://cdn.example/mark/dark@1x.png", prefersColorScheme: "dark", scale: 1 },
  ],
};

test("an svg stands in for every raster of its scheme", () => {
  assert.equal(pictureHtml(mark),
    '<picture><source type="image/svg+xml" media="(prefers-color-scheme: dark)" srcset="https://cdn.example/mark/dark.svg">' +
    '<img src="https://cdn.example/mark/light.svg" width="28" height="28" alt="" loading="lazy" decoding="async"></picture>');
});

test("a given color scheme renders that scheme's files without a media query", () => {
  assert.equal(pictureHtml(mark, { colorScheme: "dark" }),
    '<picture><img src="https://cdn.example/mark/dark.svg" width="28" height="28" alt="" loading="lazy" decoding="async"></picture>');
  const dark = pictureHtml(fixture("06-fixed-dark-at-the-display-scale.json"), { colorScheme: "dark" });
  assert.doesNotMatch(dark, /prefers-color-scheme/);
  assert.match(dark, /<source type="image\/avif" srcset="[^"]*dark@1x\.avif 1x/);
  assert.match(dark, /<img src="[^"]*dark@1x\.png"/);
  assert.doesNotMatch(pictureHtml(mark, { colorScheme: "light" }), /dark/);
});

test("a fixed asset gets dark sources behind a media query and density descriptors", () => {
  const html = pictureHtml(fixture("06-fixed-dark-at-the-display-scale.json"));
  assert.match(html, /<source type="image\/avif" media="\(prefers-color-scheme: dark\)" srcset="[^"]*dark@1x\.avif 1x, [^"]*dark@2x\.avif 2x/);
  assert.match(html, /<img src="https:\/\/cdn\.test\/assets\/icon\/1\/light@1x\.png" srcset="[^"]*light@2x\.png 2x/);
  assert.match(html, /width="64" height="64" alt="Ikon" lang="nb"/);
});

test("a flexible asset gets width descriptors and sizes", () => {
  const html = pictureHtml(fixture("01-flexible-picks-the-smallest-width-that-covers-the-target.json"), { sizes: "(min-width: 600px) 50vw, 100vw" });
  assert.match(html, /<source type="image\/avif" srcset="[^"]*160\.avif 160w,[^"]*1280\.avif 1280w" sizes="\(min-width: 600px\) 50vw, 100vw">/);
  assert.match(html, /<img src="[^"]*160\.jpg"/);
});

test("an animation renders its still", () => {
  const html = pictureHtml(fixture("10-an-animation-plays-when-supported.json"));
  assert.doesNotMatch(html, /\.json/);
  assert.match(html, /default-still@1x\.png/);
});

test("a decorative asset keeps an empty alt, and attributes are escaped", () => {
  const asset = fixture("15-nothing-renderable-falls-back-to-the-asset-url.json");
  assert.match(pictureHtml(asset), / alt=""/);
  assert.match(pictureHtml({ ...asset, alt: 'Say "hi" <3' }), /alt="Say &quot;hi&quot; &lt;3"/);
});

test("the img draws with the asset's fill, an override wins, and none leaves it to the page", () => {
  const photo = { ...fixture("01-flexible-picks-the-smallest-width-that-covers-the-target.json"), objectFit: "cover", objectPosition: "50% 35%" };
  assert.match(pictureHtml(photo), /<img [^>]*style="object-fit: cover; object-position: 50% 35%"/);
  assert.match(pictureHtml(photo, { objectFit: "contain", objectPosition: "0% 50%" }), /style="object-fit: contain; object-position: 0% 50%"/);
  assert.doesNotMatch(pictureHtml(photo, { objectFit: "none" }), /style=/);
});

test("a response from before the fill gets no style, and values CSS doesn't take fall back to the defaults", () => {
  assert.doesNotMatch(pictureHtml(mark), /style=/);
  const odd = { ...mark, objectFit: "fill; color: red", objectPosition: "top; color: red" };
  assert.match(pictureHtml(odd), /style="object-fit: contain; object-position: 50% 50%"/);
});
