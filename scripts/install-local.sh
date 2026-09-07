#!/usr/bin/env bash
# Install a reviewed ChessFable build for daily use, separate from the build tree.
# The stable launcher remains current/bin/en-croissant for rollback compatibility. The real
# executable is bin/chessfable, and Tauri resolves resources from lib/ChessFable.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="${CHESSFABLE_INSTALL_DIR:-$HOME/.local/opt/chessfable}"
RELEASE_DIR="$REPO/src-tauri/target/release"
ICON="$REPO/src-tauri/icons/icon.png"
APPLICATIONS_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
DESKTOP="$APPLICATIONS_DIR/ChessFable.desktop"

build=1
force=0
for arg in "$@"; do
  case "$arg" in
    --no-build) build=0 ;;
    --force) force=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

mapfile -t identity < <(node -e '
  const c = require(process.argv[1]);
  for (const value of [c.mainBinaryName, c.productName]) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) process.exit(2);
    console.log(value);
  }
' "$REPO/src-tauri/tauri.conf.json")
[ "${#identity[@]}" -eq 2 ] || { echo "invalid product identity in tauri.conf.json" >&2; exit 1; }
binary="${identity[0]}"
product_name="${identity[1]}"

head="$(git -C "$REPO" rev-parse HEAD)"
short="$(git -C "$REPO" rev-parse --short "$head")"
if ! upstream="$(git -C "$REPO" rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null)"; then
  echo "refusing: the current branch has no configured upstream" >&2
  exit 1
fi
dirty="$(git -C "$REPO" status --porcelain --untracked-files=no)"
provenance="reviewed"
if [ -n "$dirty" ]; then
  if [ "$force" -eq 1 ]; then
    provenance="UNREVIEWED (dirty tree, --force)"
  else
    echo "refusing: tracked files are modified — the binary would not match any reviewed commit" >&2
    printf '%s\n' "$dirty" >&2
    echo "commit or stash first, or pass --force for a deliberate local trial" >&2
    exit 1
  fi
fi

if ! git -C "$REPO" rev-parse --verify "$upstream^{commit}" >/dev/null 2>&1; then
  echo "refusing: configured upstream $upstream cannot be resolved" >&2
  exit 1
fi
if ! git -C "$REPO" merge-base --is-ancestor "$head" "$upstream"; then
  if [ "$force" -eq 1 ]; then
    provenance="UNREVIEWED (HEAD not on $upstream, --force)"
  else
    echo "refusing: HEAD $short is not contained in $upstream — it has not passed the push review" >&2
    echo "run \$push first, or pass --force for a deliberate local trial" >&2
    exit 1
  fi
fi

if [ "$build" -eq 1 ]; then
  echo "building release binary from $short …"
  (cd "$REPO" && pnpm build)
fi
[ -x "$RELEASE_DIR/$binary" ] || { echo "no release binary in $RELEASE_DIR" >&2; exit 1; }
[ -d "$RELEASE_DIR/sound" ] || { echo "no bundled sound/ resources in $RELEASE_DIR — the build is incomplete" >&2; exit 1; }

mkdir -p "$ROOT/releases" "$APPLICATIONS_DIR"
staging=""
target="$ROOT/releases/$short-$(date +%Y%m%dT%H%M%S)-$$"
current_tmp="$ROOT/.current-new-$$"
previous_tmp="$ROOT/.previous-new-$$"
desktop_tmp=""
current_committed=0
target_owned=0
original_current_present=0
original_previous_present=0
original_current=""
original_previous=""
[ ! -e "$ROOT/current" ] || [ -L "$ROOT/current" ] || { echo "refusing: current exists and is not a symlink" >&2; exit 1; }
[ ! -e "$ROOT/previous" ] || [ -L "$ROOT/previous" ] || { echo "refusing: previous exists and is not a symlink" >&2; exit 1; }
[ -L "$ROOT/current" ] && { original_current_present=1; original_current="$(readlink "$ROOT/current")"; }
[ -L "$ROOT/previous" ] && { original_previous_present=1; original_previous="$(readlink "$ROOT/previous")"; }

