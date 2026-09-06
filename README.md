# Memora

Memora は、VRChat・VRCX・ResoniteScreenshotExtensions が画像に埋め込んだメタデータを読み取る TypeScript ライブラリです。撮影者、ワールド、カメラ設定、参加者の位置・姿勢などを、形式ごとの型付きオブジェクトとして取得できます。

Node.js、ブラウザー、React Native 向けに、`ArrayBuffer` または `Uint8Array` を受け取る API を提供します。ファイルの読み取りやネットワークアクセスは呼び出し側で行います。

## インストール

```sh
$ pnpm install @natsuneko-laboratory/memora
```

## クイックスタート

```ts
import { parseImageMetadata } from "@natsuneko-laboratory/memora";

// bytes: ArrayBuffer | Uint8Array
const metadata = await parseImageMetadata(bytes);

if (metadata) {
  switch (metadata.type) {
    case "VRChat":
      console.log(metadata.author, metadata.worldDisplayName, metadata.createDate);
      break;

    case "VRCX":
      console.log(metadata.author?.displayName, metadata.world?.instanceId);
      console.log(metadata.players);
      break;

    case "ResoniteScreenshotExtensions":
      console.log(metadata.takenBy?.name, metadata.cameraFOV);
      console.log(metadata.userInfos);
      break;
  }
}
```

`type` で分岐すると、その形式のプロパティへ型安全にアクセスできます。メタデータがない画像や、対応形式を認識できない入力では `null` を返します。

## API

### `parseImageMetadata(input)`

```ts
function parseImageMetadata(input: ArrayBuffer | Uint8Array): Promise<ImageMetadata | null>;
```

画像から 1 件のメタデータを取得します。複数形式が同居する場合は ResoniteScreenshotExtensions を優先し、それ以外は解析結果の先頭を返します。

`parsePhotoMetadata` はこの関数の別名です。

### `parseAllImageMetadata(input)`

```ts
function parseAllImageMetadata(input: ArrayBuffer | Uint8Array): Promise<ImageMetadata[]>;
```

画像内で認識できたすべてのメタデータを取得します。複数形式や複数パケットを扱う場合に使用してください。認識できるメタデータがなければ空配列を返します。

### `ImageMetadata`

```ts
type ImageMetadata =
  VrcxImageMetadata | VRChatImageMetadata | ResoniteScreenshotExtensionsImageMetadata;
```

すべての形式に、次のプロパティがあります。

| プロパティ | 型                                                     | 内容                                                   |
| ---------- | ------------------------------------------------------ | ------------------------------------------------------ |
| `type`     | `"VRCX" \| "VRChat" \| "ResoniteScreenshotExtensions"` | メタデータの形式                                       |
| `raw`      | `Uint8Array`                                           | 元画像全体のバイト列                                   |
| `extra`    | `Record<string, unknown>`                              | 型定義にない項目、または期待する型へ解析できなかった値 |

画像に含まれない項目は optional プロパティとして扱います。空文字が埋め込まれている場合は、その空文字を保持します。

## 対応形式とフィールド

### VRChat

`type: "VRChat"`

- `creatorTool`, `author`, `authorId`
- `worldId`, `worldDisplayName`
- `createDate`, `modifyDate`, `dateTime`
- `title`: 言語ごとの `{ value: string; language?: string }[]`
- `world`: 旧形式の `vrc:World`

旧形式の `author` にはユーザー ID が入る場合があります。新しい形式では表示名と `authorId` を別々に取得できます。

### VRCX

`type: "VRCX"`

- `application`, `version`
- `author`: `id`, `displayName`
- `world`: `id`, `name`, `instanceId`
- `players`: `id`, `displayName` を持つユーザーの配列

ユーザーとワールドには、それぞれ `extra` もあります。

### ResoniteScreenshotExtensions

`type: "ResoniteScreenshotExtensions"`

