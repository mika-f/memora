import { build } from "esbuild";

// Metro analyzes even unreachable dynamic require/import calls in exifr.
// Build its full source with the Node-only loader disabled, preserving all
// metadata parsers. On React Native the original loader also returns undefined.
// Compressed PNG iTXt is handled independently by our container's fflate code.
let nodeLoaderReplaced = false;
await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/react-native.js",
  bundle: true,
  platform: "browser",
  format: "esm",
  target: "es2020",
  // exifr probes UA at import time for browser CSS/canvas rotation behavior.
  // Native navigator may have no userAgent. Avoid that probe without mutating
  // the app's navigator or requiring an import-order-dependent polyfill.
  define: { "navigator.userAgent": '""' },
  alias: { exifr: "exifr/src/bundles/full.mjs" },
  plugins: [{
    name: "exifr-without-node-loader",
    setup(builder) {
      builder.onLoad({ filter: /[\\/]exifr[\\/]src[\\/]util[\\/]import\.mjs$/ }, () => {
        nodeLoaderReplaced = true;
        return {
          contents: "export default function () { return undefined; }",
          loader: "js",
        };
      });
    },
  }],
});

if (!nodeLoaderReplaced) {
  throw new Error("exifr's source layout changed; review the React Native build adapter.");
}
