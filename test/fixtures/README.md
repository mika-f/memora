# Supplied screenshot fixtures

2026-09-04 の画像パーサー作業でユーザーが提供し、回帰テストへの使用を指定した元画像です。リサイズや再エンコードをせずに保存しています。

| Fixture                              | 形式                         | 元ファイル名                                     |
| ------------------------------------ | ---------------------------- | ------------------------------------------------ |
| `vrchat.png`                         | VRChat                       | `media_21c156cb-a4d1-4ddc-9119-215e7c1c98fd.png` |
| `resonite-screenshot-extensions.png` | ResoniteScreenshotExtensions | `media_c1f41a40-53d1-4fd8-a1c1-169e256a9b4e.png` |
| `vrcx.png`                           | VRCX                         | `media_0a3b8067-3195-47f4-ab84-8b3645fd7eae.png` |

`manifest.json` に元ファイルのバイト数と SHA-256 を固定しています。テストは Downloads などのローカルディレクトリには依存しません。

`*.expected.json` は PNG iTXt 内の JSON / XML を、実装とは別のデコーダーで読み取って作成した期待値です。メタデータの全フィールドを比較し、Resonite の参加者 7 人分のユーザー ID・名前・Machine ID・位置・姿勢・状態・参加日時、VRCX の instanceId と players、VRChat の日時精度や空のタイトルも検証します。`raw` は JSON にせず元画像のバイト列と比較します。

期待値は通常のテスト実行で再生成しません。API を変更する際は元の埋め込みデータと照合して更新してください。画像と期待値はリポジトリのテスト資産で、npm 配布対象の `files` には含まれません。
