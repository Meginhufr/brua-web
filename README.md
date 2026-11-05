# Brua for the web

Brua for the web: `AssetResponse` types, the variant selection rule, `<picture>` rendering, and components for React, Vue and Svelte. Brua's edge runs the same selection code.

```bash
npm install @meginhufr/brua-web
```

Your backend passes asset ids on, and the page reads each asset's current release from the edge (`SPEC.md` 5.3), or it embeds the `AssetResponse` in its own JSON as a snapshot (7.1). Every renderer below puts dark-mode sources behind a media query, AVIF and WebP as sources, and alt, lang, width and height on the `<img>`, so the browser picks the variant, nothing needs client hints, and dark mode switches live. Animations show their still.

## From an id

Configure once where your organization's assets live, then render by id. The asset is fetched from `{base}/{id}.json` with no key, and remembered by everyone who asks: answered from memory for the edge's minute, read again after that, and kept when the edge can't be reached. A merge in Brua reaches the page within that minute with no deploy of yours; `brua.cachedAsset(id)` gives the last release read at once, and `brua.prefetch(ids)` reads a list's ids before it renders.

```ts
import { createBrua } from "@meginhufr/brua-web";

const brua = createBrua({ base: "https://cdn.brua.dev/assets/<your organization id>", lang: "nb" });
const asset = await brua.asset("gift-theme-christmas-header");   // undefined when nothing is released under the id
```

In React, Vue and Svelte the component takes `id` once a provider has been set up (`<BruaProvider base="…">`, `provideBrua({ base })`, `setBrua({ base })`); until the asset has loaded it renders the fallback: the `fallback` prop, the default slot or the children. `useBruaAsset(id)` and `bruaAsset(id)` give the object itself.

## Plain HTML

```ts
import { pictureHtml, selectUrl } from "@meginhufr/brua-web";

element.innerHTML = pictureHtml(asset, { sizes: "(min-width: 600px) 50vw, 100vw" });

// Or choose one URL yourself, for example for a canvas or CSS background.
const url = selectUrl(asset, browserClientState({ targetWidth: 320 }));
```

`pictureModel(asset, options)` returns the same picture as data (sources and img attributes) for a renderer of your own.

## React

```tsx
import { BruaPicture, BruaProvider, useBruaUrl } from "@meginhufr/brua-web/react";

<BruaProvider base="https://cdn.brua.dev/assets/<org>">
  <BruaPicture id={theme.headerId} sizes="(min-width: 600px) 50vw, 100vw" className="hero" fallback={<div className="hero skeleton" />} />
</BruaProvider>

// Or an embedded snapshot.
<BruaPicture asset={theme.header} sizes="(min-width: 600px) 50vw, 100vw" className="hero" />

// One URL that follows the appearance, Reduce Motion and the display, for a background or a Lottie player.
const url = useBruaUrl(theme.header, { targetWidth: 320 });
```

## Vue 3

```vue
<script setup>
import { BruaPicture, provideBrua, useBruaUrl } from "@meginhufr/brua-web/vue";
provideBrua({ base: "https://cdn.brua.dev/assets/<org>" });   // once, in the root component
const url = useBruaUrl(() => props.theme.header, { targetWidth: 320 });
</script>

<BruaPicture :id="theme.headerId" sizes="(min-width: 600px) 50vw, 100vw" class="hero"><div class="hero skeleton" /></BruaPicture>
<BruaPicture :asset="theme.header" sizes="(min-width: 600px) 50vw, 100vw" class="hero" />
```

Attributes such as `class` go on the `<img>`.

## Svelte 5

```svelte
<script>
  import { BruaPicture, bruaUrl, setBrua } from "@meginhufr/brua-web/svelte";
  setBrua({ base: "https://cdn.brua.dev/assets/<org>" });   // once, in the root component
  const url = bruaUrl(theme.header, { targetWidth: 320 });
</script>

<BruaPicture id={theme.headerId} sizes="(min-width: 600px) 50vw, 100vw" class="hero"><div class="hero skeleton"></div></BruaPicture>
<BruaPicture asset={theme.header} sizes="(min-width: 600px) 50vw, 100vw" class="hero" />
<div style="background-image: url({$url})"></div>
```

## Without the SDK

The single URL takes query parameters for everything it negotiates (`?dpr=2`, `?scheme=dark`, `?lang=nb`, `?w=640`), so a hand-written `<picture>` works in every browser too; the back office shows one for each asset.

## Tests

`npm test` runs the shared fixtures in `fixtures/selection` and renders each component on the server (Node 23.6 or later runs the TypeScript directly). React, Vue and Svelte are development dependencies here and optional peers for apps.
