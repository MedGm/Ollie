#!/usr/bin/env bash
# Tauri's bundler ships AppRun.wrapped at 0770 and linuxdeploy-plugin-gtk leaves
# usr/share/glib-2.0/schemas at 0777. A mount that keeps the stored root
# ownership (firejail, the AppImageHub catalog test) then refuses AppRun.wrapped
# to non-root users with "Permission denied". Normalize modes and repack.
set -euo pipefail

APPIMAGE="$(readlink -f "$1")"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cd "$WORK"
chmod +x "$APPIMAGE"
"$APPIMAGE" --appimage-extract > /dev/null

cd squashfs-root
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

BAD=$(unsquashfs -ll -o "$("$APPIMAGE" --appimage-offset)" "$APPIMAGE" \
  | awk '($1 ~ /^-..x/ && substr($1,10,1) != "x") || ($1 ~ /^d/ && $1 != "drwxr-xr-x") {print $1, $NF}')
if [ -n "$BAD" ]; then
  echo "AppImage entries not runnable/readable by every user:" >&2
  echo "$BAD" >&2
  exit 1
fi
echo "AppImage permissions OK: $APPIMAGE"
