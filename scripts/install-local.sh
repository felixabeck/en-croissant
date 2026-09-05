#!/usr/bin/env bash
# Install a reviewed ChessFable build for daily use, separate from the build tree.
#
#   bash scripts/install-local.sh            build from HEAD, then install
#   bash scripts/install-local.sh --no-build install the binary already in target/release
#
# Why this exists: the application-menu entry used to run
# src-tauri/target/release/en-croissant directly. Every `pnpm build` (verify:app, a drain, a
# manual check) replaced that file with whatever the working tree held at that moment, and
# cargo-target-cleanup could delete it outright. The daily app was therefore whichever
# half-reviewed state was compiled last. This script copies a build whose commit is on the
# pushed upstream — the only state that has passed the full push review — to
# ~/.local/opt/chessfable, and the launcher points there.
#
# Refuses when tracked files are dirty or HEAD is not contained in the upstream branch, so an
# unreviewed tree can never become the daily binary. `--force` overrides both checks for a
# deliberate local trial and records that in VERSION.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${CHESSFABLE_INSTALL_DIR:-$HOME/.local/opt/chessfable}"
BINARY="$REPO/src-tauri/target/release/en-croissant"
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
    echo "refusing: HEAD $(git -C "$REPO" rev-parse --short "$head") is not contained in $upstream — it has not passed the push review" >&2
    echo "run \$push first, or pass --force for a deliberate local trial" >&2
    exit 1
  fi
fi

if [ "$build" -eq 1 ]; then
  echo "building release binary from $(git -C "$REPO" rev-parse --short "$head") …"
  (cd "$REPO" && pnpm build)
fi

[ -x "$BINARY" ] || { echo "no release binary at $BINARY" >&2; exit 1; }

mkdir -p "$DEST"
tmp_bin="$DEST/.en-croissant.tmp.$$"
cp "$BINARY" "$tmp_bin"
chmod 755 "$tmp_bin"
# A running instance keeps its old inode; rename never disturbs it.
mv -f "$tmp_bin" "$DEST/en-croissant"
cp "$ICON" "$DEST/icon.png"
cat > "$DEST/VERSION" <<EOV
commit $(git -C "$REPO" rev-parse "$head")
short $(git -C "$REPO" rev-parse --short "$head")
subject $(git -C "$REPO" log -1 --format=%s "$head")
installed $(date --iso-8601=seconds)
provenance $provenance
EOV
echo "installed $(git -C "$REPO" rev-parse --short "$head") → $DEST/en-croissant ($provenance)"
