#!/usr/bin/env bash
# Serializes the heavy gate and places the runner in a confirmed agents.slice scope.
set -u

if (($# == 0)); then
  printf 'Usage: bash scripts/heavy-gate.sh <command> [arguments...].\n' >&2
  exit 2
fi

# HEAVY_GATE_TEST_* overrides keep the shell contract tests away from machine resources.
if [[ -n "${HEAVY_GATE_TEST_FLOCK:-}" ]]; then
  heavy_gate_test_flock=$HEAVY_GATE_TEST_FLOCK
  flock() {
    "$heavy_gate_test_flock" "$@"
  }
fi
systemd_run=${HEAVY_GATE_TEST_SYSTEMD_RUN:-systemd-run}
cgroup_file=${HEAVY_GATE_TEST_CGROUP_FILE:-/proc/self/cgroup}

read_cgroup_path() {
  local file=$1 hierarchy path
  [[ -r "$file" ]] || return 1
  while IFS=: read -r hierarchy _ path; do
    if [[ "$hierarchy" == "0" ]]; then
      printf '%s' "$path"
      return 0
    fi
  done < "$file"
  return 1
}

REPO_NAME=chessfable
cache_dir="$HOME/.cache/agent-kit"
lock_file="$cache_dir/heavy-gate.lock"
holder_file="$cache_dir/heavy-gate.holder"

if ! mkdir -p "$cache_dir"; then
  printf 'Cannot create heavy-gate lock directory: %s\n' "$cache_dir" >&2
  exit 1
fi
if ! exec 9>"$lock_file"; then
  printf 'Cannot open heavy-gate lock file: %s\n' "$lock_file" >&2
  exit 1
fi
if ! flock -n 9; then
  if [[ -r "$holder_file" ]]; then
    printf 'Waiting for heavy-gate lock held by: ' >&2
    if ! cat "$holder_file" >&2; then
      printf 'Cannot read heavy-gate holder file: %s\n' "$holder_file" >&2
      exit 1
    fi
  else
    printf 'Heavy-gate lock is held; holder file is unavailable: %s\n' "$holder_file" >&2
  fi
  if ! flock 9; then
    printf 'Cannot acquire heavy-gate lock: %s\n' "$lock_file" >&2
    exit 1
  fi
fi

repo="${REPO_NAME:-${PWD##*/}}"
if ! started_at=$(date --iso-8601=seconds); then
  printf 'Cannot record heavy-gate lock start time\n' >&2
  exit 1
fi
if ! printf 'repo=%s pid=%s start=%s\n' "$repo" "$$" "$started_at" > "$holder_file"; then
  printf 'Cannot write heavy-gate holder file: %s\n' "$holder_file" >&2
  exit 1
fi
printf 'Heavy-gate lock acquired: repo=%s pid=%s start=%s\n' "$repo" "$$" "$started_at"

if ! caller_cgroup=$(read_cgroup_path "$cgroup_file"); then
  printf 'Cannot read the heavy-gate caller cgroup from %s\n' "$cgroup_file" >&2
  exit 1
fi

scope_name="chessfable-gate-$$.scope"
scope_arguments=(--user --scope --quiet --slice=agents.slice --unit="$scope_name")
if [[ "$caller_cgroup" =~ /agents\.slice/([^/]+\.scope)$ ]]; then
  scope_arguments+=(-p "BindsTo=${BASH_REMATCH[1]}")
fi

if ! confirmation_file=$(mktemp "${TMPDIR:-/tmp}/chessfable-gate-scope.XXXXXX"); then
  printf 'Cannot create heavy-gate scope confirmation file\n' >&2
  exit 1
fi
trap 'rm -f "$confirmation_file"' EXIT
requested_signal=
trap 'requested_signal=SIGINT' INT
trap 'requested_signal=SIGTERM' TERM

scope_command=$(
  declare -f read_cgroup_path
  cat <<'SCOPE'
cgroup_file=$1
expected_scope=$2
confirmation_file=$3
shift 3
if ! current_cgroup=$(read_cgroup_path "$cgroup_file"); then
  printf 'Heavy gate scope not confirmed: cannot read cgroup from %s\n' "$cgroup_file" >&2
  exit 1
fi
case "$current_cgroup" in
  */agents.slice/"$expected_scope")
    if ! printf 'confirmed\n' > "$confirmation_file"; then
      printf 'Heavy gate scope not confirmed: cannot write confirmation file %s\n' "$confirmation_file" >&2
      exit 1
    fi
    printf 'Heavy gate scope confirmed: %s\n' "$expected_scope"
    ;;
  *)
    printf 'Heavy gate scope not confirmed: expected agents.slice/%s, found %s\n' "$expected_scope" "${current_cgroup:-<unavailable>}" >&2
    exit 1
    ;;
esac
exec "$@"
SCOPE
)

if [[ -n "$requested_signal" ]]; then
  if [[ "$requested_signal" == SIGINT ]]; then exit 130; else exit 143; fi
fi

"$systemd_run" "${scope_arguments[@]}" -- bash -c "$scope_command" heavy-gate \
  "$cgroup_file" "$scope_name" "$confirmation_file" "$@" &
scope_pid=$!
scope_status=0
while :; do
  wait "$scope_pid"
  scope_status=$?
  if ! kill -0 "$scope_pid" 2>/dev/null; then break; fi
done

if [[ ! -s "$confirmation_file" ]]; then
  printf 'Heavy gate scope creation or confirmation failed for %s (systemd-run exited %s).\n' \
    "$scope_name" "$scope_status" >&2
  if (( scope_status != 0 )); then exit "$scope_status"; fi
  exit 1
fi

if [[ "$requested_signal" == SIGINT ]]; then exit 130; fi
if [[ "$requested_signal" == SIGTERM ]]; then exit 143; fi
exit "$scope_status"
