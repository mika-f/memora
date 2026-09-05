import assert from "node:assert/strict";
import { test } from "vitest";
import {
  type PhotoMetadata,
  readMetadataContainer as parsePhotoMetadata,
} from "../dist/container.js";
import { itxt, png, vrcx, vrchat, resonite, jpeg } from "./fixtures.js";

const record = (value: unknown): Record<string, unknown> => {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
};
const description = (result: PhotoMetadata | null): unknown => {
  assert.ok(result);
  return record(record(record(result.xmp[0].data)["x:xmpmeta"])["rdf:RDF"])["rdf:Description"];
};

test("VRCX returns every JSON field, including unknown versions and nested values", async () => {
  const data = {
    ...JSON.parse(vrcx),
    version: 99,
    extra: { list: [null, false, 0, "001", { text: "  %E4%B8%96  " }] },
    players: [{ id: "usr_other", position: [1, 2, 3] }],
    empty: "",
  };
  const text = ` \n${JSON.stringify(data)}\n `;
  const parsed = await parsePhotoMetadata(png(itxt("Description", text)));
  assert.ok(parsed);
  assert.deepEqual(parsed.itxt[0].data, data);
  assert.equal(parsed.itxt[0].text, text);
  assert.equal("Platform" in parsed, false);
});
for (const legacy of [true, false])
  test(`VRChat ${legacy ? "old" : "new"} XMP retains source text`, async () => {
    const text = vrchat(legacy, "", "").replace(
      "</rdf:RDF>",
      '<rdf:Description xmlns:future="urn:test"><future:Value attr="001"> 001 </future:Value><future:Value>0</future:Value><future:Flag>false</future:Flag><future:Empty/><future:Entity>A &amp; B</future:Entity></rdf:Description></rdf:RDF>',
    );
    const result = await parsePhotoMetadata(png(itxt("XML:com.adobe.xmp", text)));
    assert.ok(result);
    assert.equal(result.xmp[0].text, text);
    const descriptions = description(result);
    assert.ok(Array.isArray(descriptions));
    assert.deepEqual(record(descriptions[4])["future:Value"], [
      { "#text": " 001 ", "@_attr": "001" },
      "0",
    ]);
    assert.equal(record(descriptions[4])["@_xmlns:future"], "urn:test");
    assert.equal(record(descriptions[4])["future:Flag"], "false");
    assert.equal(record(descriptions[4])["future:Empty"], "");
    assert.equal(record(descriptions[4])["future:Entity"], "A & B");
    if (!legacy) assert.equal(record(descriptions[3])["vrc:WorldDisplayName"], "");
  });
for (const container of [(xml: string) => png(itxt("XML:com.adobe.xmp", xml)), jpeg])
  test(`Resonite ${container === jpeg ? "JPEG" : "PNG"} retains URI escapes, timezone and scalar strings`, async () => {
    const result = await parsePhotoMetadata(container(resonite()));
    assert.ok(result);
    assert.equal(result.xmp[0].text, resonite());
    const data = record(description(result));
    assert.equal(data["rse:LocationName"], "%E4%B8%96%E7%95%8C");
    assert.equal(data["rse:TimeTaken"], "2025-05-01T22:50:02+09:00");
    assert.equal(data["rse:CameraFOV"], "0");
    assert.equal(record(data["rse:TakenBy"])["rse:U-Id"], "U-test");
    assert.equal(data.TakenAt, undefined);
  });
test("all simultaneous metadata and duplicate packets are returned in order", async () => {
  const result = await parsePhotoMetadata(
    png(
      itxt("Description", vrcx),
      itxt("Other", "  unknown  ", "ja", "説明"),
      itxt("XML:com.adobe.xmp", resonite(false)),
      itxt("XML:com.adobe.xmp", vrchat()),
    ),
  );
  assert.ok(result);
  assert.equal(result.itxt.length, 4);
  assert.equal(result.xmp.length, 2);
  assert.equal(result.itxt[1].text, "  unknown  ");
  assert.equal(result.itxt[1].languageTag, "ja");
  assert.equal(result.itxt[1].translatedKeyword, "説明");
  assert.equal(record(description(result))["rse:LocationName"], undefined);
});
test("compressed text and malformed JSON retain their original bytes", async () => {
  const result = await parsePhotoMetadata(
    png(itxt("Description", vrcx, "", "", true), itxt("Description", "{bad")),
  );
  assert.ok(result);
  assert.equal(result.itxt[0].compressionFlag, 1);
  assert.equal(result.itxt[0].text, vrcx);
  assert.deepEqual(result.itxt[0].data, JSON.parse(vrcx));
  assert.deepEqual(result.itxt[0].raw, itxt("Description", vrcx, "", "", true).subarray(8, -4));
  assert.equal(result.itxt[1].text, "{bad");
  assert.equal(result.itxt[1].data, null);
});
test("ArrayBuffer and offset Uint8Array inputs", async () => {
  const data = png(itxt("Description", vrcx));
  const padded = new Uint8Array(data.length + 20);
  padded.set(data, 10);
  assert.deepEqual(
    await parsePhotoMetadata(padded.subarray(10, -10)),
    await parsePhotoMetadata(data.buffer),
  );
});
test("unknown application metadata is not filtered and JSON source retains numeric spelling", async () => {
  const text = '{"application":"Future","n":9007199254740993,"negativeZero":-0,"exp":1e+3}';
  const result = await parsePhotoMetadata(png(itxt("Description", text)));
  assert.ok(result);
  assert.equal(result.itxt[0].text, text);
  assert.equal(record(result.itxt[0].data).application, "Future");
});
test("invalid files do not throw", async () => {
  assert.equal(await parsePhotoMetadata(new Uint8Array()), null);
  assert.equal(await parsePhotoMetadata(new Uint8Array([1, 2, 3])), null);
});

test("TIFF values keep numeric tag IDs, original date text and unknown tags", async () => {
  const date = new TextEncoder().encode("2025:05:01 22:50:02\0");
  const bytes = new Uint8Array(50 + date.length);
  const view = new DataView(bytes.buffer);
  bytes.set([73, 73, 42, 0, 8, 0, 0, 0]);
  view.setUint16(8, 3, true);
  for (const [i, tag, type, count, value] of [
    [0, 0x112, 3, 1, 6],
    [1, 0x132, 2, date.length, 50],
    [2, 0xc001, 3, 1, 42],
  ]) {
    const offset = 10 + i * 12;
    view.setUint16(offset, tag, true);
    view.setUint16(offset + 2, type, true);
    view.setUint32(offset + 4, count, true);
    view.setUint32(offset + 8, value, true);
  }
  bytes.set(date, 50);
  const result = await parsePhotoMetadata(bytes);
  assert.ok(result);
  assert.equal(record(record(result.exif).ifd0)[0x112], 6);
  assert.equal(record(record(result.exif).ifd0)[0x132], "2025:05:01 22:50:02");
  assert.equal(record(record(result.exif).ifd0)[0xc001], 42);
  assert.deepEqual(result.raw, bytes);
});
