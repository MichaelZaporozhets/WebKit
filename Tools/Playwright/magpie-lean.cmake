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
# Both are CMake options on this revision (default OFF), so cmakeconfig.h would otherwise
# override the defaults the Playwright patch flips in PlatformEnable.h.
set(ENABLE_TOUCH_EVENTS ON CACHE BOOL "" FORCE)
set(ENABLE_ORIENTATION_EVENTS ON CACHE BOOL "" FORCE)
set(ENABLE_IOS_TOUCH_EVENTS OFF CACHE BOOL "" FORCE)
set(ENABLE_DEVICE_ORIENTATION OFF CACHE BOOL "" FORCE)    # iOS-only in Safari too

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
# WIRELESS_PLAYBACK_TARGET stays ON: PAL's AVOutputContext SPI shim and the AVFoundation
# media player assume it unconditionally on macOS (never exercised headlessly anyway).
set(ENABLE_WIRELESS_PLAYBACK_TARGET ON CACHE BOOL "" FORCE)
set(ENABLE_PICTURE_IN_PICTURE_API OFF CACHE BOOL "" FORCE)
set(ENABLE_VIDEO_PRESENTATION_MODE OFF CACHE BOOL "" FORCE)
# AVF_CAPTIONS / DATACUE_VALUE stay ON: tiny, and MediaPlayerPrivateAVFoundationObjC.mm uses
# m_metadataTrack outside the header's ENABLE(DATACUE_VALUE) guard.
set(ENABLE_AVF_CAPTIONS ON CACHE BOOL "" FORCE)
set(ENABLE_DATACUE_VALUE ON CACHE BOOL "" FORCE)
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
foreach (_ap_feature
    AUTOMATIC_RELOAD_LINE_ITEM AUTOMATIC_RELOAD_PAYMENTS COUPON_CODE DEFERRED_LINE_ITEM
    DEFERRED_PAYMENTS DISBURSEMENTS INSTALLMENTS LATER_AVAILABILITY MERCHANT_CATEGORY_CODE
    MULTI_MERCHANT_PAYMENTS PAYMENT_ORDER_DETAILS RECURRING_LINE_ITEM RECURRING_PAYMENTS
    SELECTED_SHIPPING_METHOD SHIPPING_CONTACT_EDITING_MODE SHIPPING_METHOD_DATE_COMPONENTS_RANGE)
    set(ENABLE_APPLE_PAY_${_ap_feature} OFF CACHE BOOL "" FORCE)   # OptionsMac.cmake defaults these ON
endforeach ()
set(ENABLE_PAYMENT_REQUEST OFF CACHE BOOL "" FORCE)
set(ENABLE_WEB_AUTHN OFF CACHE BOOL "" FORCE)
set(ENABLE_GAMEPAD OFF CACHE BOOL "" FORCE)
set(ENABLE_SPEECH_SYNTHESIS OFF CACHE BOOL "" FORCE)
set(ENABLE_WRITING_TOOLS OFF CACHE BOOL "" FORCE)
set(ENABLE_WK_WEB_EXTENSIONS OFF CACHE BOOL "" FORCE)    # browser-extension API surface in UIProcess + WebProcess
set(ENABLE_CONTENT_EXTENSIONS OFF CACHE BOOL "" FORCE)   # content blockers (Playwright routes via Network agent, not rule lists)
set(ENABLE_CONTENT_FILTERING OFF CACHE BOOL "" FORCE)    # parental controls
set(ENABLE_TELEPHONE_NUMBER_DETECTION OFF CACHE BOOL "" FORCE)
# ATTACHMENT_ELEMENT stays ON: Cocoa editing/drag/paste code assumes it (DragDataCocoa,
# EditingHTMLConverter, WebContentReaderCocoa, RenderThemeCocoa).
set(ENABLE_ATTACHMENT_ELEMENT ON CACHE BOOL "" FORCE)
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

# --- Telemetry / diagnostics plumbing.
# ACCESSIBILITY_ISOLATED_TREE stays ON: the Mac AX layer (AXObjectCacheMac, the ObjC
# wrappers) is written against it. It only does work once an AT client connects.
set(ENABLE_ACCESSIBILITY_ISOLATED_TREE ON CACHE BOOL "" FORCE)
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

# --- Platform.h-owned features (no CMake option). Pinned to 0 through
# WEBKIT_PLATFORM_FEATURES_FORCE_OFF (Source/cmake/OptionsCocoa.cmake -> cmakeconfig.h).
set(WEBKIT_PLATFORM_FEATURES_FORCE_OFF
    ENABLE_IMAGE_ANALYSIS                       # VisionKit Live Text
    ENABLE_IMAGE_ANALYSIS_ENHANCEMENTS
    ENABLE_IMAGE_ANALYSIS_FOR_MACHINE_READABLE_CODES
    # ENABLE_DATA_DETECTION stays on: ImageOverlayController{,Mac} on PLATFORM(MAC) assume it.
    ENABLE_WEB_PUSH_NOTIFICATIONS               # webpushd / Push API plumbing in Networking
    ENABLE_DECLARATIVE_WEB_PUSH
    ENABLE_VP9                                  # media codec registration; nothing plays media here
    ENABLE_VORBIS
    ENABLE_OPUS
    ENABLE_FEATURE_DEFAULT_VALIDATION           # build-time assert that "mature" prefs default on; SpeechRecognitionEnabled
                                                # legitimately defaults off without MEDIA_STREAM
    CACHE STRING "" FORCE)

# --- Deliberately KEPT (candidates for a later, measured round; see docs/magpie-lean.md):
#   ENABLE_VIDEO, ENABLE_WEBASSEMBLY, ENABLE_FTL_JIT, ENABLE_GPU_PROCESS, ENABLE_WEBKIT_LEGACY,
#   ENABLE_NOTIFICATIONS, ENABLE_GEOLOCATION, ENABLE_FULLSCREEN_API, ENABLE_DRAG_SUPPORT,
#   ENABLE_CONTEXT_MENUS, ENABLE_TEXT_AUTOSIZING, ENABLE_MATHML, ENABLE_XSLT, service workers.
