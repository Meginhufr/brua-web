// The step before the selection rule: how wide a picture is drawn in its box (fixtures/sizing).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { targetWidth } from "../src/sizing.ts";

// The shared fixtures: beside the package in its own repository, two levels up in the platform's.
const dir = [join(import.meta.dirname, "../fixtures/sizing"), join(import.meta.dirname, "../../../fixtures/sizing")].find(existsSync)!;

for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const fixture = JSON.parse(readFileSync(join(dir, file), "utf8"));
  test(`${file}: ${fixture.description}`, () => {
    assert.equal(targetWidth(fixture.asset, fixture.box.width, fixture.box.height, fixture.objectFit), fixture.expected);
  });
}
