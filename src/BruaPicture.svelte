<!-- Brua for Svelte 5: the asset as a picture element (SPEC.md 7.2). The browser picks the format, density
     and color scheme, and follows dark mode live. Animations show their still. Import from "@meginhufr/brua-web/svelte".
     Given an id instead of an asset, the current release is read from the edge through the Brua set with
     setBrua(); the children show until it has loaded, and when nothing is released under the id. -->
<script>
  import { getContext } from "svelte";
  import { pictureModel } from "./picture.ts";

  /** @type {{ asset?: import("./types.ts").AssetResponse, id?: string, brua?: import("./brua.ts").Brua, sizes?: string, loading?: "lazy" | "eager", class?: string, colorScheme?: "light" | "dark", children?: import("svelte").Snippet }} */
  let { asset: given, id, brua = getContext("brua"), sizes, loading, class: imgClass, colorScheme, children } = $props();
  let fetched = $state();

  $effect(() => {
    if (given || id === undefined) return;
    if (!brua) throw new Error("BruaPicture with an id needs setBrua() in a parent, or a brua prop.");
    let live = true;
    brua.asset(id).then((loaded) => { if (live) fetched = loaded; });
    return () => { live = false; };
  });

  let asset = $derived(given ?? fetched);
  let model = $derived(asset ? pictureModel(asset, { sizes, loading, className: imgClass, colorScheme }) : undefined);
</script>

{#if model}
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
    />
  </picture>
{:else if children}
  {@render children()}
{/if}
