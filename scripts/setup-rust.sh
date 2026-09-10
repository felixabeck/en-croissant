#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f rust-toolchain.toml ]]; then
  echo "Rust setup refused: rust-toolchain.toml is missing from the repository root." >&2
  exit 1
fi

rustup toolchain install --no-self-update
rustup show active-toolchain
