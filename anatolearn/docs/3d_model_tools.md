# 3D Model Compatibility and Import Notes

Updated 22 October 2026. These findings describe the installed Three.js loaders and current upload workflow, not a universal format certification.

| Format | Upload/render support | Constraints |
|---|---|---|
| GLB 2.0 | GLTFLoader | Header/version/length validated; prefer self-contained models |
| glTF 2.0 | GLTFLoader | New uploads require embedded buffers/textures; legacy local companion references are served through owning-model authorization |
| OBJ | OBJLoader | Geometry supported; vertices/faces required; companion MTL/textures are not uploaded as a bundle |
| USDZ | USDLoader | ZIP signature validation; installed Three.js USDLoader handles its supported USDA/USDC subset and embedded assets |
| Unreal UASSET | rejected | Export/convert from the source tool to GLB before upload; it is not a browser runtime format in this app |

Use `three/addons/loaders/USDLoader.js`. The installed USDZLoader is deprecated and delegates to USDLoader. No new rendering dependency was added.

## Import workflow

Export externally created/Sketchfab-sourced content to a supported file, retaining permission to use it. Prefer GLB when the source includes multiple textures/buffers or is an Unreal asset. Upload as a teacher, open the unpublished model to preview it, add annotations, assign its programme and publish when ready. Explicitly enable downloads if students should have the attachment action. Upload limit is 200 MiB.

New glTF files with external URIs are rejected with an instruction to embed dependencies or convert to GLB. The application does not provide an automated conversion service or direct Sketchfab API migration. Model-loader failures are shown in the viewer. Reset works through saved neutral view or automatic model framing.

## Verification

`npm run test:models` parses a real OBJ triangle and a USDZ archive with an embedded USDA triangle and verifies renderable geometry. Browser QA rendered a temporary OBJ, selected/moved its annotation and opened linked video. Existing viewer tests cover projection metadata/cache and legacy visual descriptions.

The initial USDZ test exposed an installed USDA parser sensitivity to opening braces on the declaration line; the regression uses declarations and braces on separate lines, compatible with that parser. A broad exporter/USDC/material/animation matrix and testing in all four target browsers remain outstanding. Complex models should be previewed before publication; prefer GLB when a particular USD export is incompatible.

Projection annotations target a source mesh index and store generated geometry in JSONB. Replacing a model's topology can invalidate annotations; there is no in-place topology replacement workflow. Original downloads do not embed annotation metadata; use the separate JSON/CSV export when needed.


## Viewer compatibility follow-up — 22 October 2026

In-app Chromium rendered the existing 3.74 MB A1 GLB with its anatomy texture and supported rotate/zoom/reset. An embedded checker-textured glTF fixture with shared geometry/materials across translated/rotated nodes supported projected highlight creation, moving point/highlight/filled-region annotations onto the second mesh, reload and cached geometry reuse. The moved annotation retained its ID/video link. Both projected caches were persisted on mesh index 1 after teacher reload (99 and 72 position values in this fixture).

Default framing now considers horizontal as well as vertical field of view; clipping scales with model size. Saved neutral poses remain authoritative. Teardown deduplicates geometry/material/texture disposal and releases ImageBitmaps, skeleton buffers and the renderer context. Five SPA entry/exit cycles left one canvas in the viewer and zero in the gallery; this is not a GPU-memory or long-duration performance certification.

Supported upload formats and conversion requirements are unchanged. Region rendering/editing/moving/reload was tested using a stored polygon; a complete hand-drawn polygon authoring gesture and broad binary-USDC/animated/skinned asset compatibility remain unverified. The OBJ/USDZ parser tests still pass.
