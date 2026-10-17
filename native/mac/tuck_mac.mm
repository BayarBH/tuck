// Tuck's Mac App Store helper: a listen-only key tap (Input Monitoring, allowed in the sandbox, unlike
// uiohook's active tap that needs Accessibility) plus NSWorkspace foreground-app lookup/activation.
// Plain N-API (NAPI_VERSION 8 via binding.gyp). Keys are forwarded to JS only, never logged or stored.
#include <node_api.h>
#import <AppKit/AppKit.h>
#include <ApplicationServices/ApplicationServices.h>
#include <CoreGraphics/CoreGraphics.h>
#include <atomic>
#include <condition_variable>
#include <cstdint>
#include <mutex>
#include <thread>

namespace {

struct KeyEvent { int kind; double keycode; double flags; };

// One running tap. Owned by the JS (main) thread; the worker only reads port/tsfn/stopping.
struct Tap {
  uintptr_t gen = 0;
  CFMachPortRef port = nullptr;
  napi_threadsafe_function tsfn = nullptr;
  CFRunLoopRef loop = nullptr;  // set by the worker, published under mu
  std::thread th;
  std::mutex mu;
  std::condition_variable cv;
  bool ready = false;
  std::atomic<bool> stopping{false};
};

Tap *g_tap = nullptr;
uintptr_t g_gen = 0;

CGEventRef OnEvent(CGEventTapProxy, CGEventType type, CGEventRef event, void *refcon) {
  Tap *t = static_cast<Tap *>(refcon);
  // macOS disables a tap whose callback is slow or during secure input; turn it back on
  if (type == kCGEventTapDisabledByTimeout || type == kCGEventTapDisabledByUserInput) {
    if (!t->stopping) CGEventTapEnable(t->port, true);
    return event;
  }
  int kind = type == kCGEventKeyDown ? 0 : type == kCGEventKeyUp ? 1 : type == kCGEventFlagsChanged ? 2 : -1;
  if (kind < 0 || t->stopping) return event;
  KeyEvent *e = new KeyEvent{kind, (double)CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode),
                             (double)CGEventGetFlags(event)};
  // nonblocking + unbounded queue: never stall the tap (the system disables slow taps)
  if (napi_call_threadsafe_function(t->tsfn, e, napi_tsfn_nonblocking) != napi_ok) delete e;
  return event;  // listen-only: the event passes through untouched
}

void CallJs(napi_env env, napi_value cb, void *, void *data) {
  KeyEvent *e = static_cast<KeyEvent *>(data);
  if (env && cb) {  // both are null while the tsfn is torn down with queued events
    napi_value undef, argv[3];
    napi_get_undefined(env, &undef);
    napi_create_int32(env, e->kind, &argv[0]);
    napi_create_double(env, e->keycode, &argv[1]);
    napi_create_double(env, e->flags, &argv[2]);
    napi_call_function(env, undef, cb, 3, argv, nullptr);  // a JS throw surfaces as uncaughtException
  }
  delete e;
}

void Worker(Tap *t) {
  CFRunLoopSourceRef src = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, t->port, 0);
  CFRunLoopRef loop = CFRunLoopGetCurrent();
  if (src) CFRunLoopAddSource(loop, src, kCFRunLoopCommonModes);
  CGEventTapEnable(t->port, true);
  {
    std::lock_guard<std::mutex> lk(t->mu);
    t->loop = (CFRunLoopRef)CFRetain(loop);
    t->ready = true;
  }
  t->cv.notify_one();
  // Run in slices: a CFRunLoopStop that lands before the loop is running would otherwise be lost.
  while (src && !t->stopping) {
    if (CFRunLoopRunInMode(kCFRunLoopDefaultMode, 1.0, false) == kCFRunLoopRunFinished) break;
  }
  if (src) {
    CFRunLoopRemoveSource(loop, src, kCFRunLoopCommonModes);
    CFRelease(src);
  }
}

// Main thread only. releaseTsfn=false when Node is already finalizing the tsfn (env teardown).
void StopTap(bool releaseTsfn) {
  Tap *t = g_tap;
  if (!t) return;
  g_tap = nullptr;
  t->stopping = true;
  if (t->loop) CFRunLoopStop(t->loop);
  if (t->th.joinable()) t->th.join();  // after this nothing touches port or tsfn
  CGEventTapEnable(t->port, false);
  CFMachPortInvalidate(t->port);
  CFRelease(t->port);
  if (t->loop) CFRelease(t->loop);
  if (releaseTsfn) napi_release_threadsafe_function(t->tsfn, napi_tsfn_release);
  delete t;
}

// tsfn finalizer: after a normal stop() the generation no longer matches and this is a no-op; on env
// teardown (quit without stop) it joins the worker before Node frees the tsfn the worker still uses.
void OnTsfnFinalize(napi_env, void *data, void *) {
  if (g_tap && g_tap->gen == (uintptr_t)data) StopTap(false);
}

napi_value Undefined(napi_env env) {
  napi_value v;
  napi_get_undefined(env, &v);
  return v;
}

