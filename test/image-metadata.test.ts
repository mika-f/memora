import assert from "node:assert/strict";
import { test } from "vitest";
import { parseImageMetadata, parseAllImageMetadata } from "../dist/index.js";
import { png, itxt, vrchat, resonite, vrcx, jpeg } from "./fixtures.js";

test("VRCX: author, instance and every player have typed fields; extensions survive", async () => {
  const source = {
    ...JSON.parse(vrcx),
    world: { id: "wrld_test", name: "世界", instanceId: "instance", future: 42 },
    players: [{ id: "usr_test", displayName: "Name", other: [1, 2] }],
    future: { a: true },
  };
  const bytes = png(itxt("Description", JSON.stringify(source)));
  const result = await parseImageMetadata(bytes);
  assert.ok(result);
  assert.equal(result.type, "VRCX");
  assert.ok(result.author);
  assert.ok(result.world);
  assert.equal(result.version, 1);
  assert.equal(result.author.id, "usr_test");
  assert.equal(result.world.instanceId, "instance");
  assert.deepEqual(result.players, [
    { id: "usr_test", displayName: "Name", extra: { other: [1, 2] } },
  ]);
  assert.deepEqual(result.world.extra, { future: 42 });
  assert.deepEqual(result.extra, { future: { a: true } });
  assert.deepEqual(result.raw, bytes);
});
test("VRChat: typed fields include all dates, localized title and future properties", async () => {
  const xml = vrchat()
    .replace(
      "</xmp:Author>",
      "</xmp:Author><xmp:CreateDate>2026-02-08T07:38:55.0000000+09:00</xmp:CreateDate><xmp:ModifyDate>unchanged</xmp:ModifyDate>",
    )
    .replace("<tiff:Make>VRChat</tiff:Make>", "<tiff:DateTime>original</tiff:DateTime>")
    .replace(
      "<dc:title>Screenshot</dc:title>",
      '<dc:title><rdf:Alt><rdf:li xml:lang="x-default"/><rdf:li xml:lang="ja">タイトル</rdf:li></rdf:Alt></dc:title>',
    )
    .replace("</vrc:WorldID>", "</vrc:WorldID><vrc:Future>001</vrc:Future>");
  const result = await parseImageMetadata(png(itxt("XML:com.adobe.xmp", xml)));
  assert.ok(result);
  assert.equal(result.type, "VRChat");
  assert.equal(result.authorId, "usr_test");
  assert.equal(result.worldId, "wrld_test");
  assert.equal(result.worldDisplayName, "Test World");
  assert.equal(result.createDate, "2026-02-08T07:38:55.0000000+09:00");
  assert.equal(result.modifyDate, "unchanged");
  assert.equal(result.dateTime, "original");
  assert.deepEqual(result.title, [
    { value: "", language: "x-default" },
    { value: "タイトル", language: "ja" },
  ]);
  assert.deepEqual(result.extra, { "vrc:Future": "001" });
});
// Mirrors the attribute-based RSE 2.0 shape of the supplied image, using invented identities.
const rse = `<?xpacket begin="﻿"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:rse="http://ns.baru.dev/resonite-ss-ext/2.0/" rse:CameraManufacturer="Resonite" rse:LocationName="%E4%B8%96%E7%95%8C" rse:LocationAccessLevel="ContactsPlus" rse:LocationHiddenFromListing="false" rse:TimeTaken="2026-08-11T11:51:02.4597725Z" rse:TakenGlobalPosition="[0; 0; 0]" rse:TakenGlobalRotation="[0; 0; 0; 1]" rse:TakenGlobalScale="[1; 1; 1]" rse:AppVersion="2026.8.7.887" rse:CameraModel="PhotoCaptureManager" rse:CameraFOV="60" rse:Is360="false" rse:StereoLayout="None" rse:Future="001">
<rse:LocationHost rse:U-Id="U-host" rse:U-Name="Host" rse:U-MachineId="machine-host"/>
<rse:TakenBy rse:U-Id="U-author" rse:U-Name="\\u64AE\\u5F71\\u8005" rse:U-MachineId="machine-author"/>
<rse:UserInfos>${Array.from({ length: 7 }, (_, i) => `<rse:UserInfo rse:U-Id="U-${i}" rse:U-Name="User ${i}" rse:U-MachineId="machine-${i}" rse:UI-IsInVR="false" rse:UI-IsPresent="${i !== 0}" rse:UI-HeadPosition="[-0.099254206; 1.4309509; 2.881267]" rse:UI-HeadOrientation="[0.33423126; -0.31151053; 0.14922492; 0.8769165]" rse:UI-SessionJoinTimestamp="0001-01-01T00:00:00" rse:Future="preserved"/>`).join("")}</rse:UserInfos></rdf:Description></rdf:RDF><?xpacket end="w"?>`;
for (const container of [(xml: string) => png(itxt("XML:com.adobe.xmp", xml)), jpeg])
  test(`RSE typed attributes and complete user list (${container === jpeg ? "JPEG" : "PNG"})`, async () => {
    const result = await parseImageMetadata(container(rse));
    assert.ok(result);
    assert.equal(result.type, "ResoniteScreenshotExtensions");
    assert.ok(result.takenBy);
    assert.ok(result.locationHost);
    assert.ok(result.userInfos);
    assert.equal(result.locationName, "世界");
    assert.equal(result.locationAccessLevel, "ContactsPlus");
    assert.equal(result.locationHiddenFromListing, false);
    assert.equal(result.timeTaken, "2026-08-11T11:51:02.4597725Z");
    assert.deepEqual(result.takenGlobalPosition, [0, 0, 0]);
    assert.deepEqual(result.takenGlobalRotation, [0, 0, 0, 1]);
    assert.deepEqual(result.takenGlobalScale, [1, 1, 1]);
    assert.equal(result.appVersion, "2026.8.7.887");
    assert.equal(result.cameraModel, "PhotoCaptureManager");
    assert.equal(result.cameraFOV, 60);
    assert.equal(result.is360, false);
    assert.equal(result.stereoLayout, "None");
    assert.equal(result.takenBy.name, "撮影者");
    assert.equal(result.locationHost.machineId, "machine-host");
    assert.equal(result.userInfos.length, 7);
    assert.equal(result.userInfos[0].isPresent, false);
    assert.equal(result.userInfos[1].isPresent, true);
    assert.equal(result.userInfos[1].isInVR, false);
    assert.deepEqual(result.userInfos[1].headPosition, [-0.099254206, 1.4309509, 2.881267]);
    assert.deepEqual(
      result.userInfos[1].headOrientation,
      [0.33423126, -0.31151053, 0.14922492, 0.8769165],
    );
    assert.equal(result.userInfos[1].sessionJoinTimestamp, "0001-01-01T00:00:00");
    assert.deepEqual(result.userInfos[1].extra, { "rse:Future": "preserved" });
    assert.deepEqual(result.extra, { "rse:Future": "001" });
  });
