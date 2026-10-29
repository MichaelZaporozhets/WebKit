# Magpie-lean WebKit

A Playwright-compatible WebKit build that only carries what Shopify's **Magpie** visual
regression tool needs: render an `http://localhost` page of React/Polaris components with
mocked data, settle fonts/layout/animations, screenshot it at desktop / iPad / iPhone
viewports. Everything else — realtime media, WebGL/WebGPU, Apple Pay, passkeys, PDFs,
extensions, Live Text, web push, test harnesses — is compiled out.

Why: Magpie runs a 3 engines × 3 viewports matrix per route through Playwright, and WebKit is
the slow leg (`WEBKIT_STATIC_WORKERS = 4` vs 6 for Chromium in `compare-workers.ts`). Each
Playwright worker launches its own `Playwright.app`, which launches its own Networking, GPU
and WebContent processes, so per-process binary size (dyld time) and RSS translate directly
into how many workers fit on a CI host and how fast each capture completes.

## Branch layout

| Commit / path | What |
| --- | --- |
| `5b391e6d3b1` | Upstream base (WebKit 626.1.4, 2026-08-20). The `BASE_REVISION` of the `browser_patches/webkit` sync that matches the shipped `webkit-2359` bundle (626.1.6) — **not** the one at the `v1.63.0` tag, which still points at the June base and lacks the `Page.Setting` values playwright-core 1.63 sends on every page (`PushAPIEnabled`, …). The inspector protocol generated from this pair is identical to the bundle's `protocol.json`. |
| "Apply Playwright WebKit patches matching playwright-core 1.63" | `browser_patches/webkit/patches/bootstrap.diff` from `microsoft/playwright@e99c0b1d97` applied verbatim + `embedder/Playwright` → `Tools/Playwright`. Defines the remote protocol playwright-core speaks. **Don't touch the protocol.** |
| `Tools/Playwright/magpie-lean.cmake` | The cut list, with a rationale per cut. Used as a CMake initial-cache file. |
| `Tools/Scripts/build-magpie-webkit` | One-shot build: `build-webkit --release --cmake --port=Mac` with the lean cache. |
| `Tools/Playwright/mac/CMakeLists.txt` | Builds `Playwright.app` in the CMake Mac port (modelled on `Tools/MiniBrowser/mac`) and emits `pw_run.sh`. |
| `Tools/Playwright/mac/AppDelegate.m` | Embedder; adds `MAGPIE_WEBKIT_PREFS` / `MAGPIE_WEBKIT_POOL` env hooks for runtime A/B tests. |
| `Tools/Playwright/bench/` | Benchmark + pixel-parity harness against stock Playwright WebKit. |
| `Source/cmake/OptionsCocoa.cmake` | Parent→child feature consistency pins (see below) + `WEBKIT_PLATFORM_FEATURES_FORCE_OFF`. |
| Small source guards | `git log --oneline 4d05d732e5a..` — every source change is a missing `#if ENABLE()` that upstream's always-on Mac config never exercised. |

## Build

```sh
Tools/Scripts/build-magpie-webkit            # = build + package + verify (~1-2h cold on an M4 Pro)
Tools/Scripts/build-magpie-webkit build      # configure with Tools/Playwright/magpie-lean.cmake and build
Tools/Scripts/build-magpie-webkit package    # WebKitBuild/magpie-webkit-<rev>-mac-arm64.zip (Playwright bundle layout, ~48 MB)
Tools/Scripts/build-magpie-webkit verify     # unzip, launch through playwright-core, screenshot; --bench adds the stock comparison
Tools/Scripts/build-magpie-webkit bootstrap  # re-roll: new branch at the pinned Playwright base with its patches applied
```

Build-environment notes (not part of the design): uses Xcode's clang but the standalone Swift
6.3 toolchain in `~/swift-6.3-toolchain` when present (Xcode 26.3's Swift 6.2.4 cannot build
the `WebKit_Internal` clang module). `env -u GEM_HOME …` strips rbenv state for WebKit's Ruby
code generators. See `~/.pi/agent/skills/webkit-contributing/references/build-troubleshooting.md`.

## Run it under Magpie

Magpie already honours an executable override (`src/playwright/playwright.config.ts`):

```sh
export PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH=/path/to/webkit-magpie/WebKitBuild/cmake-mac/Release/pw_run.sh
devx magpie compare --browsers webkit ...
```

`pw_run.sh` has the same contract as the one in Playwright's `webkit-<rev>` bundle, plus the
`__XPC_DYLD_*` variables the CMake port's XPC services need (SIP strips `DYLD_*` for XPC
children; without them they'd load the *system* WebKit and crash on version mismatch).

To ship it, zip the same set the official bundle has: `Playwright.app`, `*.framework`,
`pw_run.sh` (the XPC services live inside `WebKit.framework/XPCServices`).