- 場所: `locationName`, `locationAccessLevel`, `locationHiddenFromListing`, `locationHost`
- 撮影: `timeTaken`, `takenBy`, `takenGlobalPosition`, `takenGlobalRotation`, `takenGlobalScale`
- アプリ・カメラ: `appVersion`, `cameraManufacturer`, `cameraModel`, `cameraFOV`, `is360`, `stereoLayout`
- 参加者: `userInfos`

`locationHost` と `takenBy` は `id`, `name`, `machineId`, `extra` を持ちます。`userInfos` の各要素には、さらに次のフィールドがあります。

- `isInVR`, `isPresent`
- `headPosition`, `headOrientation`
- `sessionJoinTimestamp`

`userInfos` は、ユーザーが 1 人の場合も配列です。

## 値の扱い

- 日時は元の文字列を保持します。タイムゾーン変換や `Date` 化を行わず、小数秒の精度も維持します。
- Resonite の名前は Unicode / URI エスケープを復元します。
- 真偽値は `boolean`、カメラの画角は `number` に解析します。
- 位置・スケールは `Vector3`（`[number, number, number]`）、回転は `Quaternion`（`[number, number, number, number]`）に解析します。座標変換や正規化は行いません。
- 未知の項目や解析できない値は `extra` に保持し、既定値で補完しません。

XML の属性や名前空間の構造は、形式ごとのプロパティへ整理されます。構文表記まで含めた元データが必要な場合は `raw` を利用してください。JSON 数値の精度は JavaScript の `number` に従います。

## 実行環境ごとの利用例

### Node.js

```ts
import { readFile } from "node:fs/promises";
import { parseImageMetadata } from "@natsuneko-laboratory/memora";

const bytes = await readFile("screenshot.png");
const metadata = await parseImageMetadata(bytes);
```

### ブラウザー

```ts
import { parseImageMetadata } from "@natsuneko-laboratory/memora";

async function readScreenshot(file: File | Blob) {
  return parseImageMetadata(await file.arrayBuffer());
}
```

### React Native

```ts
import { parseImageMetadata } from "@natsuneko-laboratory/memora";

async function readScreenshot(uri: string, readBytes: (uri: string) => Promise<Uint8Array>) {
  const bytes = await readBytes(uri);
  return parseImageMetadata(bytes);
}
```

`readBytes` には、アプリで採用しているファイルアクセスライブラリを使った読み取り関数を渡してください。URI、Base64、`File`、`Blob` をパーサーへ直接渡すことはできません。

Metro は `react-native` 条件（従来の解決方式では同名のフィールド）から専用バンドルを読み込みます。Node.js モジュールのポリフィルや Metro の追加設定は不要です。

## 対応範囲と制約

PNG の iTXt（非圧縮・zlib 圧縮）と XMP を読み取ります。ResoniteScreenshotExtensions の JPEG XMP にも対応します。

画像のリサイズ・再圧縮・形式変換により、メタデータが削除される場合があります。変換前の元画像を使用してください。

コアは React やネイティブモジュールに依存しません。Node.js の `Buffer` / `process`、DOM、`TextDecoder` がない環境でのバンドルテストを用意しています。

React Native 向けには、依存先 `exifr` の Node.js 専用ローダーを除いたバンドルを生成します。v0.1.0 では、このローダーの動的 `import` が Metro の依存解析エラーを起こしていました。Metro によるパッケージ解決・バンドルと、ホスト API のない環境での PNG・JPEG 解析を回帰テストで検証しています。iOS / Android 実機でのテストではありません。

## 開発

リポジトリを取得した後、パッケージのディレクトリで実行します。

```sh
npm install
npm test
npm run typecheck
npm run build
```

テストは TypeScript と Vitest で記述しています。実画像と合成画像を用い、形式の判別、全フィールドの取得、元バイト列の保持、部分バッファ入力、実行環境への依存を検証します。

`npm run typecheck` は本体とテストの両方を検証します。テストのみの型チェックには `npm run typecheck:test` を使用できます。

ビルドすると、ESM、React Native 向けバンドル、型定義が `dist/` に生成されます。インストール時のスクリプトを無効にしている場合は、利用前に `npm run build` を実行してください。

## ライセンス

MIT
