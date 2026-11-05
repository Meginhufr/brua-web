// Brua for Vue 3: provideBrua, <BruaPicture>, useBruaAsset and useBruaUrl. Import from "@meginhufr/brua-web/vue".
import {
  computed, defineComponent, h, inject, onBeforeUnmount, onMounted, provide, ref, toValue, unref, watchEffect,
  type ComputedRef, type InjectionKey, type MaybeRef, type MaybeRefOrGetter, type PropType, type Ref,
} from "vue";
import { fillStyle, pictureModel } from "./picture.ts";
import { selectUrl } from "./select.ts";
import { defaultClientState, watchClientState, type ClientOptions } from "./client.ts";
import { assetOrError, createBrua, type Brua, type BruaOptions } from "./brua.ts";
import type { AssetResponse, BruaImageError } from "./types.ts";

export const bruaKey: InjectionKey<Brua> = Symbol("brua");

/** Where the app's assets are read from by id: call once in the root component, then <BruaPicture id="…"> anywhere below. */
export function provideBrua(options: Brua | BruaOptions): Brua {
  const brua = "asset" in options ? options : createBrua(options);
  provide(bruaKey, brua);
  return brua;
}

/**
 * The asset's current release for an id, from the provided Brua or the one given: the last release it read at once, else
 * undefined until it has loaded, and when nothing is released under the id. A server render shows the fallback.
 */
export function useBruaAsset(id: MaybeRefOrGetter<string | undefined>, brua?: Brua): Ref<AssetResponse | undefined> {
  const state = useBruaAssetState(id, brua);
  return computed(() => state.value.asset);
}

/**
 * The asset's current release for an id, as useBruaAsset gives it, or the error when there is none: not released, or
 * the edge can't be reached with no release known. Both undefined while it loads.
 */
export function useBruaAssetState(id: MaybeRefOrGetter<string | undefined>, brua?: Brua): Ref<{ asset?: AssetResponse; error?: BruaImageError }> {
  const client = brua ?? inject(bruaKey, undefined);
  const state = ref<{ asset?: AssetResponse; error?: BruaImageError }>({});
  watchEffect((onCleanup) => {
    const wanted = toValue(id);
    if (wanted === undefined) { state.value = {}; return; }
    if (!client) throw new Error("useBruaAsset needs provideBrua() in a parent, or a Brua passed in.");
    let live = true;
    onCleanup(() => { live = false; });
    state.value = { asset: client.cachedAsset(wanted) };
    assetOrError(client, wanted).then((read) => { if (live) state.value = read; });
  });
  return state as Ref<{ asset?: AssetResponse; error?: BruaImageError }>;
}

/**
 * The asset as a picture element (SPEC.md 7.2): the browser picks the format, density and color scheme,
 * and follows dark mode live. Animations show their still. Attributes such as class go on the img.
 * The default slot shows until an id has loaded; the error slot, given the reason as `error`, when there is no picture:
 * nothing released, the edge unreachable, or the file failed. Without an error slot the default one shows then.
 */
export const BruaPicture = defineComponent({
  name: "BruaPicture",
  inheritAttrs: false,
  props: {
    /** The asset as your backend embedded it: a snapshot of one release. */
    asset: { type: Object as PropType<AssetResponse>, required: false },
    /** Or its id: the current release, read from the edge, so a merge reaches this picture within a minute. */
    id: { type: String, required: false },
    /** The Brua to read the id through, instead of the provided one. */
    brua: { type: Object as PropType<Brua>, required: false },
    /** The sizes attribute for flexible assets; defaults to the asset's width. */
    sizes: { type: String, required: false },
    loading: { type: String as PropType<"lazy" | "eager">, required: false },
    /** "light" or "dark" to show that scheme's files only, for apps that switch themes themselves. */
    colorScheme: { type: String as PropType<"light" | "dark">, required: false },
    /** "contain" or "cover" to override the asset's fit, or "none" to leave the fit to the page's CSS. */
    objectFit: { type: String as PropType<"contain" | "cover" | "none">, required: false },
    /** Where the img sits in its box, as "x% y%", instead of the asset's position. */
    objectPosition: { type: String, required: false },
  },
  setup(props, { attrs, slots }) {
    const fetched = useBruaAssetState(() => (props.asset ? undefined : props.id), props.brua);
    const failed = ref<string>();
    const failure = (error: BruaImageError) => (slots.error ?? slots.default)?.({ error }) ?? null;
    return () => {
      const asset = props.asset ?? fetched.value.asset;
      if (!asset) return fetched.value.error ? failure(fetched.value.error) : slots.default?.() ?? null;
      const { sources, img } = pictureModel(asset, {
        sizes: props.sizes, loading: props.loading, colorScheme: props.colorScheme, objectFit: props.objectFit, objectPosition: props.objectPosition,
      });
      // The img's own error event: the file failed. Another file (a merge, another size) tries again.
      if (failed.value === img.src) return failure({ reason: "file", url: img.src });
      return h("picture", [
        ...sources.map((s) => h("source", { key: `${s.type}${s.media ?? ""}`, type: s.type, media: s.media, srcset: s.srcset, sizes: s.sizes })),
        h("img", {
          ...attrs,
          src: img.src,
          srcset: img.srcset,
          sizes: img.sizes,
          width: img.width,
          height: img.height,
          alt: img.alt,
          lang: img.lang,
          loading: img.loading,
          decoding: img.decoding,
          // The fill first, so a style the page gives the component still wins.
          style: [fillStyle(img), attrs.style],
          onError: () => { failed.value = img.src; },
        }),
      ]);
    };
  },
});

/**
 * One variant URL for the asset, chosen for this browser and kept current as its appearance, motion setting
 * or pixel density changes: for a CSS background, a canvas or an animation player. Light at 1x on the server.
 */
export function useBruaUrl(asset: MaybeRef<AssetResponse>, options: ClientOptions = {}): ComputedRef<string> {
  const state = ref(defaultClientState(options));
  let stop = () => {};
  onMounted(() => { stop = watchClientState((next) => { state.value = next; }, options); });
  onBeforeUnmount(() => stop());
  return computed(() => selectUrl(unref(asset), state.value));
}
