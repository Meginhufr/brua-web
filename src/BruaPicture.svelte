<!-- Brua for Svelte 5: the asset as a picture element (SPEC.md 7.2). The browser picks the format, density
     and color scheme, and follows dark mode live. Animations show their still. Import from "@meginhufr/brua-web/svelte".
     Given an id instead of an asset, the current release is read from the edge through the Brua set with
     setBrua(); the last release it read shows at once, else the children until it has loaded. The error snippet, given the
     reason, shows when there is no picture: nothing released, the edge unreachable, or the file failed; without it, the
     children show then. -->
<script>
  import { getContext } from "svelte";
  import { fillStyle, pictureModel } from "./picture.ts";
  import { assetOrError } from "./brua.ts";

  /** @type {{ asset?: import("./types.ts").AssetResponse, id?: string, brua?: import("./brua.ts").Brua, sizes?: string, loading?: "lazy" | "eager", class?: string, colorScheme?: "light" | "dark", objectFit?: "contain" | "cover" | "none", objectPosition?: string, children?: import("svelte").Snippet, error?: import("svelte").Snippet<[import("./types.ts").BruaImageError]> }} */
  let { asset: given, id, brua = getContext("brua"), sizes, loading, class: imgClass, colorScheme, objectFit, objectPosition, children, error } = $props();
  // The last release the Brua read renders at once, so a remounted picture doesn't flash its children.
  let fetched = $state(id === undefined ? undefined : brua?.cachedAsset(id));
  /** @type {import("./types.ts").BruaImageError | undefined} */
  let reason = $state();
  /** @type {string | undefined} */
  let failed = $state();

  $effect(() => {
    if (given || id === undefined) return;
    if (!brua) throw new Error("BruaPicture with an id needs setBrua() in a parent, or a brua prop.");
    let live = true;
    fetched = brua.cachedAsset(id);
    reason = undefined;
    assetOrError(brua, id).then((read) => { if (live) { fetched = read.asset; reason = read.error; } });
    return () => { live = false; };
  });

  let asset = $derived(given ?? fetched);
  let model = $derived(asset ? pictureModel(asset, { sizes, loading, className: imgClass, colorScheme, objectFit, objectPosition }) : undefined);
  // The img's own error event: the file failed. Another file (a merge, another size) tries again.
  let failure = $derived(model && failed === model.img.src ? { reason: "file", url: model.img.src } : !asset ? reason : undefined);
</script>

{#if failure}
  {#if error}{@render error(failure)}{:else if children}{@render children()}{/if}
{:else if model}
  <picture>
    {#each model.sources as source (source.type + (source.media ?? ""))}
      <source type={source.type} media={source.media} srcset={source.srcset} sizes={source.sizes} />
    {/each}
    <img
      src={model.img.src}
      srcset={model.img.srcset}
      sizes={model.img.sizes}
      width={model.img.width}
      height={model.img.height}
      alt={model.img.alt}
      lang={model.img.lang}
      loading={model.img.loading}
      decoding={model.img.decoding}
      class={model.img.className}
      style={fillStyle(model.img)}
      onerror={() => (failed = model.img.src)}
    />
  </picture>
{:else if children}
  {@render children()}
{/if}
