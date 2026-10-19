// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  // The AppImage bundles WebKitGTK from its (older) build distro. On newer
  // distros under Wayland its web process aborts with "Could not create
  // default EGL display: EGL_BAD_PARAMETER" and the window stays grey
  // (issue #11). Disabling accelerated compositing avoids that EGL path.
  // Distro packages use the system's WebKitGTK and keep GPU compositing.
  #[cfg(target_os = "linux")]
  if std::env::var_os("APPIMAGE").is_some()
    && std::env::var_os("WEBKIT_DISABLE_COMPOSITING_MODE").is_none()
  {
    std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
  }
  app_lib::run();
}
