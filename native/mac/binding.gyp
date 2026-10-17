{
  "targets": [{
    "target_name": "tuck_mac",
    "sources": ["tuck_mac.mm"],
    "defines": ["NAPI_VERSION=8"],
    "conditions": [["OS=='mac'", {
      "xcode_settings": {
        "MACOSX_DEPLOYMENT_TARGET": "10.15",
        "CLANG_ENABLE_OBJC_ARC": "YES",
        "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
        # universal: gyp itself only passes the host -arch; clang dedupes repeated -arch flags.
        # .mm files take OTHER_CPLUSPLUSFLAGS (not OTHER_CFLAGS) in gyp's make generator.
        "OTHER_CPLUSPLUSFLAGS": ["-arch", "x86_64", "-arch", "arm64"],
        "OTHER_LDFLAGS": [
          "-arch", "x86_64", "-arch", "arm64",
          "-framework", "CoreGraphics", "-framework", "AppKit",
          "-framework", "Foundation", "-framework", "ApplicationServices"
        ]
      }
    }]]
  }]
}
