import "./exifr-navigator-polyfill.js";
import exifr from "./exifr-full.js";
import { XMLParser } from "fast-xml-parser";
import { strFromU8, unzlibSync } from "fflate";
import extract from "png-chunks-extract";

export type PhotoInput = ArrayBuffer | Uint8Array;

export type XmpMetadata = {
  /** Original XML text, including whitespace and entity spellings. */
  text: string;
  /** All XML fields and attributes; no scalar coercion or namespace removal. */
  data: Record<string, unknown> | null;
};

export type PhotoTextChunk = {
  keyword: string;
  compressionFlag: number;
  compressionMethod: number;
  languageTag: string;
  translatedKeyword: string;
  /** Decompressed text, or null if the payload cannot be decoded. */
  text: string | null;
  /** Complete JSON value for Description chunks, otherwise null. */
  data: unknown;
  /** Original iTXt payload, including its header and compressed bytes. */
  raw: Uint8Array;
};

export type PhotoMetadata = {
  /** Original image bytes, for lossless access beyond the decoded views. */
  raw: Uint8Array;
  /** All blocks returned by exifr, with numeric tag IDs and value translation disabled. */
  exif: Record<string, unknown> | null;
  /** All PNG iTXt chunks in file order, including unknown keywords and versions. */
  itxt: PhotoTextChunk[];
  xmp: XmpMetadata[];
};

const parseXmp = (text: string): XmpMetadata => {
  try {
    const data = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: false,
      parseAttributeValue: false,
      trimValues: false,
      processEntities: true,
      ignoreDeclaration: false,
      ignorePiTags: false,
    }).parse(text);
    return { text, data };
  } catch {
    return { text, data: null };
  }
};

const readTextChunks = (bytes: Uint8Array): PhotoTextChunk[] => {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let offset = 8; offset < bytes.length;) {
      if (bytes.length - offset < 12) return [];
      const length = view.getUint32(offset);
      if (length > bytes.length - offset - 12) return [];
      offset += length + 12;
    }

    return extract(bytes)
      .filter((chunk) => chunk.name === "iTXt")
      .map(({ data: raw }) => {
        const result: PhotoTextChunk = {
          keyword: "",
          compressionFlag: 0,
          compressionMethod: 0,
          languageTag: "",
          translatedKeyword: "",
          text: null,
          data: null,
          raw,
        };

        try {
          const end = raw.indexOf(0);
          if (end < 1 || end + 5 > raw.length) return result;

          result.keyword = strFromU8(raw.subarray(0, end), true);
          result.compressionFlag = raw[end + 1];
          result.compressionMethod = raw[end + 2];
          const languageEnd = raw.indexOf(0, end + 3);
          if (languageEnd < 0) return result;

          result.languageTag = strFromU8(raw.subarray(end + 3, languageEnd), true);
          const translatedEnd = raw.indexOf(0, languageEnd + 1);
          if (translatedEnd < 0) return result;

          result.translatedKeyword = strFromU8(raw.subarray(languageEnd + 1, translatedEnd));
          const payload = raw.subarray(translatedEnd + 1);
          if (result.compressionMethod !== 0 || result.compressionFlag > 1) return result;

          result.text = strFromU8(result.compressionFlag === 1 ? unzlibSync(payload) : payload);
          if (result.keyword === "Description") result.data = JSON.parse(result.text);
        } catch {
          // Keep the original bytes and any readable fields even if decoding fails.
        }
        return result;
      });
  } catch {
    return [];
  }
};

/** Return embedded metadata without platform filtering, renaming, defaults or value normalization. */
export const readMetadataContainer = async (input: PhotoInput): Promise<PhotoMetadata | null> => {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const itxt = readTextChunks(bytes);
  let exif: Record<string, unknown> | null = null;
  try {
    exif =
      (await exifr.parse(bytes, {
        tiff: true,
        ifd1: true,
        interop: true,
        makerNote: true,
        userComment: true,
        multiSegment: true,
        exif: true,
        gps: true,
        iptc: true,
        icc: true,
        jfif: true,
        xmp: { parse: false },
        translateKeys: false,
        translateValues: false,
        reviveValues: false,
        sanitize: false,
        mergeOutput: false,
      })) ?? null;
  } catch {
    // iTXt remains available when another metadata block is unsupported or damaged.
  }
  const xmp = itxt
    .filter((chunk) => chunk.keyword === "XML:com.adobe.xmp" && chunk.text !== null)
    .map((chunk) => parseXmp(chunk.text!));
  // PNG XMP is already captured above, including duplicate packets and original headers.
  if (xmp.length === 0 && typeof exif?.xmp === "string") xmp.push(parseXmp(exif.xmp));
  return exif || itxt.length ? { raw: bytes, exif, itxt, xmp } : null;
};
