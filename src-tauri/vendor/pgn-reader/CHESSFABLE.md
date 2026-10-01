# ChessFable patch to pgn-reader

Upstream: pgn-reader 0.26.0, from the Cargo registry. The complete crate is
retained, including COPYING, Cargo.toml, Cargo.toml.orig, Cargo.lock, README.md,
rustfmt.toml, src/, docs/, examples/, and upstream metadata.

The parser patch is in src/reader.rs. Comments and headers that
outgrow the buffered window shift their retained bytes, double the buffer when
full, and read more before searching again. Header escapes crossing a read
boundary retain their meaning. The initial header delimiter and comment delimiter
scans share one private bounded-search helper. The existing InvalidData recovery remains for
EOF and tokens over the cap, including terminated tokens. The buffer remains
grown until the reader is dropped.

MAX_TOKEN_BYTES is 10 MiB, matching ChessFable's per-game MAX_PGN_BYTES without
coupling this crate to the application. Comments count their content bytes;
headers count the retained line from after `[` through the value, excluding
the terminating quote. One extra buffered byte permits recognizing a closing
delimiter at the cap. The private buffer uses Vec::reserve_exact before resize,
because circular::Buffer::grow's amortized reservation can exceed the cap. Each
growth requests min(2 × capacity, 10 MiB + 1); shifting and consumption preserve
the upstream buffer semantics. The app's allocation regression allows a fixed
64 KiB margin above the token cap and parses a 40 MiB fixture. The measured Rust
heap peak is 10,486,953 bytes (10 MiB plus 1,193 bytes).

The unpatched upstream version uses a fixed 16 KiB buffer and rejects a real
26,158-byte annotation in Mega Database 2025. Version 0.27 is reported to have
a stricter comment limit; that report is unverified and is not needed for this
patch. A future upstream upgrade must re-apply or demonstrate replacement of
this patch and pass the application's long_token_ regressions.

Gate scope: cargo fmt formats the app package only (no --all); backend LCOV
exports only src-tauri/src/**/*.rs and ratchets that same scope; cargo-mutants
selects explicit application source files; rust:surface:check scans only
src-tauri/src and permits only the exact reviewed pgn-reader patch entry in the
app manifest. Clippy and Windows clippy build this dependency through Cargo;
third-party diagnostics are excluded by `#![allow(warnings, clippy::all)]` in
src/lib.rs, keeping upstream code outside the application's lint ratchet.
All other upstream bytes are unchanged.
