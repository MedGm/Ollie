#!/usr/bin/env bash
# Tauri's bundler ships AppRun.wrapped at 0770 and linuxdeploy-plugin-gtk leaves
# usr/share/glib-2.0/schemas at 0777. A mount that keeps the stored root
# ownership (firejail, the AppImageHub catalog test) then refuses AppRun.wrapped
# to non-root users with "Permission denied". Normalize modes and repack.
#
# Also drop libwayland-client: it must match the host's Mesa EGL. A copy from an
# older build distro (e.g. 24.04's 1.22 on a 26.04 host) keeps libEGL_mesa from
# loading, and WebKit aborts with "Could not create default EGL display:
# EGL_BAD_PARAMETER" (issue #11). Every distro with GTK3 ships it.
set -euo pipefail

APPIMAGE="$(readlink -f "$1")"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cd "$WORK"
chmod +x "$APPIMAGE"
"$APPIMAGE" --appimage-extract > /dev/null

cd squashfs-root
rm -f usr/lib/libwayland-client.so*
find . -type d -exec chmod 755 {} +
find . -type f -perm -u+x -exec chmod 755 {} +
find . -type f ! -perm -u+x -exec chmod 644 {} +
cd ..

curl -fsSL -o appimagetool \
  https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage
chmod +x appimagetool
ARCH=x86_64 APPIMAGE_EXTRACT_AND_RUN=1 ./appimagetool --no-appstream squashfs-root "$WORK/fixed.AppImage" > /dev/null
mv "$WORK/fixed.AppImage" "$APPIMAGE"
chmod 755 "$APPIMAGE"

LISTING=$(unsquashfs -ll -o "$("$APPIMAGE" --appimage-offset)" "$APPIMAGE")
if grep -q "usr/lib/libwayland-client" <<< "$LISTING"; then
  echo "AppImage still bundles libwayland-client" >&2
  exit 1
fi
BAD=$(awk '($1 ~ /^-..x/ && substr($1,10,1) != "x") || ($1 ~ /^d/ && $1 != "drwxr-xr-x") {print $1, $NF}' <<< "$LISTING")
if [ -n "$BAD" ]; then
  echo "AppImage entries not runnable/readable by every user:" >&2
  echo "$BAD" >&2
  exit 1
fi
echo "AppImage OK: $APPIMAGE"
