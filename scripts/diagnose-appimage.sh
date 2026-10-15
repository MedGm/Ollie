#!/usr/bin/env bash
# Usage: bash diagnose-appimage.sh ./Ollie_<version>_amd64.AppImage
# Starts the AppImage several ways and reports which ones survive 10 seconds.
set -u
APPIMAGE="$(readlink -f "$1")"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "== System"
grep PRETTY_NAME /etc/os-release
echo "Session: ${XDG_SESSION_TYPE:-unknown}  Desktop: ${XDG_CURRENT_DESKTOP:-unknown}"
lspci 2>/dev/null | grep -iE "vga|3d|display" | sed 's/^/GPU: /'
lsmod 2>/dev/null | grep -qE "^nvidia " && echo "NVIDIA proprietary driver: loaded"
echo

cd "$WORK"
chmod +x "$APPIMAGE" 2>/dev/null
"$APPIMAGE" --appimage-extract > /dev/null
APPDIR="$WORK/squashfs-root"
mkdir -p "$WORK/removed"

try() {
  local name="$1"; shift
  ( env "$@" "$APPDIR/AppRun" > "$WORK/log" 2>&1 ) &
  local pid=$!
  sleep 10
  if kill -0 "$pid" 2>/dev/null; then
    echo "OK      $name"
    pkill -P "$pid" 2>/dev/null; kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null
  elif grep -q "cannot open shared object file" "$WORK/log"; then
    echo "SKIP    $name  (library not installed on this system)"
  else
    echo "CRASH   $name  ($(grep -m1 -E 'EGL|Abort|error' "$WORK/log"))"
  fi
  sleep 1
}

hide() { for f in "$@"; do mv "$APPDIR"/usr/lib/$f "$WORK/removed/" 2>/dev/null; done; }
restore() { mv "$WORK"/removed/* "$APPDIR/usr/lib/" 2>/dev/null; }

echo "== Results"
try "as shipped"
try "GDK_BACKEND=x11" GDK_BACKEND=x11
try "GIO_USE_VFS=local" GIO_USE_VFS=local
try "WEBKIT_DISABLE_COMPOSITING_MODE=1" WEBKIT_DISABLE_COMPOSITING_MODE=1
hide 'libwayland-*'; try "without bundled libwayland-*"; restore
hide 'libepoxy*'; try "without bundled libepoxy"; restore
hide 'libgstgl*'; try "without bundled libgstgl"; restore
hide 'libwayland-*' 'libepoxy*' 'libgstgl*' 'libffi*'; try "without wayland+epoxy+gstgl+ffi"; restore
