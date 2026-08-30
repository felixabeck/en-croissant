# `build` run ledger

One line per `build` run in this repository. Everything else about a run can be reconstructed
afterwards from the transcripts (`~/.claude/scripts/agent-usage.py`) or from git. This file exists
for the one thing that cannot: **whether plan review caught defects earlier than the diff review
did.** If findings migrate from the "final" column to the "plan" column over time, the plan-review
stage is paying for itself; if they do not, it is ceremony.

Duration per phase is a measurement, not a limit. It has no ceiling on purpose — a time limit would
be a second split axis beside area cohesion and would invite splitting a coherent area because it
looks slow, against universal rule 4a.

| Date | Task | Phases | Model / effort per phase | Duration per phase | Fix rounds | Plan findings | Final findings | Gates | Note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-30 | `remove-tree-unhardened` cluster: f-20260830-02/-03/-04/-05, the recursive workspace delete | 2 | 1: `sol`/`medium` (sensitive path `src-tauri/src/infra/**`) · 2: `luna`/`xhigh` | 1: ~9 min · 2: ~8 min | 2 (one per phase, both after the diff review) | **2 rounds, 7 lenses each: 7 REVISE, then 6 REVISE + 1 APPROVED.** Round 2's findings were largely new rather than repeats. 4 reversed a design decision, 2 exposed tests that pinned nothing, 3 became filed findings. | 6 lenses, 6 REVISE: 3 blockers on one defect (the delete stayed fallible after it had destroyed data), 2 blockers on tests proving the seam instead of the shipped code, 1 on a wrong category name. All fixed. | fmt, check, clippy, test (317), coverage:backend + ratchet, lint:ci, both boundary checks, bindings:check, coverage:report:test, bundle:report:test, test:coverage (266), coverage:frontend:check, build-vite, bundle:check, findings check, container e2e 8/8 — all green | Plan review earned its keep twice over: `st_dev` alone was wrong for same-filesystem bind mounts, and the `openat2` option named in the findings would not have closed the primary one. Both were caught before any code existed. The diff review then caught what the plan could not: the *tests* looked thorough and pinned nothing — the mount test forced the detector's answer, so deleting the whole detector left it green. Three revert experiments were run by hand rather than trusting the leaf's claims, and one of them disproved a claim. |