test("single RSE user is still an array; invalid typed values stay in extra", async () => {
  const xml = rse
    .replace(
      /<rse:UserInfos>[\s\S]*?<\/rse:UserInfos>/,
      '<rse:UserInfos><rse:UserInfo rse:U-Id="U-one" rse:UI-IsInVR="unknown"/></rse:UserInfos>',
    )
    .replace('rse:CameraFOV="60"', 'rse:CameraFOV="invalid"');
  const result = await parseImageMetadata(png(itxt("XML:com.adobe.xmp", xml)));
  assert.ok(result);
  assert.equal(result.type, "ResoniteScreenshotExtensions");
  assert.ok(result.userInfos);
  assert.equal(result.userInfos.length, 1);
  assert.equal(result.userInfos[0].isInVR, undefined);
  assert.equal(result.userInfos[0].extra["rse:UI-IsInVR"], "unknown");
  assert.equal(result.cameraFOV, undefined);
  assert.equal(result.extra["rse:CameraFOV"], "invalid");
});
test("legacy VRChat and private worlds are not given synthesized values", async () => {
  const legacy = await parseImageMetadata(png(itxt("XML:com.adobe.xmp", vrchat(true))));
  assert.ok(legacy);
  assert.equal(legacy.type, "VRChat");
  assert.equal(legacy.author, "usr_test");
  assert.equal(legacy.world, "wrld_test");
  assert.equal(legacy.authorId, undefined);
  const priv = await parseImageMetadata(png(itxt("XML:com.adobe.xmp", vrchat(false, "", ""))));
  assert.ok(priv);
  assert.equal(priv.type, "VRChat");
  assert.equal(priv.worldId, "");
  assert.equal(priv.worldDisplayName, "");
});
test("mixed images expose all recognized formats; singular API retains Resonite precedence", async () => {
  const bytes = png(
    itxt("Description", vrcx),
    itxt("XML:com.adobe.xmp", vrchat()),
    itxt("XML:com.adobe.xmp", resonite()),
  );
  assert.deepEqual(
    (await parseAllImageMetadata(bytes)).map((v) => v.type),
    ["VRCX", "VRChat", "ResoniteScreenshotExtensions"],
  );
  const preferred = await parseImageMetadata(bytes);
  assert.ok(preferred);
  assert.equal(preferred.type, "ResoniteScreenshotExtensions");
  assert.equal(await parseImageMetadata(png()), null);
  assert.deepEqual(await parseAllImageMetadata(new Uint8Array()), []);
});
