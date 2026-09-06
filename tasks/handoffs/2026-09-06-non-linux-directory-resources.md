# Non-Linux support and directory-resource resolution

```text
=== PROMPT START ===
Finding: f-20260830-06, whose existing product-support park remains unchanged. The correctness lens additionally traced `resolve_windows` returning `ResolvedPath` with no file/target for an empty-component directory resource, so `engine_resource` cannot produce a usable directory lease on Windows.

Read the full finding and its prior cross-compilation evidence before work. The crate already fails to compile for configured Windows/macOS targets, and the Linux gate cannot verify a platform port. Do not add an untested one-line Windows-only return and call the feature supported.

When the recorded product-support question is resolved, include directory-resource resolution in that platform work: open and carry a checked directory descriptor/target, preserve identity and no-follow/reparse-point constraints, and test actual engine directory-option translation. Keep source resources untouched.

Proof belongs on real supported target tooling: first make the platform compile/run gates observe failures, then demonstrate empty-path and nested-directory resources, replaced roots/reparse points, and a live engine resource lease. Do not lower the Linux gates or fabricate non-Linux verification. No user decision was inferred or reversed in the ownership run.

Plan authorship and arbitration shared the root context; detection ran on the same Codex family as the code in a separate review session.
=== PROMPT END ===
```
