# Handoff: durable live workspace creation and closure

```text
=== PROMPT START ===
Work f-20260901-05 and f-20260906-22 through next-finding/build. Read those full entries, handled f-20260831-17, their decisions and persisted-state/async-resource rules. Trace createTab, closeWorkspaceTabAtom, workspace storage, tabStorage and tree disposal. Creation seeds before durable metadata; close deletes before durable metadata removal; the envelope adapter catches failure without returning a receipt. Design one live lifecycle commit acknowledgment and rollback contract so quota/read/write failures preserve the last recoverable game and never report undurable creation as saved. Test create/close failure, reload, current selection and native teardown behavior together. Do not undo the already-correct startup ID migration ordering. React transition protection is a separate correction completed by the originating run, not durable persistence proof.
=== PROMPT END ===
```
