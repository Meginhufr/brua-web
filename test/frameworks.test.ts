// The React, Vue and Svelte components render the same picture as pictureHtml, server-side.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { compile } from "svelte/compiler";
import { render } from "svelte/server";
import { pictureHtml, pictureModel } from "../src/picture.ts";
import { BruaPicture as ReactPicture } from "../src/react.ts";
import { BruaPicture as VuePicture } from "../src/vue.ts";
import { icon, photo, urlsIn } from "./sample.ts";

const sizes = "(min-width: 600px) 50vw, 100vw";

test("the model has dark and default sources per format and a fallback img", () => {
  const { sources, img } = pictureModel(icon);
  assert.deepEqual(sources.map((s) => [s.type, s.media]), [
    ["image/avif", "(prefers-color-scheme: dark)"], ["image/webp", "(prefers-color-scheme: dark)"],
    ["image/avif", undefined], ["image/webp", undefined],
  ]);
  assert.equal(sources[0].srcset, "https://cdn.test/assets/gift-icon/3/dark@1x.avif 1x, https://cdn.test/assets/gift-icon/3/dark@2x.avif 2x, https://cdn.test/assets/gift-icon/3/dark@3x.avif 3x");
  assert.equal(img.src, "https://cdn.test/assets/gift-icon/3/default@1x.png");
  assert.equal(img.srcset, "https://cdn.test/assets/gift-icon/3/default@1x.png 1x, https://cdn.test/assets/gift-icon/3/default@2x.png 2x, https://cdn.test/assets/gift-icon/3/default@3x.png 3x");
  assert.deepEqual([img.width, img.height, img.alt, img.lang, img.loading, img.decoding], [96, 48, "Gavekort", "nb", "lazy", "async"]);
  assert.equal(pictureModel(photo, { sizes }).sources[0].sizes, sizes, "flexible assets carry sizes");
});

test("React renders the same picture as pictureHtml", () => {
  for (const asset of [icon, photo]) {
    const html = renderToStaticMarkup(createElement(ReactPicture, { asset, sizes, className: "hero" }));
    assert.deepEqual(urlsIn(html), urlsIn(pictureHtml(asset, { sizes })));
    assert.match(html, /^<picture><source /);
    assert.match(html, /<img [^>]*class="hero"/);
    assert.match(html, /<img [^>]*alt="/);
    assert.match(html, /loading="lazy"/);
    if (asset === icon) assert.match(html, /media="\(prefers-color-scheme: dark\)"/);
    if (asset === photo) assert.match(html, /sizes="\(min-width: 600px\) 50vw, 100vw"/);
  }
  const filled = renderToStaticMarkup(createElement(ReactPicture, { asset: { ...photo, objectFit: "cover", objectPosition: "50% 35%" } }));
  assert.match(filled, /<img [^>]*style="object-fit:cover;object-position:50% 35%"/);
});

test("Vue renders the same picture as pictureHtml, with attributes on the img", async () => {
  for (const asset of [icon, photo]) {
    const app = createSSRApp({ render: () => h(VuePicture, { asset, sizes, class: "hero" }) });
    const html = await renderToString(app);
    assert.deepEqual(urlsIn(html), urlsIn(pictureHtml(asset, { sizes })));
    assert.match(html, /^<picture><source /);
    assert.match(html, /<img [^>]*class="hero"/);
    assert.match(html, /width="96"|width="1600"/);
  }
  const filled = await renderToString(createSSRApp({ render: () => h(VuePicture, { asset: { ...photo, objectFit: "cover" }, objectPosition: "10% 20%" }) }));
  assert.match(filled, /<img [^>]*style="object-fit:cover;object-position:10% 20%;?"/);
});

test("Svelte renders the same picture as pictureHtml", async () => {
  // Compiled for the server into the package, so the output resolves "svelte" from node_modules.
  const source = readFileSync(new URL("../src/BruaPicture.svelte", import.meta.url), "utf8");
  const compiled = compile(source.replace('from "./picture.ts"', 'from "../../src/picture.ts"').replace('from "./brua.ts"', 'from "../../src/brua.ts"'), { generate: "server", filename: "BruaPicture.svelte" });
  const dir = fileURLToPath(new URL("./.compiled/", import.meta.url));
  mkdirSync(dir, { recursive: true });
  const file = `${dir}BruaPicture.js`;
  writeFileSync(file, compiled.js.code);
  const { default: SveltePicture } = await import(pathToFileURL(file).href);
  for (const asset of [icon, photo]) {
    const { body } = render(SveltePicture, { props: { asset, sizes, class: "hero" } });
    assert.deepEqual(urlsIn(body), urlsIn(pictureHtml(asset, { sizes })));
    assert.match(body, /<picture>/);
    assert.match(body, /<img [^>]*class="hero"/);
    assert.match(body, /alt="(Gavekort|Beach at dusk)"/);
    const { body: filled } = render(SveltePicture, { props: { asset: { ...asset, objectFit: "cover", objectPosition: "50% 35%" } } });
    assert.match(filled, /<img [^>]*style="object-fit: cover; object-position: 50% 35%"/);
  }
});
