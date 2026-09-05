import assert from "node:assert/strict";
import { test } from "vitest";
import type { ImageMetadata } from "../dist/index.js";
import vm from "node:vm";
import { build } from "esbuild";
import { png, itxt, vrcx, vrchat, resonite, jpeg } from "./fixtures.js";

// Exercise a bundled JS runtime without Node, DOM, TextDecoder or native modules.
// This is a portability regression check, not an iOS/Android device test.
for (const mainFields of [
  ["browser", "module", "main"],
  ["react-native", "browser", "main"],
]) {
  test(`byte parsing without host APIs (${mainFields.join(", ")})`, async () => {
    const result = await build({
      entryPoints: ["src/index.ts"],
      bundle: true,
      write: false,
      platform: "browser",
      format: "iife",
      globalName: "PhotoParser",
      mainFields,
    });
    const context = vm.createContext({});
    vm.runInContext(
      mainFields[0] === "browser"
        ? "globalThis.self = globalThis"
        : "globalThis.global = globalThis",
      context,
    );
    vm.runInContext(result.outputFiles[0].text, context);
    for (const [input, platform] of [
      [png(itxt("Description", vrcx)), "VRChat"],
      [png(itxt("XML:com.adobe.xmp", vrchat())), "VRChat"],
      [png(itxt("XML:com.adobe.xmp", resonite())), "Resonite"],
      [jpeg(resonite()), "Resonite"],
    ] as const) {
      context.bytes = Array.from(input);
      const metadata: ImageMetadata | null = await vm.runInContext(
        "PhotoParser.parsePhotoMetadata(new Uint8Array(bytes))",
        context,
      );
      assert.ok(metadata);
      if (metadata.type === "VRCX") {
        assert.ok(metadata.world);
        assert.equal(metadata.world.name, "日本語の世界 🌏");
      } else if (metadata.type === "ResoniteScreenshotExtensions")
        assert.equal(metadata.locationName, "世界");
      else assert.equal(metadata.type, "VRChat");
    }
  });
}
