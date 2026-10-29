set(PLAYWRIGHT_DIR "${TOOLS_DIR}/Playwright/mac")

find_library(SECURITYINTERFACE_LIBRARY SecurityInterface)

set(PRODUCT_BUNDLE_IDENTIFIER "com.microsoft.playwright")

#FIXME: This should not need WEBCORE_EXPORT defined.  This means we are including WebCore headers, and we should not.
add_definitions("-include Playwright_Prefix.pch -DWEBCORE_EXPORT=")

set(Playwright_SOURCES
    ${PLAYWRIGHT_DIR}/AppDelegate.m
    ${PLAYWRIGHT_DIR}/BrowserWindowController.m
    ${PLAYWRIGHT_DIR}/main.m
    ${TOOLS_DIR}/Playwright/MBToolbarItem.m
)

# WebKit headers must precede WebKitLegacy's -- Legacy has a WebKit -> WebKitLegacy symlink,
# so <WebKit/WebKit.h> resolves to the legacy umbrella if Legacy is searched first.
# (Mirrors Tools/MiniBrowser/mac/CMakeLists.txt.) WebNSURLExtras.h comes from WebKitLegacy.
set(Playwright_INCLUDE_DIRECTORIES
    ${WebKit_FRAMEWORK_HEADERS_DIR}
    ${WebKitLegacy_FRAMEWORK_HEADERS_DIR}
    ${WebCore_PRIVATE_FRAMEWORK_HEADERS_DIR}
    ${JavaScriptCore_FRAMEWORK_HEADERS_DIR}
    ${JavaScriptCore_PRIVATE_FRAMEWORK_HEADERS_DIR}
    ${WTF_FRAMEWORK_HEADERS_DIR}
    ${CMAKE_SOURCE_DIR}/Source/WebKitLegacy
    ${CMAKE_SOURCE_DIR}/Source
    ${PLAYWRIGHT_DIR}
)

set(Playwright_LIBRARIES
    ${SECURITYINTERFACE_LIBRARY}
    "-framework QuartzCore"
    WebKit
    WebKitLegacy
)

set(CMAKE_EXE_LINKER_FLAGS "-framework Cocoa")

set(EXECUTABLE_NAME Playwright)
set(PRODUCT_NAME Playwright)

set(Playwright_Contents_Directory ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}/Playwright.app/Contents)
make_directory(${Playwright_Contents_Directory}/Resources)
add_custom_command(OUTPUT ${Playwright_Contents_Directory}/Resources/BrowserWindow.nib
    COMMAND ibtool --compile ${Playwright_Contents_Directory}/Resources/BrowserWindow.nib ${PLAYWRIGHT_DIR}/BrowserWindow.xib VERBATIM)
add_custom_command(OUTPUT ${Playwright_Contents_Directory}/Resources/MainMenu.nib
    COMMAND ibtool --compile ${Playwright_Contents_Directory}/Resources/MainMenu.nib ${PLAYWRIGHT_DIR}/MainMenu.xib VERBATIM)
add_custom_target(PlaywrightNibs ALL DEPENDS
    ${Playwright_Contents_Directory}/Resources/BrowserWindow.nib
    ${Playwright_Contents_Directory}/Resources/MainMenu.nib
)

include_directories(${Playwright_INCLUDE_DIRECTORIES})
add_executable(Playwright MACOSX_BUNDLE ${Playwright_SOURCES})
WEBKIT_ADD_TARGET_CXX_FLAGS(Playwright -Wno-unused-parameter -Wno-deprecated-declarations)
set_target_properties(Playwright PROPERTIES MACOSX_BUNDLE_INFO_PLIST ${PLAYWRIGHT_DIR}/Info.plist)
target_link_libraries(Playwright ${Playwright_LIBRARIES})
add_dependencies(Playwright PlaywrightNibs)
set(Playwright_XPC_SERVICES WebProcess NetworkProcess)
if (TARGET GPUProcess)
    list(APPEND Playwright_XPC_SERVICES GPUProcess)
endif ()
if (TARGET WebProcessEnhancedSecurity)
    list(APPEND Playwright_XPC_SERVICES WebProcessEnhancedSecurity WebProcessCaptivePortal)
endif ()
foreach (_service IN LISTS Playwright_XPC_SERVICES)
    set_property(TARGET Playwright APPEND PROPERTY LINK_DEPENDS $<TARGET_FILE:${_service}>)
endforeach ()

# Launcher that playwright-core can be pointed at via PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH
# (Magpie reads that env var in src/playwright/playwright.config.ts). Same contract as the
# pw_run.sh that ships in the official webkit-<rev> bundle, plus the __XPC_DYLD_* variables:
# SIP strips DYLD_* for XPC children, so without them the WebContent/Networking/GPU services
# would load the *system* WebKit and crash with a version mismatch.
# Mirrors Tools/Scripts/webkitdirs.pm:setupMacWebKitEnvironment().
file(WRITE ${CMAKE_BINARY_DIR}/pw_run.sh
"#!/bin/bash
DIR=\"\$(cd \"\$(dirname \"\${BASH_SOURCE[0]}\")\" && pwd)\"
export DYLD_FRAMEWORK_PATH=\"\$DIR\${DYLD_FRAMEWORK_PATH:+:\$DYLD_FRAMEWORK_PATH}\"
export __XPC_DYLD_FRAMEWORK_PATH=\"\$DIR\"
export DYLD_LIBRARY_PATH=\"\$DIR\${DYLD_LIBRARY_PATH:+:\$DYLD_LIBRARY_PATH}\"
export __XPC_DYLD_LIBRARY_PATH=\"\$DIR\"
exec \"\$DIR/Playwright.app/Contents/MacOS/Playwright\" \"\$@\"
")
file(CHMOD ${CMAKE_BINARY_DIR}/pw_run.sh PERMISSIONS
    OWNER_READ OWNER_WRITE OWNER_EXECUTE GROUP_READ GROUP_EXECUTE WORLD_READ WORLD_EXECUTE)
