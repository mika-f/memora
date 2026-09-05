import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { describe, expect, test } from "vitest";
import { parseAllImageMetadata, parseImageMetadata } from "../dist/index.js";

const fixtureUrl = (name: string) => new URL(`./fixtures/${name}`, import.meta.url);
const manifest: Record<string, { bytes: number; sha256: string }> = JSON.parse(
  readFileSync(fixtureUrl("manifest.json"), "utf8"),
);

// Expected values are independently decoded from PNG iTXt JSON/XML, not generated
// by the implementation under test. Compare the entire model, including all users.
describe.each([
  ["vrchat", "VRChat"],
  ["resonite-screenshot-extensions", "ResoniteScreenshotExtensions"],
  ["vrcx", "VRCX"],
])("supplied %s image", (name, type) => {
  const bytes = new Uint8Array(readFileSync(fixtureUrl(`${name}.png`)));
  const expected: unknown = JSON.parse(readFileSync(fixtureUrl(`${name}.expected.json`), "utf8"));

  test("fixture is the original supplied image", () => {
    expect(bytes.byteLength).toBe(manifest[name].bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(manifest[name].sha256);
  });

  test("returns the correct discriminator and every embedded field", async () => {
    const metadata = await parseImageMetadata(bytes);
    expect(metadata?.type).toBe(type);
    assert.ok(metadata);
    const { raw, ...fields } = metadata;
    expect(fields).toStrictEqual(expected);
    expect(Buffer.compare(raw, bytes)).toBe(0);
  });

  test("ArrayBuffer and a sliced Uint8Array produce the same complete model", async () => {
    const padded = new Uint8Array(bytes.length + 16);
    padded.set(bytes, 8);
    for (const input of [bytes.buffer, padded.subarray(8, -8)]) {
      const metadata = await parseImageMetadata(input);
      assert.ok(metadata);
      const { raw, ...fields } = metadata;
      expect(fields).toStrictEqual(expected);
      expect(Buffer.compare(raw, bytes)).toBe(0);
    }
  });

  test("all-results API finds exactly one complete metadata record", async () => {
    const results = await parseAllImageMetadata(bytes);
    expect(results).toHaveLength(1);
    const { raw, ...fields } = results[0];
    expect(fields).toStrictEqual(expected);
    expect(Buffer.compare(raw, bytes)).toBe(0);
  });
});
