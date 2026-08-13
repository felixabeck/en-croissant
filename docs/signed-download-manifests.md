# Signed download manifests

The `/engines`, `/databases`, and `/puzzle_databases` production manifests are security boundaries. Every downloadable entry must contain:

- `sha256`: exactly 64 hexadecimal characters for the downloaded bytes.
- `signature`: a Minisign signature created by the release key whose public key is configured for the updater and compiled into `src-tauri/src/fs.rs`.

The signed payload is the UTF-8 byte sequence below, with no trailing newline:

```text
${downloadLink}\n${sha256.toLowerCase()}
```

The URL must match `downloadLink` byte-for-byte, including escaping and redirects chosen by the manifest publisher. The application validates the manifest schema before showing an entry, verifies the Minisign signature before starting the transfer, streams the payload through SHA-256, and commits it only when the downloaded digest matches.

Existing manifest fields remain required by their consumers. In addition to `sha256` and `signature`:

- Engines require `type: "local"`, `name`, `version`, `path`, `downloadLink`, `os`, and `bmi2`.
- Databases require `title`, `player_count`, `game_count`, `storage_size`, and `downloadLink`; `description` is optional and defaults to an empty string.
- Puzzle databases require `title`, `description`, `puzzleCount`, `storageSize`, and `downloadLink`.

Release automation must calculate the digest from the final hosted artifact, construct the exact payload, sign it with the protected release private key, JSON-escape the complete Minisign signature, and publish the manifest only after the artifact is immutable and reachable. The private key must never enter this repository or CI logs. A release is not complete until all three public endpoints pass their schema and signature checks; unsigned legacy entries are deliberately rejected rather than downloaded.