restore_link() {
  local path="$1" present="$2" value="$3" temporary="$4"
  if [ "$present" -eq 1 ]; then
    ln -s "$value" "$temporary" && mv -T "$temporary" "$path"
  else
    [ ! -e "$path" ] && [ ! -L "$path" ] || rm "$path"
  fi
}

cleanup() {
  local status="$?"
  trap - EXIT INT TERM HUP
  [ -z "$staging" ] || rm -rf "$staging"
  rm -f "$current_tmp" "$previous_tmp"
  [ -z "$desktop_tmp" ] || rm -f "$desktop_tmp"
  if [ "$status" -ne 0 ] && [ "$current_committed" -eq 0 ]; then
    if ! restore_link "$ROOT/current" "$original_current_present" "$original_current" "$current_tmp"; then
      echo "restoration failure: could not restore original current link" >&2
      status=1
    fi
    if ! restore_link "$ROOT/previous" "$original_previous_present" "$original_previous" "$previous_tmp"; then
      echo "restoration failure: could not restore original previous link" >&2
      status=1
    fi
    rm -f "$current_tmp" "$previous_tmp"
  fi
  if [ "$target_owned" -eq 1 ] && [ "$current_committed" -eq 0 ]; then
    local current_target="" previous_target=""
    [ -L "$ROOT/current" ] && current_target="$(readlink -f "$ROOT/current" || true)"
    [ -L "$ROOT/previous" ] && previous_target="$(readlink -f "$ROOT/previous" || true)"
    if [ "$target" != "$current_target" ] && [ "$target" != "$previous_target" ]; then
      rm -rf "$target"
    fi
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT TERM HUP

staging="$(mktemp -d "$ROOT/releases/.staging-XXXXXXXX")"
desktop_tmp="$(mktemp "$APPLICATIONS_DIR/.ChessFable.desktop.XXXXXXXX")"

mkdir -p "$staging/bin" "$staging/lib/$product_name"
cp "$RELEASE_DIR/$binary" "$staging/bin/$binary"
chmod 755 "$staging/bin/$binary"
ln -s "$binary" "$staging/bin/en-croissant"
cp -R "$RELEASE_DIR/sound" "$staging/lib/$product_name/sound"
cp "$ICON" "$staging/icon.png"
printf 'commit %s\nshort %s\nsubject %s\ninstalled %s\nprovenance %s\n' \
  "$head" "$short" "$(git -C "$REPO" log -1 --format=%s "$head")" \
  "$(date --iso-8601=seconds)" "$provenance" > "$staging/VERSION"
target_owned=1
mv "$staging" "$target"

desktop_root="${ROOT//\\/\\\\}"
desktop_root="${desktop_root//\"/\\\"}"
desktop_icon_root="${desktop_root// /\\s}"
cat > "$desktop_tmp" <<EOF
[Desktop Entry]
Type=Application
Name=ChessFable
Exec="$desktop_root/current/bin/en-croissant"
Icon=$desktop_icon_root/current/icon.png
Terminal=false
StartupWMClass=ChessFable
Categories=Game;
EOF
chmod 644 "$desktop_tmp"

ln -s "$target" "$current_tmp"
if [ "$original_current_present" -eq 1 ]; then
  ln -s "$original_current" "$previous_tmp"
  mv -T "$previous_tmp" "$ROOT/previous"
fi
if ! mv -T "$current_tmp" "$ROOT/current"; then
  echo "current publication failed; installed state will be restored" >&2
  exit 1
fi
current_committed=1

if ! mv -T "$desktop_tmp" "$DESKTOP"; then
  echo "desktop publication failed after install committed: current=$target; rollback=$ROOT/previous" >&2
  exit 1
fi

echo "installed $short → $ROOT/current/bin/$binary (compatibility launcher: $ROOT/current/bin/en-croissant; $provenance)"
