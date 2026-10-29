/*
 * Copyright (C) 2019 Microsoft Corporation.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

#import "config.h"
#import "InspectorPlaywrightAgentClientMac.h"

#import "PageClient.h"
#import "WebPageProxy.h"
#import "WebProcessPool.h"
#import "WebsiteDataStore.h"
#import "_WKBrowserInspector.h"
#import "WKProcessPoolInternal.h"
#import "WKWebsiteDataStoreInternal.h"
#import "WKWebView.h"
#import "WKWebViewInternal.h"
#import <WebCore/ImageUtilities.h>
#import <ImageIO/ImageIO.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <wtf/RefPtr.h>
#import <wtf/text/Base64.h>
#import <wtf/text/MakeString.h>
#import <wtf/text/WTFString.h>

namespace WebKit {

InspectorPlaywrightAgentClientMac::InspectorPlaywrightAgentClientMac(_WKBrowserInspectorDelegate* delegate, bool headless)
  : delegate_(delegate),
    headless_(headless)
{
}

RefPtr<WebPageProxy> InspectorPlaywrightAgentClientMac::createPage(WTF::String& error, const BrowserContext& browserContext)
{
    auto sessionID = browserContext.dataStore->sessionID();
    WKWebView *webView = [delegate_ createNewPage:sessionID.toUInt64()];
    if (!webView) {
        error = "Internal error: can't create page in given context"_s;
        return nil;
    }
    return [webView _page].get();
}

void InspectorPlaywrightAgentClientMac::closeBrowser()
{
    [delegate_ quit];
}

std::unique_ptr<BrowserContext> InspectorPlaywrightAgentClientMac::createBrowserContext(WTF::String& error, const WTF::String& proxyServer, const WTF::String& proxyBypassList)
{
    _WKBrowserContext* wkBrowserContext = [[delegate_ createBrowserContext:proxyServer.createNSString().get() WithBypassList:proxyBypassList.createNSString().get()] autorelease];
    auto browserContext = std::make_unique<BrowserContext>();
    browserContext->processPool = &static_cast<WebProcessPool&>([[wkBrowserContext processPool] _apiObject]);
    browserContext->dataStore = &static_cast<WebsiteDataStore&>([[wkBrowserContext dataStore] _apiObject]);
    return browserContext;
}

void InspectorPlaywrightAgentClientMac::deleteBrowserContext(WTF::String& error, PAL::SessionID sessionID)
{
    [delegate_ deleteBrowserContext:sessionID.toUInt64()];
}

// Magpie-lean: screenshots are consumed by a pixel differ, never stored, so trade PNG size for
// encode time. ImageIO's default adaptive filtering costs ~47 ms for a 1920x1080 UI frame on an
// M4 Pro; IMAGEIO_PNG_FILTER_NONE is ~13 ms at ~1.4x the bytes. Pixels are identical either way.
// Set MAGPIE_SCREENSHOT_PNG_FILTERS=1 to get the default encoder back.
static String encodeScreenshotPNGDataURL(CGImageRef image)
{
    static bool useDefaultFilters = [] {
        const char* value = getenv("MAGPIE_SCREENSHOT_PNG_FILTERS");
        return value && *value && strcmp(value, "0");
    }();
    if (useDefaultFilters)
        return WebCore::encodeDataURL(image, "image/png"_s, std::nullopt);

    RetainPtr<CFMutableDataRef> data = adoptCF(CFDataCreateMutable(kCFAllocatorDefault, 0));
    RetainPtr<CGImageDestinationRef> destination = adoptCF(CGImageDestinationCreateWithData(data.get(), (__bridge CFStringRef)UTTypePNG.identifier, 1, nullptr));
    if (!destination)
        return WebCore::encodeDataURL(image, "image/png"_s, std::nullopt);

    NSDictionary *properties = @{
        (__bridge NSString *)kCGImagePropertyPNGDictionary: @{
            (__bridge NSString *)kCGImagePropertyPNGCompressionFilter: @(IMAGEIO_PNG_FILTER_NONE),
        },
    };
    CGImageDestinationAddImage(destination.get(), image, (__bridge CFDictionaryRef)properties);
    if (!CGImageDestinationFinalize(destination.get()))
        return WebCore::encodeDataURL(image, "image/png"_s, std::nullopt);

    return makeString("data:image/png;base64,"_s, base64Encoded(std::span { CFDataGetBytePtr(data.get()), static_cast<size_t>(CFDataGetLength(data.get())) }));
}

void InspectorPlaywrightAgentClientMac::takePageScreenshot(WebPageProxy& page, WebCore::IntRect&& clipRect, bool, CompletionHandler<void(const String&, const String&)>&& completionHandler)
{
    int toolbarHeight = headless_ ? 0 : 59;
    page.callAfterNextPresentationUpdate([protectedPage = Ref { page }, toolbarHeight, clipRect = WTF::move(clipRect), completionHandler = WTF::move(completionHandler)]() mutable {
        RetainPtr<CGImageRef> imageRef = protectedPage->pageClient()->takeSnapshotForAutomation();
        if (!imageRef) {
            completionHandler("Could not take view snapshot"_s, emptyString());
            return;
        }

        clipRect.move(0, toolbarHeight);
        RetainPtr<CGImageRef> transformedImageRef = adoptCF(CGImageCreateWithImageInRect(imageRef.get(), clipRect));
        completionHandler(emptyString(), encodeScreenshotPNGDataURL(transformedImageRef.get()));
    });
}

} // namespace WebKit
