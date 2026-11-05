// Brua for React: <BruaProvider>, <BruaPicture>, useBruaAsset and useBruaUrl. Import from "@meginhufr/brua-web/react".
import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactElement, type ReactNode } from "react";
import { pictureModel, type PictureOptions } from "./picture.ts";
import { selectUrl } from "./select.ts";
import { defaultClientState, watchClientState, type ClientOptions } from "./client.ts";
import { createBrua, type Brua, type BruaOptions } from "./brua.ts";
import type { AssetResponse } from "./types.ts";

const BruaContext = createContext<Brua | undefined>(undefined);

export type BruaProviderProps = { children?: ReactNode } & ({ brua: Brua } | BruaOptions);

/** Where the app's assets are read from by id: wrap the app once, then <BruaPicture id="…"> anywhere below. */
export function BruaProvider(props: BruaProviderProps): ReactElement {
  const given = "brua" in props ? props.brua : undefined;
  const { base, lang, maxAge } = "brua" in props ? ({} as Partial<BruaOptions>) : props;
  const brua = useMemo(() => given ?? createBrua({ base: base!, lang, maxAge }), [given, base, lang, maxAge]);
  return createElement(BruaContext.Provider, { value: brua }, props.children);
}

/**
 * The asset's current release for an id, from the provider's Brua or the one given: the last release it read at once, else
 * undefined until it has loaded, and when nothing is released under the id. Loads only in the browser; a server render shows the fallback.
 */
export function useBruaAsset(id: string | undefined, brua?: Brua): AssetResponse | undefined {
  const fromContext = useContext(BruaContext);
  const client = brua ?? fromContext;
  // The last release the Brua read renders at once, so a remounted picture doesn't flash its fallback.
  const [asset, setAsset] = useState<AssetResponse | undefined>(() => (id === undefined ? undefined : client?.cachedAsset(id)));
  if (id !== undefined && !client) throw new Error("useBruaAsset needs a <BruaProvider> above it, or a Brua passed in.");
  useEffect(() => {
    if (id === undefined || !client) return;
    let live = true;
    setAsset(client.cachedAsset(id));
    client.asset(id).then((loaded) => { if (live) setAsset(loaded); }, () => {});
    return () => { live = false; };
  }, [client, id]);
  return id === undefined ? undefined : asset;
}

export interface BruaPictureProps extends PictureOptions {
  /** The asset as your backend embedded it: a snapshot of one release. */
  asset?: AssetResponse;
  /** Or its id: the current release, read from the edge, so a merge reaches this picture within a minute. */
  id?: string;
  /** The Brua to read the id through, instead of the provider's. */
  brua?: Brua;
  /** What shows until the id has loaded, and when nothing is released under it. */
  fallback?: ReactNode;
}

/**
 * The asset as a picture element (SPEC.md 7.2): the browser picks the format, density and color scheme,
 * and follows dark mode live. Animations show their still.
 */
export function BruaPicture({ asset, id, brua, fallback = null, sizes, loading, className, colorScheme, objectFit, objectPosition }: BruaPictureProps): ReactElement | null {
  const fetched = useBruaAsset(asset ? undefined : id, brua);
  const shown = asset ?? fetched;
  if (!shown) return fallback as ReactElement | null;
  const { sources, img } = pictureModel(shown, { sizes, loading, className, colorScheme, objectFit, objectPosition });
  return createElement(
    "picture",
    null,
    ...sources.map((s) => createElement("source", { key: `${s.type}${s.media ?? ""}`, type: s.type, media: s.media, srcSet: s.srcset, sizes: s.sizes })),
    createElement("img", {
      src: img.src,
      srcSet: img.srcset,
      sizes: img.sizes,
      width: img.width,
      height: img.height,
      alt: img.alt,
      lang: img.lang,
      loading: img.loading,
      decoding: img.decoding,
      className: img.className,
      style: img.objectFit === undefined ? undefined : { objectFit: img.objectFit, objectPosition: img.objectPosition },
    }),
  );
}

/**
 * One variant URL for the asset, chosen for this browser and kept current as its appearance, motion setting
 * or pixel density changes: for a CSS background, a canvas or an animation player. Renders light at 1x on
 * the server and corrects itself after hydration.
 */
export function useBruaUrl(asset: AssetResponse, options: ClientOptions = {}): string {
  const [state, setState] = useState(() => defaultClientState(options));
  const types = options.supportedTypes?.join(",");
  useEffect(() => watchClientState(setState, options), [types, options.targetWidth]);
  return selectUrl(asset, state);
}
