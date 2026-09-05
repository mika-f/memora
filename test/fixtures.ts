// Synthetic, 1x1 PNG/JPEG containers. No user screenshots or personal data.
import { deflateSync } from "node:zlib";

const utf8 = (text: string) => new TextEncoder().encode(text);
const concat = (...arrays: Uint8Array[]) => {
  const out = new Uint8Array(arrays.reduce((size, a) => size + a.length, 0));
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
};
const chunk = (name: string, data: Uint8Array) => {
  const body = concat(utf8(name), data);
  let crc = -1;
  for (const byte of body) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const out = new Uint8Array(data.length + 12);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(body, 4);
  view.setUint32(out.length - 4, (crc ^ -1) >>> 0);
  return out;
};
export const itxt = (
  keyword: string,
  text: string,
  language = "",
  translated = "",
  compressed = false,
) =>
  chunk(
    "iTXt",
    concat(
      utf8(keyword),
      new Uint8Array([0, compressed ? 1 : 0, 0]),
      utf8(language),
      new Uint8Array(1),
      utf8(translated),
      new Uint8Array(1),
      compressed ? deflateSync(utf8(text)) : utf8(text),
    ),
  );
export const png = (...chunks: Uint8Array[]) =>
  concat(
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", new Uint8Array([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])),
    ...chunks,
    chunk("IDAT", deflateSync(new Uint8Array(5))),
    chunk("IEND", new Uint8Array()),
  );
export const vrcx = JSON.stringify({
  application: "VRCX",
  version: 1,
  world: { name: "日本語の世界 🌏", id: "wrld_test" },
  author: { displayName: "撮影者", id: "usr_test" },
});
export const vrchat = (
  legacy = false,
  world = "wrld_test",
  name = "Test World",
) => `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description xmlns:xmp="http://ns.adobe.com/xap/1.0/"><xmp:CreatorTool>VRChat</xmp:CreatorTool><xmp:Author>${legacy ? "usr_test" : "Photographer"}</xmp:Author></rdf:Description>
<rdf:Description xmlns:tiff="http://ns.adobe.com/tiff/1.0/"><tiff:Make>VRChat</tiff:Make></rdf:Description>
<rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Screenshot</dc:title></rdf:Description>
<rdf:Description xmlns:vrc="http://ns.vrchat.com/vrc/1.0/">${legacy ? "<vrc:World>wrld_test</vrc:World>" : `<vrc:AuthorID>usr_test</vrc:AuthorID><vrc:WorldID>${world}</vrc:WorldID><vrc:WorldDisplayName>${name}</vrc:WorldDisplayName>`}</rdf:Description>
</rdf:RDF></x:xmpmeta>`;
export const resonite = (
  full = true,
) => `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:rse="http://ns.baru.dev/resonite-ss-ext/2.0/">
<rse:CameraManufacturer>Resonite</rse:CameraManufacturer>${
  full
    ? `
<rse:LocationName>%E4%B8%96%E7%95%8C</rse:LocationName>
<rse:TimeTaken>2025-05-01T22:50:02+09:00</rse:TimeTaken>
<rse:TakenBy rdf:parseType="Resource"><rse:U-Name>%E6%92%AE%E5%BD%B1%E8%80%85</rse:U-Name><rse:U-Id>U-test</rse:U-Id></rse:TakenBy>
<rse:AppVersion>2025.5.1</rse:AppVersion><rse:CameraFOV>0</rse:CameraFOV>`
    : ""
}
</rdf:Description></rdf:RDF></x:xmpmeta>`;
export const jpeg = (xml: string) => {
  const payload = concat(utf8("http://ns.adobe.com/xap/1.0/\0"), utf8(xml));
  const header = new Uint8Array([255, 216, 255, 225, 0, 0]);
  new DataView(header.buffer).setUint16(4, payload.length + 2);
  return concat(header, payload, new Uint8Array([255, 217]));
};
