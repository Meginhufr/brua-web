// Brua for Svelte 5: setBrua, bruaAsset and bruaUrl beside the BruaPicture component. Import from "@meginhufr/brua-web/svelte".
import { getContext, setContext } from "svelte";
import { readable, type Readable } from "svelte/store";
import { selectUrl } from "./select.ts";
import { defaultClientState, watchClientState, type ClientOptions } from "./client.ts";
import { createBrua, type Brua, type BruaOptions } from "./brua.ts";
import type { AssetResponse, ClientState } from "./types.ts";

export { default as BruaPicture } from "./BruaPicture.svelte";

/** The context key BruaPicture reads the app's Brua from. */
export const bruaContext = "brua";

/** Where the app's assets are read from by id: call once in the root component, then <BruaPicture id="…"> anywhere below. */
export function setBrua(options: Brua | BruaOptions): Brua {
  const brua = "asset" in options ? options : createBrua(options);
  setContext(bruaContext, brua);
  return brua;
}

export function getBrua(): Brua | undefined {
  return getContext<Brua | undefined>(bruaContext);
}

/**
 * A store of the asset's current release for an id: undefined until it has loaded, and when nothing is released
 * under the id. Reads through the context's Brua unless one is given; call it during component setup.
 */
export function bruaAsset(id: string, brua: Brua | undefined = getBrua()): Readable<AssetResponse | undefined> {
  if (!brua) throw new Error("bruaAsset needs setBrua() in a parent, or a Brua passed in.");
  return readable<AssetResponse | undefined>(undefined, (set) => {
    let live = true;
    brua.asset(id).then((loaded) => { if (live) set(loaded); });
    return () => { live = false; };
  });
}

/**
 * A store of one variant URL for the asset, chosen for this browser and kept current as its appearance,
 * motion setting or pixel density changes: `$url` in a component. Light at 1x until subscribed in a browser.
 */
export function bruaUrl(asset: AssetResponse, options: ClientOptions = {}) {
  let state: ClientState = defaultClientState(options);
  const subscribers = new Set<(url: string) => void>();
  let stop = () => {};
  const current = () => selectUrl(asset, state);
  return {
    subscribe(run: (url: string) => void) {
      subscribers.add(run);
      run(current());
      if (subscribers.size === 1) {
        stop = watchClientState((next) => {
          state = next;
          for (const subscriber of subscribers) subscriber(current());
        }, options);
      }
      return () => {
        subscribers.delete(run);
        if (subscribers.size === 0) stop();
      };
    },
  };
}
