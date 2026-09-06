import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";
import { test } from "vitest";
import { loadConfig, runBuild } from "metro";
import { itxt, jpeg, png, resonite, vrcx, vrchat } from "./fixtures.js";

const require = createRequire(import.meta.url);
const metroRequire = createRequire(require.resolve("metro"));

for (const exportsEnabled of [true, false]) {
  test(`Metro native package resolution (exports: ${exportsEnabled})`, async () => {
    const config = await loadConfig({ cwd: process.cwd() }, {
      projectRoot: process.cwd(),
      maxWorkers: 1,
      cacheStores: [],
      reporter: { update() {} },
      transformer: {
        asyncRequireModulePath: metroRequire.resolve("metro-runtime/src/modules/asyncRequire"),
        getTransformOptions: async () => ({
          transform: { experimentalImportSupport: true, inlineRequires: false },
        }),
      },
      resolver: {
        useWatchman: false,
        resolverMainFields: ["react-native", "browser", "main"],
        unstable_enablePackageExports: exportsEnabled,
        unstable_conditionNames: ["require", "react-native"],
        extraNodeModules: { "@natsuneko-laboratory/memora": process.cwd() },
      },
    });
    const { code } = await runBuild(config, {
      entry: "test/metro-entry.js",
      platform: "ios",
      dev: false,
      minify: false,
    });
    for (const globals of [{}, { navigator: Object.freeze({ product: "ReactNative" }) }]) {
      const context = vm.createContext(globals);
      vm.runInContext("globalThis.global = globalThis", context);
      vm.runInContext(code, context);
      for (const [input, type] of [
        [png(itxt("Description", vrcx)), "VRCX"],
        [png(itxt("Description", vrcx, "", "", true)), "VRCX"],
        [png(itxt("XML:com.adobe.xmp", vrchat())), "VRChat"],
        [png(itxt("XML:com.adobe.xmp", resonite(), "", "", true)), "ResoniteScreenshotExtensions"],
        [jpeg(resonite()), "ResoniteScreenshotExtensions"],
      ] as const) {
        context.bytes = Array.from(input);
        const metadata = await vm.runInContext(
          "PhotoParser.parseImageMetadata(new Uint8Array(bytes))", context,
        );
        assert.equal(metadata?.type, type);
        if (type === "VRCX") assert.equal(metadata.world.name, "日本語の世界 🌏");
        if (type === "ResoniteScreenshotExtensions") assert.equal(metadata.locationName, "世界");
      }
      if ("navigator" in globals) {
        assert.equal(Object.prototype.hasOwnProperty.call(globals.navigator, "userAgent"), false);
      }
    }
  }, 30_000);
}
