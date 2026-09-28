# Tech note: compressing data in the browser

Background for future features that hand files to the user or send large payloads.
Came up while building the "download library as ZIP" button in the replay analysis.

## What the browser has built in

`CompressionStream` / `DecompressionStream` (Baseline in all current browsers) with the
formats `gzip`, `deflate` and `deflate-raw`. No library needed.

```ts
// Compress: one JSON document → one .json.gz file
const gz = await new Response(
	new Blob([JSON.stringify(data)]).stream().pipeThrough(new CompressionStream('gzip')),
).blob();

// Decompress a picked file
const text = await new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).text();
```

## What it is not: an archive

gzip compresses **exactly one stream**. There are no file names, no folders, no directory.
Concatenated gzip members decompress into one continuous stream, so the file boundaries are
lost. `library.json.gz` unpacks to `library.json`, and the name comes from the file name, not
from the content.

For several files you need a container format:

| Format | Multiple files | Built in | Notes |
| :-- | :-- | :-- | :-- |
| `.json.gz` | no, one document | yes | smallest effort; JSON repeats its keys, so it compresses very well |
| `.tar.gz` | yes | gzip only | tar (512-byte headers) would have to be hand-written; unfamiliar on Windows |
| `.zip` | yes | no | needs CRC-32 and a central directory, so we use [`fflate`](https://github.com/101arrowz/fflate) |

## Format at a glance

```
1f 8b | 08 (DEFLATE) | flags | mtime (4 B) | xfl | os | [optional name] | DEFLATE data | CRC-32 | size
```

`1f 8b` identifies any gzip file. The trailer's CRC-32 detects corruption on decompression.
It is the same format as HTTP `Content-Encoding: gzip`.

## Opening a .json.gz

- macOS: double-click, or `gunzip file.json.gz` (`gzip -dk` keeps the original)
- Linux: `gunzip`, or read without unpacking: `zcat file.json.gz | jq`
- Windows 11: built in; older versions need 7-Zip
- Code: `DecompressionStream('gzip')` (browser), `Bun.gunzipSync` (Bun), `gzip.open` (Python)

## When to reach for which

- **One document** (backup/sync payload, upload to the API, a future re-import): `CompressionStream('gzip')`, no dependency.
- **Several files the user opens individually** (the replay library download): ZIP via `fflate`, see
  `createLibraryZip` in `apps/website/src/lib/replay-download.ts`.
