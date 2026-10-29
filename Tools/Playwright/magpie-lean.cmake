# Magpie-lean WebKit: CMake initial-cache file (use with `cmake -C <this file>`).
#
# Goal: a Playwright-protocol-compatible WebKit (see Tools/Playwright/UPSTREAM_CONFIG.sh)
# that only carries what Shopify's Magpie VRT workload needs: load an http://localhost
# page of React/Polaris components with mocked data, settle fonts/layout/animations,
# screenshot it at desktop / iPad / iPhone viewports (the latter two with touch emulation).
#
# Rule of thumb for every cut below:
#   * Anything that can change how a static page LAYS OUT or PAINTS stays in. Magpie
#     compares before/after renders in the same engine, but it also exists to catch real
#     WebKit-specific layout/paint differences, so CSS/layout/text/font/image features and
#     form-control rendering are untouched.
#   * Anything that only matters for interaction with a human, for media playback, for
#     realtime/hardware access, for platform integration (Apple Pay, passkeys, PDFs, menus,
#     extensions) or for debugging/testing tooling goes.
#   * Anything the Playwright patch (bootstrap.diff) references in #if ENABLE(...) stays:
#     REMOTE_INSPECTOR, TOUCH_EVENTS, ORIENTATION_EVENTS, DRAG_SUPPORT, FULLSCREEN_API,
#     CONTEXT_MENUS, NOTIFICATIONS, GEOLOCATION (geolocation override), SANDBOX_EXTENSIONS.
#
# Everything here is a build-time cut (smaller binaries => faster dyld per process launch,
# lower RSS per WebContent/GPU/Networking process => more parallel Magpie workers per host,
# and a shorter build). Runtime cuts live in Tools/Playwright/mac/AppDelegate.m.

# --- What Playwright's own Mac build passes to build-webkit (--touch-events --orientation-events).
# ORIENTATION_EVENTS is owned by PlatformEnable.h (the patch flips its default to 1);
# TOUCH_EVENTS is a CMake option on Mac, so cmakeconfig.h would otherwise force it to 0.
set(ENABLE_TOUCH_EVENTS ON CACHE BOOL "" FORCE)
set(ENABLE_IOS_TOUCH_EVENTS OFF CACHE BOOL "" FORCE)

# --- Realtime media / capture / codecs: nothing in a VRT render uses a camera, mic, peer
# connection, MSE buffer, DRM session, or encoder.
set(ENABLE_WEB_RTC OFF CACHE BOOL "" FORCE)              # also drops libwebrtc.dylib (14MB) via OptionsCocoa.cmake
set(ENABLE_MEDIA_STREAM OFF CACHE BOOL "" FORCE)
set(ENABLE_MEDIA_RECORDER OFF CACHE BOOL "" FORCE)
set(ENABLE_WEB_CODECS OFF CACHE BOOL "" FORCE)
set(ENABLE_MEDIA_SOURCE OFF CACHE BOOL "" FORCE)
set(ENABLE_MEDIA_SOURCE_IN_WORKERS OFF CACHE BOOL "" FORCE)
set(ENABLE_ENCRYPTED_MEDIA OFF CACHE BOOL "" FORCE)
set(ENABLE_LEGACY_ENCRYPTED_MEDIA OFF CACHE BOOL "" FORCE)
set(ENABLE_MEDIA_SESSION OFF CACHE BOOL "" FORCE)
set(ENABLE_MEDIA_SESSION_COORDINATOR OFF CACHE BOOL "" FORCE)
set(ENABLE_WIRELESS_PLAYBACK_TARGET OFF CACHE BOOL "" FORCE)   # AirPlay
set(ENABLE_PICTURE_IN_PICTURE_API OFF CACHE BOOL "" FORCE)
set(ENABLE_VIDEO_PRESENTATION_MODE OFF CACHE BOOL "" FORCE)
set(ENABLE_AVF_CAPTIONS OFF CACHE BOOL "" FORCE)
set(ENABLE_DATACUE_VALUE OFF CACHE BOOL "" FORCE)
set(ENABLE_WEB_AUDIO OFF CACHE BOOL "" FORCE)
# ENABLE_VIDEO stays ON on purpose: <video>/<audio> must still lay out as replaced elements
# with their shadow-DOM controls exactly like Safari. Media *loading* is disabled at runtime
# instead (AppDelegate.m), so AVFoundation never spins up.

# --- GPU APIs: Polaris/admin surfaces draw with DOM, SVG and 2D canvas. No WebGL/WebGPU/XR.
set(ENABLE_WEBGL OFF CACHE BOOL "" FORCE)                # also drops ANGLE (libANGLE-shared.dylib) via OptionsCocoa.cmake
set(ENABLE_WEBGPU OFF CACHE BOOL "" FORCE)               # drops WebGPU.framework + its Swift/C++ interop build
set(ENABLE_WEBGPU_SWIFT OFF CACHE BOOL "" FORCE)
set(ENABLE_WEBXR OFF CACHE BOOL "" FORCE)
set(ENABLE_MODEL_ELEMENT OFF CACHE BOOL "" FORCE)        # <model>, RealityKit, Model XPC service

