# Descriptor-backed app-data bootstrap

```text
=== PROMPT START ===
Finding: f-20260905-10. Reconfirmed by the Luna tauri-security lens in the path-registry ownership run; deferred as the existing separate producer design, not ignored as pre-existing.

Read the project workflow and domain rules, the complete finding, and decisions d-20260905-02/-07 before planning. `ensure_app_owned_default_dir` still creates fixed leaves through pathname `create_dir_all`; an ancestor symlink can redirect creation before the later verified open. The closed leaf enum and descriptor-backed consumers do not solve bootstrap of `AppDataDir` itself.

Use next-finding/build to settle a descriptor-backed AppDataDir producer and checked component creation. Preserve create-if-missing only for the backend-owned closed leaf enum, no arbitrary-path constructor or blanket capability widening. Treat resource-root open-only semantics separately. Record any technical decision under the decision ledger contract; do not rewrite earlier attributions.

Proof must deterministically swap ancestors before materialization and assert no outside directory/file is created, while ordinary first use and existing app-data roots still work. Include creation/error/identity and relevant startup/shutdown tests, full affected gates and actual-app verification. This is not a request to add a watcher or background helper.

The completed ownership changes rely on the existing bootstrap producer but do not claim to close this pre-existing window. Plan authorship and arbitration shared the root context; detection ran on the same Codex family as the code in a separate review session.
=== PROMPT END ===
```