## Measure

```sh
cd Tools/Playwright/bench
npm install && npm run install-stock-webkit            # stock webkit-2359 for the baseline
node bench.mjs --label stock
node bench.mjs --label lean --executable ../../../WebKitBuild/cmake-mac/Release/pw_run.sh
node compare.mjs stock lean                            # timings, RSS, pixelmatch of the screenshots
```

Runtime defaults baked into `pw_run.sh` (override by exporting the variable yourself):
`MAGPIE_SHARED_PROCESS_POOL=1` (contexts share one WebContent process pool; storage stays
per-context) and `MAGPIE_WEBKIT_POOL=prewarmsProcessesAutomatically=1`. Caveat: Playwright's
per-context geolocation/language overrides are per-pool and become shared across live contexts;
set `MAGPIE_SHARED_PROCESS_POOL=0` if a tenant relies on them.

Runtime experiments without rebuilding (both default pool and per-context pools):

```sh
MAGPIE_WEBKIT_PREFS="UseGPUProcessForDOMRenderingEnabled=0;UseGPUProcessForCanvasRenderingEnabled=0;ServiceWorkersEnabled=0;_avFoundationEnabled=0;_usesPageCache=0" \
MAGPIE_WEBKIT_POOL="prewarmsProcessesAutomatically=0;usesWebProcessCache=0;pageCacheEnabled=0" \
node bench.mjs --label lean-nogpu --executable ../../../WebKitBuild/cmake-mac/Release/pw_run.sh
```

Keys are WebKit preference names (`Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml`,
matched via `[WKPreferences _features]`), or `_`-prefixed `WKPreferencesPrivate` /
`_WKProcessPoolConfiguration` properties applied with KVC.

## Results (M4 Pro, macOS 26.6, playwright-core 1.63 / stock webkit-2359 vs this build, bench fixture = 60-row Polaris IndexTable page)

| | stock | lean | |
| --- | --- | --- | --- |
| Binaries (WebCore / WebKit / JSC) | 104 / 61 / 42 MB + libwebrtc 16 MB + ANGLE 6 MB + WebGPU 4 MB | 78 / 39 / 39 MB | −32% total |
| Cold launch → first page, p50 of 6 | 431 ms | 375 ms | −13% |
| RSS after launch | 314 MB | 232 MB (261 MB with the prewarmed process) | −26% / −17% |
| Capture (context+page, load, settle, screenshot) desktop 1920×1080 p50 | 442 ms | 308 ms | −30% |
| Capture tablet (iPad gen 7) p50 | 346 ms | 211 ms | −39% |
| Capture mobile (iPhone 14) p50 | 369 ms | 244 ms | −34% |
| Capture p95 (desktop / tablet / mobile) | 500 / 416 / 388 ms | 396 / 288 / 294 ms | −21% / −31% / −24% |
| RSS per capture | 385 MB | 322 MB (368 MB with shared pool) | −16% / −5% |
| Screenshots vs stock (pixelmatch, 3 viewports) | — | 0 differing pixels | identical |

Where the capture time goes now: ~35 ms context+page (was ~150: cold WebContent spawn per
Playwright context, fixed by the shared prewarmed pool), ~90–120 ms first layout/paint + fonts
(page-dependent), ~60–130 ms screenshot of which ~90 ms is the software repaint `Page.snapshotRect`
does (PNG encoding is only ~10 ms more than JPEG). The repaint is inherent to the capture method
stock uses; switching to a compositor snapshot would change pixels and invalidate Magpie's baselines.

Memory-vs-speed knob measured but left off: `MAGPIE_WEBKIT_PREFS="UseGPUProcessForDOMRenderingEnabled=0;UseGPUProcessForCanvasRenderingEnabled=0;UseGPUProcessForMediaEnabled=0"`
never launches the GPU process (−33% RSS at launch, −27% per capture vs stock) but captures are
~9% slower and the 4-wide parallel case ~20% slower.

## The cuts

Rule: anything that can change how a static page lays out or paints stays in (CSS, layout,
text, fonts, images, form-control rendering, `<video>`/`<audio>` as replaced elements, dark
mode, variation fonts, MathML, XSLT). Anything that only matters for human interaction, media
playback, realtime/hardware access, platform integration or tooling goes. Anything the
Playwright patch references in `#if ENABLE(...)` stays (`REMOTE_INSPECTOR`, `TOUCH_EVENTS`,
`ORIENTATION_EVENTS`, `DRAG_SUPPORT`, `FULLSCREEN_API`, `CONTEXT_MENUS`, `NOTIFICATIONS`,
`GEOLOCATION`).