napi_value Null(napi_env env) {
  napi_value v;
  napi_get_null(env, &v);
  return v;
}

napi_value Bool(napi_env env, bool b) {
  napi_value v;
  napi_get_boolean(env, b, &v);
  return v;
}

napi_value Str(napi_env env, NSString *s) {
  if (!s) return Null(env);
  napi_value v;
  napi_create_string_utf8(env, [s UTF8String], NAPI_AUTO_LENGTH, &v);
  return v;
}

napi_value Start(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value cb = nullptr;
  napi_get_cb_info(env, info, &argc, &cb, nullptr, nullptr);
  napi_valuetype vt = napi_undefined;
  if (argc >= 1) napi_typeof(env, cb, &vt);
  if (vt != napi_function) {
    napi_throw_type_error(env, nullptr, "start(cb): cb must be a function");
    return nullptr;
  }
  StopTap(true);  // start while running = restart (a tap created before a permission grant may get nothing)
  // without Input Monitoring some macOS versions return a tap that never fires instead of NULL: fail loudly
  if (!CGPreflightListenEventAccess()) {
    napi_throw_error(env, "TUCK_NO_INPUT_MONITORING", "Input Monitoring permission not granted");
    return nullptr;
  }

  CGEventMask mask = CGEventMaskBit(kCGEventKeyDown) | CGEventMaskBit(kCGEventKeyUp) | CGEventMaskBit(kCGEventFlagsChanged);
  Tap *t = new Tap();
  t->gen = ++g_gen;
  t->port = CGEventTapCreate(kCGSessionEventTap, kCGHeadInsertEventTap, kCGEventTapOptionListenOnly, mask, OnEvent, t);
  if (!t->port) {  // Input Monitoring not granted
    delete t;
    napi_throw_error(env, "TUCK_NO_INPUT_MONITORING", "Input Monitoring permission is not granted");
    return nullptr;
  }
  napi_value name;
  napi_create_string_utf8(env, "tuck_mac_keys", NAPI_AUTO_LENGTH, &name);
  if (napi_create_threadsafe_function(env, cb, nullptr, name, 0, 1, (void *)t->gen, OnTsfnFinalize, nullptr,
                                      CallJs, &t->tsfn) != napi_ok) {
    CFMachPortInvalidate(t->port);
    CFRelease(t->port);
    delete t;
    napi_throw_error(env, nullptr, "could not create the key event callback");
    return nullptr;
  }
  napi_unref_threadsafe_function(env, t->tsfn);  // the hook alone must not keep the process alive
  g_tap = t;  // before the worker runs, so a teardown finalizer always finds it
  t->th = std::thread(Worker, t);
  {
    std::unique_lock<std::mutex> lk(t->mu);  // wait for the run loop so stop() can always reach it
    t->cv.wait(lk, [t] { return t->ready; });
  }
  return Undefined(env);
}

napi_value Stop(napi_env env, napi_callback_info) {
  StopTap(true);
  return Undefined(env);
}

napi_value ListenAccess(napi_env env, napi_callback_info) {
  return Bool(env, CGPreflightListenEventAccess());
}

napi_value RequestListenAccess(napi_env env, napi_callback_info) {
  return Bool(env, CGRequestListenEventAccess());
}

napi_value FrontApp(napi_env env, napi_callback_info) {
  @autoreleasepool {
    NSRunningApplication *app = [[NSWorkspace sharedWorkspace] frontmostApplication];
    if (!app) return Null(env);
    napi_value obj, pid;
    napi_create_object(env, &obj);
    napi_create_int32(env, (int32_t)app.processIdentifier, &pid);
    napi_set_named_property(env, obj, "pid", pid);
    napi_set_named_property(env, obj, "name", Str(env, app.localizedName));
    napi_set_named_property(env, obj, "bundleID", Str(env, app.bundleIdentifier));
    return obj;
  }
}

napi_value Activate(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value arg = nullptr;
  napi_get_cb_info(env, info, &argc, &arg, nullptr, nullptr);
  int32_t pid = 0;
  if (argc < 1 || napi_get_value_int32(env, arg, &pid) != napi_ok || pid <= 0) return Bool(env, false);
  @autoreleasepool {
    NSRunningApplication *app = [NSRunningApplication runningApplicationWithProcessIdentifier:(pid_t)pid];
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"  // IgnoringOtherApps: deprecated in 14, needed before it
    bool ok = app && [app activateWithOptions:NSApplicationActivateIgnoringOtherApps];
#pragma clang diagnostic pop
    return Bool(env, ok);
  }
}

napi_value Init(napi_env env, napi_value exports) {
  napi_property_descriptor props[] = {
    {"start", nullptr, Start, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"stop", nullptr, Stop, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"listenAccess", nullptr, ListenAccess, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"requestListenAccess", nullptr, RequestListenAccess, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"frontApp", nullptr, FrontApp, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"activate", nullptr, Activate, nullptr, nullptr, nullptr, napi_default, nullptr},
  };
  napi_define_properties(env, exports, sizeof(props) / sizeof(props[0]), props);
  return exports;
}

}  // namespace

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
