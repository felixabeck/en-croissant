#!/usr/bin/env bash
# Install a reviewed ChessFable build for daily use, separate from the build tree.
#
#   bash scripts/install-local.sh            build from HEAD, then install
#   bash scripts/install-local.sh --no-build install the build already in target/release
#   bash scripts/install-local.sh --force    permit a dirty tree or unpushed HEAD and record it
#
# The stable launcher remains current/bin/en-croissant for rollback compatibility. The real
# executable is bin/chessfable, and Tauri resolves resources from lib/ChessFable.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="${CHESSFABLE_INSTALL_DIR:-$HOME/.local/opt/chessfable}"
RELEASE_DIR="$REPO/src-tauri/target/release"
ICON="$REPO/src-tauri/icons/icon.png"
APPLICATIONS_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"

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
DESKTOP="$APPLICATIONS_DIR/$product_name.desktop"

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

mkdir -p "$ROOT"
lock_file="$ROOT/.install.lock"
exec {lock_fd}>"$lock_file"
if ! flock "$lock_fd"; then
  echo "could not acquire installer lock $lock_file" >&2
  exit 1
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
current_tmp=""
previous_tmp=""
desktop_tmp=""
invocation_id=""
managed_marker_name='.chessfable-managed-release'
managed_marker_value='ChessFable local installer release v1'
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
  local status="$?" promoted_by_this_invocation="$target_owned" current_target="" target_real=""
  trap - EXIT INT TERM HUP
  if [ "$promoted_by_this_invocation" -eq 0 ] && [ -n "$staging" ] &&
     [ ! -e "$staging" ] && [ -f "$target/$managed_marker_name" ] &&
     [ ! -L "$target/$managed_marker_name" ] &&
     [ "$(cat "$target/$managed_marker_name")" = "$managed_marker_value
invocation $invocation_id" ]; then
    promoted_by_this_invocation=1
  fi
  if [ "$status" -ne 0 ] && [ "$current_committed" -eq 0 ] &&
     [ "$promoted_by_this_invocation" -eq 1 ] && [ -L "$ROOT/current" ]; then
    current_target="$(readlink -f "$ROOT/current" || true)"
    target_real="$(readlink -f "$target" || true)"
    if [ -n "$target_real" ] && [ "$current_target" = "$target_real" ]; then
      current_committed=1
      echo "install interrupted after current publication: current=$target; rollback=$ROOT/previous" >&2
    fi
  fi
  [ -z "$staging" ] || rm -rf "$staging"
  [ -z "$current_tmp" ] || rm -f "$current_tmp"
  [ -z "$previous_tmp" ] || rm -f "$previous_tmp"
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
    [ -z "$current_tmp" ] || rm -f "$current_tmp"
    [ -z "$previous_tmp" ] || rm -f "$previous_tmp"
  fi
  if [ "$promoted_by_this_invocation" -eq 1 ] && [ "$current_committed" -eq 0 ]; then
    local previous_target=""
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
invocation_id="${staging##*/}"
current_tmp="$(mktemp "$ROOT/.current-new-XXXXXXXX")"
previous_tmp="$(mktemp "$ROOT/.previous-new-XXXXXXXX")"
desktop_tmp="$(mktemp "$APPLICATIONS_DIR/.$product_name.desktop.XXXXXXXX")"
rm "$current_tmp" "$previous_tmp"

mkdir -p "$staging/bin" "$staging/lib/$product_name"
cp "$RELEASE_DIR/$binary" "$staging/bin/$binary"
chmod 755 "$staging/bin/$binary"
ln -s "$binary" "$staging/bin/en-croissant"
cp -R "$RELEASE_DIR/sound" "$staging/lib/$product_name/sound"
cp "$ICON" "$staging/icon.png"
printf 'commit %s\nshort %s\nsubject %s\ninstalled %s\nprovenance %s\n' \
  "$head" "$short" "$(git -C "$REPO" log -1 --format=%s "$head")" \
  "$(date --iso-8601=seconds)" "$provenance" > "$staging/VERSION"
printf '%s\ninvocation %s\n' "$managed_marker_value" "$invocation_id" > "$staging/$managed_marker_name"
mv -T "$staging" "$target"
target_owned=1
staging=""

desktop_root="${ROOT//\\/\\\\}"
desktop_root="${desktop_root//\"/\\\"}"
desktop_icon_root="${desktop_root// /\\s}"
cat > "$desktop_tmp" <<EOF
[Desktop Entry]
Type=Application
Name=$product_name
Exec="$desktop_root/current/bin/en-croissant"
Icon=$desktop_icon_root/current/icon.png
Terminal=false
StartupWMClass=$product_name
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
desktop_tmp=""

is_legacy_managed_release() {
  local candidate="$1" name commit_line short_line subject_line installed_line provenance_line extra
  name="${candidate##*/}"
  [[ "$name" =~ ^([0-9a-f]{7,40})-[0-9]{8}T[0-9]{6}(-[0-9]+)?$ ]] || return 1
  [ -f "$candidate/VERSION" ] && [ ! -L "$candidate/VERSION" ] || return 1
  {
    IFS= read -r commit_line
    IFS= read -r short_line
    IFS= read -r subject_line
    IFS= read -r installed_line
    IFS= read -r provenance_line
    IFS= read -r extra || true
  } < "$candidate/VERSION"
  [[ "$commit_line" =~ ^commit\ ([0-9a-f]{40})$ ]] || return 1
  [[ "$short_line" =~ ^short\ ([0-9a-f]{7,40})$ ]] || return 1
  [ "${BASH_REMATCH[1]}" = "${name%%-*}" ] || return 1
  [[ "$commit_line" == "commit ${BASH_REMATCH[1]}"* ]] || return 1
  [[ "$subject_line" == subject\ * ]] || return 1
  [[ "$installed_line" == installed\ * ]] || return 1
  [[ "$provenance_line" == provenance\ reviewed || "$provenance_line" == provenance\ UNREVIEWED\ * ]] || return 1
  [ -z "$extra" ] || return 1
  [ -f "$candidate/icon.png" ] && [ ! -L "$candidate/icon.png" ] || return 1
  if [ -x "$candidate/bin/en-croissant" ] && [ ! -L "$candidate/bin/en-croissant" ] &&
     [ -d "$candidate/lib/en-croissant/sound" ] && [ ! -L "$candidate/lib/en-croissant/sound" ]; then
    return 0
  fi
  [ -x "$candidate/bin/$binary" ] &&
    [ -L "$candidate/bin/en-croissant" ] &&
    [ "$(readlink "$candidate/bin/en-croissant")" = "$binary" ] &&
    [ -d "$candidate/lib/$product_name/sound" ] &&
    [ ! -L "$candidate/lib/$product_name/sound" ]
}

is_marked_managed_release() {
  local candidate="$1" header invocation extra
  [ -f "$candidate/$managed_marker_name" ] &&
    [ ! -L "$candidate/$managed_marker_name" ] || return 1
  {
    IFS= read -r header
    IFS= read -r invocation
    IFS= read -r extra || true
  } < "$candidate/$managed_marker_name"
  [ "$header" = "$managed_marker_value" ] || return 1
  [[ "$invocation" =~ ^invocation\ \.staging-[A-Za-z0-9]{8}$ ]] || return 1
  [ -z "$extra" ]
}

keep_current="$(readlink -f "$ROOT/current")"
keep_previous=""
[ ! -L "$ROOT/previous" ] || keep_previous="$(readlink -f "$ROOT/previous" || true)"
for candidate in "$ROOT/releases"/*; do
  [ -d "$candidate" ] && [ ! -L "$candidate" ] || continue
  candidate_real="$(readlink -f "$candidate")"
  [ "$candidate_real" = "$keep_current" ] && continue
  [ "$candidate_real" = "$keep_previous" ] && continue
  if is_marked_managed_release "$candidate" || is_legacy_managed_release "$candidate"; then
    rm -rf "$candidate"
  fi
done

echo "installed $short → $ROOT/current/bin/$binary (compatibility launcher: $ROOT/current/bin/en-croissant; $provenance)"
