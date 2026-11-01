import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { selectUrl } from "../src/select.ts";

// The shared fixtures: beside the package in its own repository, two levels up in the platform's.
const dir = [join(import.meta.dirname, "../fixtures/selection"), join(import.meta.dirname, "../../../fixtures/selection")].find(existsSync)!;

for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const fixture = JSON.parse(readFileSync(join(dir, file), "utf8"));
  test(`${file}: ${fixture.description}`, () => {
    assert.equal(selectUrl(fixture.asset, fixture.client), fixture.expected);
  });
}
