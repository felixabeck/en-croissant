# Product decisions

This record holds product precedent: what ChessFable is for and how it behaves.
Technical precedent lives in `tasks/decisions.md`. `/decide` writes product decisions
here per `~/.claude/skills/decide/SKILL.md` section 4.

Use one entry per decision, with the question, choice, Felix's reason in his terms,
finding ids and date.

## 2026-10-04 — One Library with linked collections

- **Question:** Should games and opening material live in one Library instead of
  separate Files and Databases pages organised by storage format?
- **Choice:** One Library, in two phases.
  - **Phase 1:** One Library sidebar entry replaces Files and Databases, with one
    searchable list of files and databases, type badges and a detail pane by item
    type. `/files` and `/databases` redirect to the Library.
  - **Phase 2:** Every collection exists exactly once. A user's own PGN file in the
    library folder is the truth. A database is either the search index of such a
    file or a standalone reference collection.
- **Felix's reason:** "in chess space this is all in one list". Users organise by
  purpose, not storage format.
- **Findings:** `f-20261001-11` (phase 1), `f-20261004-15` (phase 2, linked collections).
- **Date:** 2026-10-04.
