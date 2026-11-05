// Brua for Vue 3: provideBrua, <BruaPicture>, useBruaAsset and useBruaUrl. Import from "@meginhufr/brua-web/vue".
import {
  computed, defineComponent, h, inject, onBeforeUnmount, onMounted, provide, ref, toValue, unref, watchEffect,
  type ComputedRef, type InjectionKey, type MaybeRef, type MaybeRefOrGetter, type PropType, type Ref,
} from "vue";
import { pictureModel } from "./picture.ts";
import { selectUrl } from "./select.ts";
import { defaultClientState, watchClientState, type ClientOptions } from "./client.ts";
import { createBrua, type Brua, type BruaOptions } from "./brua.ts";
import type { AssetResponse } from "./types.ts";

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
  const client = brua ?? inject(bruaKey, undefined);
  const asset = ref<AssetResponse>();
  watchEffect((onCleanup) => {
    const wanted = toValue(id);
    if (wanted === undefined) { asset.value = undefined; return; }
    if (!client) throw new Error("useBruaAsset needs provideBrua() in a parent, or a Brua passed in.");
    let live = true;
    onCleanup(() => { live = false; });
    asset.value = client.cachedAsset(wanted);
    client.asset(wanted).then((loaded) => { if (live) asset.value = loaded; }, () => {});
  });
  return asset;
}

/**
 * The asset as a picture element (SPEC.md 7.2): the browser picks the format, density and color scheme,
 * and follows dark mode live. Animations show their still. Attributes such as class go on the img.
 * The default slot shows until an id has loaded, and when nothing is released under it.
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
  },
  setup(props, { attrs, slots }) {
    const fetched = useBruaAsset(() => (props.asset ? undefined : props.id), props.brua);
    return () => {
      const asset = props.asset ?? fetched.value;
      if (!asset) return slots.default?.() ?? null;
      const { sources, img } = pictureModel(asset, { sizes: props.sizes, loading: props.loading, colorScheme: props.colorScheme });
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