Compiled out: WebRTC (+libwebrtc.dylib), MediaStream/capture (+ScreenCaptureKit), MediaRecorder,
WebCodecs, MSE (+Cocoa WebM player), EME (both), MediaSession(+coordinator/playlist), PiP, video
presentation mode, Web Audio, WebGL (+ANGLE), WebGPU (+framework/Swift interop), WebXR, `<model>`,
Apple Pay (+all PASSKIT_*-derived flags, `USE(PASSKIT)`), Payment Request, WebAuthn, Gamepad, Speech
Synthesis, Writing Tools, WebExtensions (+WebDriver extension commands), pointer lock, cursor
scale/visibility, PDF.js, MHTML, inspector extensions/telemetry, memory sampler, resource usage
overlay, Web API statistics, Live Text (IMAGE_ANALYSIS*), Web Push (+declarative), VP9/Vorbis/Opus
codec registration, the Swift back/forward-list prototype, API tests, layout-test runners, `jsc`.

Kept on because macOS-only code assumes them unconditionally (each would need real refactoring
upstream to be optional — see the "round N" commits for the exact sites):
`WIRELESS_PLAYBACK_TARGET` (PAL `AVOutputContext` shim), `ACCESSIBILITY_ISOLATED_TREE`
(AXObjectCacheMac), `ATTACHMENT_ELEMENT` (Cocoa editing/drag), `DATA_DETECTION`
(ImageOverlayControllerMac), `TELEPHONE_NUMBER_DETECTION` + `SERVICE_CONTROLS`
(ServicesOverlayController, WebContextMenuProxyMac), `CONTENT_EXTENSIONS` + `CONTENT_FILTERING`
(WKContentRuleListStore, WebPrivacyHelpers, downloads), the PDF stack (`PDF_PLUGIN`/`UNIFIED_PDF`/
`PDF_HUD`/`PDFKIT_PLUGIN`: WebViewImpl + AppKit gestures; PDFKit is soft-linked),
`DATACUE_VALUE`/`AVF_CAPTIONS`, `APPLICATION_MANIFEST`.

### Parent→child pins (`OptionsCocoa.cmake`)

`PlatformEnableCocoa.h`/`PlatformHave.h`/`PlatformUse.h` default a number of child features
on without checking their parent (e.g. `ENABLE_COCOA_WEBM_PLAYER` without `MEDIA_SOURCE`,
`HAVE_WEBGPU_IMPLEMENTATION` without `WEBGPU`, `ENABLE_APPLE_PAY_AMS_UI` without `APPLE_PAY`).
`cmakeconfig.h` is included before `<wtf/Platform.h>`, so `OptionsCocoa.cmake` exposes those
children as `0` whenever the parent CMake option is off. Three `Platform*.h` defines had to be
wrapped in `#if !defined(...)` to make that possible (`HAVE_SCREEN_CAPTURE_KIT`,
`HAVE_WEBGPU_IMPLEMENTATION`, `USE_PASSKIT`). Toolchain note: the open-source Swift 6.3 toolchain
only pretends to support `-emit-clang-header-min-access`, so `SWIFT_CXX_INTEROP_SUPPORTED` is pinned
off in the lean cache. `WEBKIT_PLATFORM_FEATURES_FORCE_OFF` does the same
for features with no CMake option at all.

## Candidates for the next round (measure first)

- **GPU process topology**: `UseGPUProcessForDOMRenderingEnabled=0` (+canvas/media) keeps all
  painting in WebContent and may avoid launching the GPU process per worker entirely. Try via
  `MAGPIE_WEBKIT_PREFS` first; if it wins, bake it into `AppDelegate.m`.
- **Process pool**: no prewarmed processes, no web-process cache, no back/forward cache
  (`MAGPIE_WEBKIT_POOL`). Magpie's pages are one-shot.
- `ENABLE_VIDEO=OFF`: large (AVFoundation players, media controls shadow DOM, GPU-process media
  proxies) but changes `<video>` layout/fallback-content behaviour vs Safari. Only if Magpie
  tenants provably have no `<video>`/`<audio>` in captured states.
- `ENABLE_FTL_JIT=OFF` (drops B3/Air): smaller JSC, slower only for long-running hot JS.
  `ENABLE_WEBASSEMBLY=OFF` would break any tenant bundle feature-detecting wasm.
- Service workers off at runtime (`ServiceWorkersEnabled=0`) — Magpie stubs MSW anyway.
- `WebKitLegacy.framework`: `WebKit.framework` on macOS still links it; dropping needs source work.
- `-flto=thin` (`MAGPIE_LTO=thin`): Apple ships WebKit with LTO; costs link time.
- Screenshot path: `Page.snapshotRect` → `WKWebView` snapshot → PNG via ImageIO. PNG compression
  level and the base64 hop are tunable in `InspectorPlaywrightAgentClientMac.mm`.
