# Handoff: multi-file import outcomes and index invalidation

```text
=== PROMPT START ===
Work the existing import outcome design through next-finding/build: f-20260831-07, f-20260903-04 and f-20260904-03. Read their full entries and surfaced decisions, then trace db/mod.rs import loop and its index invalidation consumers. Final Luna PGN/index review of the path-ownership run reconfirmed one transaction per file at db/mod.rs:614, so a later file failure leaves earlier committed games. Resolve the import transaction/outcome and invalidation contract together; test a good-good-corrupt multi-file input, truncated streams, reported landed progress and retry behavior. This is a separate design, not a reason to change attachment registry ownership. Do not repeat the same lens's rejected pawn_home finding: san advances the mainline root frame, begin_variation pushes a distinct child, and end_variation restores the still-advanced root frame. Follow project rules and full affected gates.
=== PROMPT END ===
```