# --- Platform integrations nobody can click in headless CI.
set(ENABLE_APPLE_PAY OFF CACHE BOOL "" FORCE)
set(ENABLE_PAYMENT_REQUEST OFF CACHE BOOL "" FORCE)
set(ENABLE_WEB_AUTHN OFF CACHE BOOL "" FORCE)
set(ENABLE_GAMEPAD OFF CACHE BOOL "" FORCE)
set(ENABLE_SPEECH_SYNTHESIS OFF CACHE BOOL "" FORCE)
set(ENABLE_WRITING_TOOLS OFF CACHE BOOL "" FORCE)
set(ENABLE_WK_WEB_EXTENSIONS OFF CACHE BOOL "" FORCE)    # browser-extension API surface in UIProcess + WebProcess
set(ENABLE_CONTENT_EXTENSIONS OFF CACHE BOOL "" FORCE)   # content blockers (Playwright routes via Network agent, not rule lists)
set(ENABLE_CONTENT_FILTERING OFF CACHE BOOL "" FORCE)    # parental controls
set(ENABLE_TELEPHONE_NUMBER_DETECTION OFF CACHE BOOL "" FORCE)
set(ENABLE_ATTACHMENT_ELEMENT OFF CACHE BOOL "" FORCE)
set(ENABLE_APPLICATION_MANIFEST OFF CACHE BOOL "" FORCE)
set(ENABLE_SERVICE_CONTROLS OFF CACHE BOOL "" FORCE)     # macOS Services menu
set(ENABLE_POINTER_LOCK OFF CACHE BOOL "" FORCE)
set(ENABLE_MOUSE_CURSOR_SCALE OFF CACHE BOOL "" FORCE)
set(ENABLE_CURSOR_VISIBILITY OFF CACHE BOOL "" FORCE)
set(ENABLE_PDF_PLUGIN OFF CACHE BOOL "" FORCE)
set(ENABLE_PDFKIT_PLUGIN OFF CACHE BOOL "" FORCE)
set(ENABLE_UNIFIED_PDF OFF CACHE BOOL "" FORCE)
set(ENABLE_PDF_HUD OFF CACHE BOOL "" FORCE)
set(ENABLE_PDFJS OFF CACHE BOOL "" FORCE)
set(ENABLE_MHTML OFF CACHE BOOL "" FORCE)

# --- Telemetry / diagnostics / accessibility plumbing that no AT client will ever attach to.
set(ENABLE_ACCESSIBILITY_ISOLATED_TREE OFF CACHE BOOL "" FORCE)
set(ENABLE_INSPECTOR_EXTENSIONS OFF CACHE BOOL "" FORCE)
set(ENABLE_INSPECTOR_TELEMETRY OFF CACHE BOOL "" FORCE)
set(ENABLE_MEMORY_SAMPLER OFF CACHE BOOL "" FORCE)
set(ENABLE_RESOURCE_USAGE OFF CACHE BOOL "" FORCE)
set(ENABLE_WEB_API_STATISTICS OFF CACHE BOOL "" FORCE)

# --- Test harnesses and dev tools: we only need the frameworks + Playwright.app.
set(ENABLE_API_TESTS OFF CACHE BOOL "" FORCE)
set(ENABLE_LAYOUT_TESTS OFF CACHE BOOL "" FORCE)
set(ENABLE_WEBKIT_TEST_RUNNER OFF CACHE BOOL "" FORCE)
set(ENABLE_JAVASCRIPT_SHELL OFF CACHE BOOL "" FORCE)
set(ENABLE_MINIBROWSER ON CACHE BOOL "" FORCE)           # cheap, and handy for eyeballing a page outside Playwright
set(ENABLE_PLAYWRIGHT ON CACHE BOOL "" FORCE)
set(ENABLE_EXPERIMENTAL_FEATURES OFF CACHE BOOL "" FORCE)

# --- Deliberately KEPT (candidates for a later, measured round; see docs/magpie-lean.md):
#   ENABLE_VIDEO, ENABLE_WEBASSEMBLY, ENABLE_FTL_JIT, ENABLE_GPU_PROCESS, ENABLE_WEBKIT_LEGACY,
#   ENABLE_NOTIFICATIONS, ENABLE_GEOLOCATION, ENABLE_FULLSCREEN_API, ENABLE_DRAG_SUPPORT,
#   ENABLE_CONTEXT_MENUS, ENABLE_TEXT_AUTOSIZING, ENABLE_MATHML, ENABLE_XSLT, service workers.
