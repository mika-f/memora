// exifr ships its unbundled ESM sources under `src/`, but only publishes
// types for its bundled entry point ("exifr" -> index.d.ts). ./exifr-full.ts
// and ./exifr-png-parser.ts import these internal modules directly to avoid
// exifr's own "full" bundle, which is unparseable by Hermes (see
// ./exifr-full.ts). None of them ship types, so treat them as untyped.
declare module "exifr/src/*" {
  const value: any;
  export default value;
  export const parse: any;
}

declare module "exifr/src/parser.mjs" {
  export class FileParserBase {
    file: any;
    options: any;
    parsers: any;
    errors: unknown[];
    createParser(type: string, chunk: unknown): unknown;
    injectSegment(type: string, chunk: unknown): unknown;
    readSegments(segments: unknown[]): Promise<unknown>;
  }
}

declare module "exifr/src/plugins.mjs" {
  export const fileParsers: Map<string, unknown>;
  export const segmentParsers: Map<string, unknown>;
}
