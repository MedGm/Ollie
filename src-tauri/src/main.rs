// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  // Force Mesa's software rasterizer (llvmpipe) so WebKitGTK and GStreamer
  // never touch the host's hardware EGL/Wayland driver path. Root cause:
  // a webkit2gtk regression (~2.46+) aborts EGL display creation
  // (EGL_BAD_PARAMETER) on some Wayland/driver combos, independent of
  // WebKit's own compositing/hardware-acceleration settings (see lib.rs) —
  // those only affect what WebKit *chooses* to render with, not whether it
  // probes EGL at all. Must be set before WebKit/GStreamer initialize.
  #[cfg(target_os = "linux")]
  {
    std::env::set_var("LIBGL_ALWAYS_SOFTWARE", "1");
  }
  app_lib::run();
}
