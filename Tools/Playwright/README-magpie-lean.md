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
| `4d05d732e5a` | Upstream base. Exactly Playwright v1.63.0's `BASE_REVISION` (`UPSTREAM_CONFIG.sh`), i.e. the WebKit that playwright-core 1.63 (Magpie's pinned version) expects — build `webkit-2359`. |
| "Apply Playwright v1.63.0 WebKit patches" | `browser_patches/webkit/patches/bootstrap.diff` applied verbatim + `embedder/Playwright` → `Tools/Playwright`. Defines the remote protocol playwright-core speaks. **Don't touch the protocol.** |
| `Tools/Playwright/magpie-lean.cmake` | The cut list, with a rationale per cut. Used as a CMake initial-cache file. |
| `Tools/Scripts/build-magpie-webkit` | One-shot build: `build-webkit --release --cmake --port=Mac` with the lean cache. |
| `Tools/Playwright/mac/CMakeLists.txt` | Builds `Playwright.app` in the CMake Mac port (modelled on `Tools/MiniBrowser/mac`) and emits `pw_run.sh`. |
| `Tools/Playwright/mac/AppDelegate.m` | Embedder; adds `MAGPIE_WEBKIT_PREFS` / `MAGPIE_WEBKIT_POOL` env hooks for runtime A/B tests. |
| `Tools/Playwright/bench/` | Benchmark + pixel-parity harness against stock Playwright WebKit. |
| `Source/cmake/OptionsCocoa.cmake` | Parent→child feature consistency pins (see below) + `WEBKIT_PLATFORM_FEATURES_FORCE_OFF`. |
| Small source guards | `git log --oneline 4d05d732e5a..` — every source change is a missing `#if ENABLE()` that upstream's always-on Mac config never exercised. |

## Build

```sh
Tools/Scripts/build-magpie-webkit            # ~1-2h cold on an M4 Pro; incremental after
ls WebKitBuild/cmake-mac/Release/{Playwright.app,pw_run.sh,WebKit.framework}
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

Runtime experiments without rebuilding (both default pool and per-context pools):

```sh
MAGPIE_WEBKIT_PREFS="UseGPUProcessForDOMRenderingEnabled=0;UseGPUProcessForCanvasRenderingEnabled=0;ServiceWorkersEnabled=0;_avFoundationEnabled=0;_usesPageCache=0" \
MAGPIE_WEBKIT_POOL="prewarmsProcessesAutomatically=0;usesWebProcessCache=0;pageCacheEnabled=0" \
node bench.mjs --label lean-nogpu --executable ../../../WebKitBuild/cmake-mac/Release/pw_run.sh
```

Keys are WebKit preference names (`Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml`,
matched via `[WKPreferences _features]`), or `_`-prefixed `WKPreferencesPrivate` /
`_WKProcessPoolConfiguration` properties applied with KVC.

## The cuts

Rule: anything that can change how a static page lays out or paints stays in (CSS, layout,
text, fonts, images, form-control rendering, `<video>`/`<audio>` as replaced elements, dark
mode, variation fonts, MathML, XSLT). Anything that only matters for human interaction, media
playback, realtime/hardware access, platform integration or tooling goes. Anything the
Playwright patch references in `#if ENABLE(...)` stays (`REMOTE_INSPECTOR`, `TOUCH_EVENTS`,
`ORIENTATION_EVENTS`, `DRAG_SUPPORT`, `FULLSCREEN_API`, `CONTEXT_MENUS`, `NOTIFICATIONS`,
`GEOLOCATION`).

Compiled out: WebRTC (+libwebrtc.dylib), MediaStream/capture (+ScreenCaptureKit), MediaRecorder,
WebCodecs, MSE, EME (both), MediaSession(+coordinator), PiP, video presentation mode, Web Audio,
WebGL (+ANGLE), WebGPU (+framework/Swift interop), WebXR, `<model>`, Apple Pay (+all PASSKIT_*
derived flags, `USE(PASSKIT)`), Payment Request, WebAuthn, Gamepad, Speech Synthesis, Writing
Tools, WebExtensions, content blockers, content filtering, telephone number detection, Services
menu, pointer lock, cursor scale/visibility, all PDF plugins, MHTML, inspector extensions/telemetry,
memory sampler, resource usage overlay, Web API statistics, Live Text (IMAGE_ANALYSIS*), Web Push
(+declarative), VP9/Vorbis/Opus codec registration, API tests, layout-test runners, `jsc` shell.

Kept on because macOS-only code assumes them unconditionally (each would need real refactoring
upstream to be optional): `WIRELESS_PLAYBACK_TARGET` (PAL `AVOutputContext` shim),
`ACCESSIBILITY_ISOLATED_TREE` (AXObjectCacheMac), `ATTACHMENT_ELEMENT` (Cocoa editing/drag),
`DATA_DETECTION` (ImageOverlayControllerMac), `DATACUE_VALUE`/`AVF_CAPTIONS`,
`APPLICATION_MANIFEST`.

### Parent→child pins (`OptionsCocoa.cmake`)

`PlatformEnableCocoa.h`/`PlatformHave.h`/`PlatformUse.h` default a number of child features
on without checking their parent (e.g. `ENABLE_COCOA_WEBM_PLAYER` without `MEDIA_SOURCE`,
`HAVE_WEBGPU_IMPLEMENTATION` without `WEBGPU`, `ENABLE_APPLE_PAY_AMS_UI` without `APPLE_PAY`).
`cmakeconfig.h` is included before `<wtf/Platform.h>`, so `OptionsCocoa.cmake` exposes those
children as `0` whenever the parent CMake option is off. Three `Platform*.h` defines had to be
wrapped in `#if !defined(...)` to make that possible (`HAVE_SCREEN_CAPTURE_KIT`,
`HAVE_WEBGPU_IMPLEMENTATION`, `USE_PASSKIT`). `WEBKIT_PLATFORM_FEATURES_FORCE_OFF` does the same
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
