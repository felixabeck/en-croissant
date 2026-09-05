#!/usr/bin/env bash
# Install a reviewed ChessFable build for daily use, separate from the build tree.
#
#   bash scripts/install-local.sh            build from HEAD, then install
#   bash scripts/install-local.sh --no-build install the build already in target/release
#   bash scripts/install-local.sh --force    also accept a dirty tree / unpushed HEAD (recorded)
#
# Why this exists: the application-menu entry used to run
# src-tauri/target/release/en-croissant directly. Every `pnpm build` (verify:app, a drain, a
# manual check) replaced that file with whatever the working tree held at that moment, and
# cargo-target-cleanup could delete it outright. The daily app was therefore whichever
# half-reviewed state was compiled last. This script installs a build whose commit is on the
# pushed upstream — the only state that has passed the full push review — and the launcher
# points at the install.
#
# Layout under ~/.local/opt/chessfable (the Debian-bundle shape Tauri expects):
#   releases/<short>-<timestamp>/bin/en-croissant
#   releases/<short>-<timestamp>/lib/en-croissant/sound/   bundled resources — measured on
#       2026-09-05 against tauri-utils 2.8.2 `resource_dir_from`: outside a cargo output
#       directory, Linux resolves `<exe_dir>/../lib/<productName>` if it exists, else
#       `/usr/lib/<productName>`. Resources next to the executable are NOT found.
#   releases/<short>-<timestamp>/{icon.png,VERSION}
#   current -> releases/<…>         swapped by an atomic rename; the launcher runs current/bin/en-croissant
#   previous -> releases/<…>        the install before this one, kept for rollback
# A running instance keeps its open binary and its resource-directory descriptor, so an
# install while the app is running changes nothing until the next launch.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="${CHESSFABLE_INSTALL_DIR:-$HOME/.local/opt/chessfable}"
RELEASE_DIR="$REPO/src-tauri/target/release"
ICON="$REPO/src-tauri/icons/icon.png"

build=1
force=0
for arg in "$@"; do
  case "$arg" in
    --no-build) build=0 ;;
    --force) force=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

head="$(git -C "$REPO" rev-parse HEAD)"
short="$(git -C "$REPO" rev-parse --short "$head")"
upstream="$(git -C "$REPO" rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || echo origin/master)"
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

[ -x "$RELEASE_DIR/en-croissant" ] || { echo "no release binary in $RELEASE_DIR" >&2; exit 1; }
[ -d "$RELEASE_DIR/sound" ] || { echo "no bundled sound/ resources in $RELEASE_DIR — the build is incomplete" >&2; exit 1; }

stamp="$(date +%Y%m%dT%H%M%S)"
mkdir -p "$ROOT/releases"
staging="$ROOT/releases/.staging-$$"
target="$ROOT/releases/$short-$stamp"
rm -rf "$staging"
mkdir -p "$staging"
mkdir -p "$staging/bin" "$staging/lib/en-croissant"
cp "$RELEASE_DIR/en-croissant" "$staging/bin/en-croissant"
chmod 755 "$staging/bin/en-croissant"
cp -R "$RELEASE_DIR/sound" "$staging/lib/en-croissant/sound"
cp "$ICON" "$staging/icon.png"
cat > "$staging/VERSION" <<EOV
commit $head
short $short
subject $(git -C "$REPO" log -1 --format=%s "$head")
installed $(date --iso-8601=seconds)
provenance $provenance
EOV
mv "$staging" "$target"

# Atomic swap of the `current` symlink: write a temporary link, then rename it over the old one.
ln -sfn "$target" "$ROOT/.current-new-$$"
if [ -L "$ROOT/current" ]; then
  ln -sfn "$(readlink -f "$ROOT/current")" "$ROOT/.previous-new-$$"
  mv -T "$ROOT/.previous-new-$$" "$ROOT/previous"
fi
mv -T "$ROOT/.current-new-$$" "$ROOT/current"

# Keep only the releases `current` and `previous` point at.
keep_current="$(readlink -f "$ROOT/current")"
keep_previous="$( [ -L "$ROOT/previous" ] && readlink -f "$ROOT/previous" || true )"
for dir in "$ROOT"/releases/*/; do
  dir="${dir%/}"
  [ "$dir" = "$keep_current" ] && continue
  [ "$dir" = "$keep_previous" ] && continue
  rm -rf "$dir"
done

echo "installed $short → $ROOT/current/bin/en-croissant ($provenance)"
