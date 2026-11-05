// Reading assets by id from the edge: one request per id a minute, and the components' id form.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { createBrua } from "../src/brua.ts";
import { BruaPicture as ReactPicture, BruaProvider } from "../src/react.ts";
import { BruaPicture as VuePicture, provideBrua } from "../src/vue.ts";
import { icon } from "./sample.ts";

const base = "https://cdn.test/assets/0f8fad5b-d9cb-469f-a165-70867728950e";

/**
 * Answers the icon's URL with its JSON, anything else with 404, with the edge's minute, and remembers what was asked
 * for. `down` makes every request fail as a lost connection.
 */
function fakeEdge(status = 200) {
  const requests: string[] = [];
  const state = { down: false };
  const fetch = async (input: string | URL | Request) => {
    const url = String(input);
    requests.push(url);
    if (state.down) throw new TypeError("fetch failed");
    const known = new URL(url).pathname.endsWith("/gift-icon.json");
    return new Response(known ? JSON.stringify(icon) : "Unknown asset", { status: known ? status : 404, headers: { "Cache-Control": "public, max-age=60" } });
  };
  return { requests, state, fetch: fetch as typeof globalThis.fetch };
}

test("an id is read from the edge once a minute, with the language in the URL, and an unknown one is undefined", async () => {
  const edge = fakeEdge();
  const brua = createBrua({ base: base + "/", lang: "nb", fetch: edge.fetch });

  const first = await brua.asset("gift-icon");
  const again = await brua.asset("gift-icon");
  const missing = await brua.asset("nothing-released");

  assert.deepEqual(first, icon);
  assert.equal(again, first);
  assert.equal(missing, undefined);
  assert.deepEqual(edge.requests, [`${base}/gift-icon.json?lang=nb`, `${base}/nothing-released.json?lang=nb`]);
  assert.equal(brua.url("gift-icon"), `${base}/gift-icon.json?lang=nb`);
});

test("after its lifetime the asset is asked for again, and a failure is not remembered", async () => {
  const edge = fakeEdge();
  const brua = createBrua({ base, maxAge: 0, fetch: edge.fetch });
  await brua.asset("gift-icon");
  await brua.asset("gift-icon");
  assert.equal(edge.requests.length, 2);

  const failing = fakeEdge(500);
  const flaky = createBrua({ base, fetch: failing.fetch });
  await assert.rejects(flaky.asset("gift-icon"), /answered 500/);
  await assert.rejects(flaky.asset("gift-icon"));
  assert.equal(failing.requests.length, 2, "asked again right away");
});

test("the last release read is there at once, and kept when the edge can't be reached", async () => {
  const edge = fakeEdge();
  const brua = createBrua({ base, maxAge: 0, fetch: edge.fetch });
  assert.equal(brua.cachedAsset("gift-icon"), undefined);
  await brua.asset("gift-icon");
  assert.deepEqual(brua.cachedAsset("gift-icon"), icon);

  edge.state.down = true;
  assert.deepEqual(await brua.asset("gift-icon"), icon, "the stale release, not an error");
  await assert.rejects(brua.asset("never-read"), /fetch failed/);
});

test("reads of one id at the same time share a request, and an id with nothing released is remembered too", async () => {
  const edge = fakeEdge();
  const brua = createBrua({ base, fetch: edge.fetch });

  const [a, b] = await Promise.all([brua.asset("gift-icon"), brua.asset("gift-icon")]);
  await brua.asset("nothing-released");
  await brua.asset("nothing-released");

  assert.equal(a, b);
  assert.deepEqual(edge.requests, [`${base}/gift-icon.json`, `${base}/nothing-released.json`]);
});

test("prefetch reads every id once, so they are in memory", async () => {
  const edge = fakeEdge();
  const brua = createBrua({ base, fetch: edge.fetch });

  await brua.prefetch(["gift-icon", "gift-icon", "nothing-released"]);

  assert.deepEqual(brua.cachedAsset("gift-icon"), icon);
  assert.equal(edge.requests.length, 2);
});

test("in a browser without a language, the URL carries the browser's languages", (t) => {
  const g = globalThis as Record<string, unknown>;
  const had = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  g.window = {};
  Object.defineProperty(globalThis, "navigator", { value: { languages: ["nb-NO", "en"] }, configurable: true });
  t.after(() => {
    delete g.window;
    if (had) Object.defineProperty(globalThis, "navigator", had);
  });

  const url = new URL(createBrua({ base }).url("gift-icon"));

  assert.equal(url.searchParams.get("lang"), "nb-NO, en;q=0.9");
});

test("on the server the id form renders the fallback, and the provider hands the Brua down", () => {
  const edge = fakeEdge();
  const brua = createBrua({ base, fetch: edge.fetch });
  const html = renderToStaticMarkup(
    createElement(BruaProvider, { brua }, createElement(ReactPicture, { id: "gift-icon", fallback: createElement("span", { className: "skeleton" }) })),
  );
  assert.equal(html, '<span class="skeleton"></span>');
  assert.equal(renderToStaticMarkup(createElement(ReactPicture, { asset: icon, id: "ignored" })).startsWith("<picture>"), true, "a given asset wins");
  assert.throws(() => renderToStaticMarkup(createElement(ReactPicture, { id: "gift-icon" })), /BruaProvider/);
});

test("Vue reads the id through the provided Brua and shows the slot until it has loaded", async () => {
  const edge = fakeEdge();
  const app = createSSRApp({
    setup() { provideBrua({ base, fetch: edge.fetch }); },
    render: () => h(VuePicture, { id: "gift-icon" }, () => h("span", { class: "skeleton" })),
  });
  const html = await renderToString(app);
  assert.equal(html.replace(/<!--[^>]*-->/g, ""), '<span class="skeleton"></span>');
  assert.deepEqual(edge.requests, [`${base}/gift-icon.json`]);
});
