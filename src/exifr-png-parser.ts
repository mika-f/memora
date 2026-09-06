// Adapted from exifr's `file-parsers/png.mjs` (MIT licensed, © Mike Kovarik).
// The only change: dropped the zlib-compressed ICC profile branch, which
// pulled in exifr's `util/import.mjs` and its Hermes-unparseable dynamic
// `import(name)` fallback (see ./exifr-full.ts for the full explanation).
// exifr itself already skips that branch outside of Node, and the screenshot
// tools memora targets (VRChat, VRCX, ResoniteScreenshotExtensions) don't
// embed compressed ICC profiles, so nothing memora reads is affected.
import { FileParserBase } from "exifr/src/parser.mjs";
import { fileParsers } from "exifr/src/plugins.mjs";

const PNG_MAGIC_BYTES_LENGTH = 8;
const PNG_XMP_PREFIX = "XML:com.adobe.xmp";
const LENGTH_SIZE = 4;
const TYPE_SIZE = 4;
const CRC_SIZE = 4;
const IHDR = "ihdr";
const TEXT = "text";
const ITXT = "itxt";
const EXIF = "exif";
const pngMetaChunks = [IHDR, TEXT, ITXT, EXIF];

export class PngFileParser extends FileParserBase {
  static type = "png";

  static canHandle(file: any, firstTwoBytes: number) {
    return (
      firstTwoBytes === 0x8950 &&
      file.getUint32(0) === 0x89504e47 &&
      file.getUint32(4) === 0x0d0a1a0a
    );
  }

  async parse() {
    const { file } = this;
    await this.findPngChunksInRange(PNG_MAGIC_BYTES_LENGTH, file.byteLength);
    await this.readSegments(this.metaChunks);
    this.findIhdr();
    this.parseTextChunks();
    await this.findExif().catch(this.catchError);
    await this.findXmp().catch(this.catchError);
  }

  catchError = (err: unknown) => this.errors.push(err);

  metaChunks: any[] = [];
  unknownChunks: any[] = [];

  async findPngChunksInRange(offset: number, end: number) {
    const { file } = this;
    while (offset < end) {
      const size = file.getUint32(offset);
      const marker = file.getUint32(offset + LENGTH_SIZE);
      const name = file.getString(offset + LENGTH_SIZE, 4);
      const type = name.toLowerCase();
      const start = offset + LENGTH_SIZE + TYPE_SIZE;
      const length = size + LENGTH_SIZE + TYPE_SIZE + CRC_SIZE;
      const seg = { type, offset, length, start, size, marker };
      if (pngMetaChunks.includes(type)) this.metaChunks.push(seg);
      else this.unknownChunks.push(seg);
      offset += length;
    }
  }

  parseTextChunks() {
    const textChunks = this.metaChunks.filter((info) => info.type === TEXT);
    for (const seg of textChunks) {
      const [key, val] = this.file.getString(seg.start, seg.size).split("\0");
      this.injectKeyValToIhdr(key, val);
    }
  }

  injectKeyValToIhdr(key: string, val: string) {
    const parser = this.parsers.ihdr;
    if (parser) parser.raw.set(key, val);
  }

  findIhdr() {
    const seg = this.metaChunks.find((seg) => seg.type === IHDR);
    if (!seg) return;
    if (this.options[IHDR].enabled !== false) this.createParser(IHDR, seg.chunk);
  }

  async findExif() {
    const seg = this.metaChunks.find((info) => info.type === "exif");
    if (!seg) return;
    this.injectSegment("tiff", seg.chunk);
  }

  async findXmp() {
    const itxtChunks = this.metaChunks.filter((info) => info.type === ITXT);
    for (const seg of itxtChunks) {
      const prefix = seg.chunk.getString(0, PNG_XMP_PREFIX.length);
      if (prefix === PNG_XMP_PREFIX) this.injectSegment("xmp", seg.chunk);
    }
  }
}

fileParsers.set("png", PngFileParser);
