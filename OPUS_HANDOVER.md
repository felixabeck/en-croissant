# OPUS_HANDOVER: Architecture and Navigation Map

This document serves as a technical navigation map for the `en-croissant` project, detailing the architecture, state management, Tauri command structure, and frontend-backend integration. It is specifically designed to help AI agents (like OPUS) quickly understand and navigate the codebase.

## 1. Overview
The project is built using the **Tauri** framework, combining a **Rust** backend (`src-tauri`) with a **React** (TypeScript) frontend (`src`). Communication between the frontend and backend is handled via Tauri commands and events, which are strongly typed using `tauri-specta`.

---

## 2. State Management (Rust Backend)
State in the Rust backend is centrally managed and thread-safe.

### Primary State Object: `AppState`
- **Location:** `src-tauri/src/main.rs` (lines 76-96)
- **Registration:** In `main.rs`, the state is registered during the Tauri app initialization via `.manage(AppState::default())`.
- **Key Components of `AppState`:**
  - `connection_pool`: A `DashMap` holding Diesel `r2d2` SQLite connection pools.
  - `engine_processes`: A `DashMap` managing running chess engine processes (`EngineProcess`).
  - `analysis_cancel_flags`: A `DashMap` of `AtomicBool` flags to cancel running analyses.
  - `game_manager`: An instance of `GameManager` handling active game states.
  - `progress_state`: An instance of `ProgressStore` tracking background task progress.
  - `auth`: An instance of `AuthState` handling OAuth flow states.
  - Various caches (`line_cache`, `db_cache`, `search_collisions`, `pgn_offsets`) primarily using `DashMap` for concurrent access.

### Auxiliary State
- **`SoundServerPort`**: Registered separately in `main.rs` (`app.manage(sound::SoundServerPort(port));`) specifically for managing the local sound server port (primarily on Linux).

---

## 3. Tauri Commands and Events Structure

Commands are defined in Rust and exposed to the frontend.

### Definition of Commands
Commands are standard Rust functions annotated with `#[tauri::command]` and `#[specta::specta]`. They are distributed across domain-specific modules in `src-tauri/src/`:
- **`chess.rs`**: Engine analysis, finding best moves, killing engines.
- **`db/mod.rs` & `db/search.rs`**: Database interactions (games, players, tournaments, indexes).
- **`game.rs`**: Managing active game lifecycle (`start_game`, `make_game_move`, `resign_game`, etc.).
- **`pgn.rs` & `lexer.rs`**: Parsing and managing PGN files.
- **`fs.rs`**: File system utilities (downloading files, metadata).
- **`main.rs`**: App-level commands like `memory_size` and `is_bmi2_compatible`.

### Registration and TypeScript Binding Generation
- **Location:** `src-tauri/src/main.rs` (lines 110-180)
- Commands and Events are collected using `tauri_specta::collect_commands!` and `tauri_specta::collect_events!`.
- **Output:** When compiled in debug mode, Specta automatically generates the TypeScript bindings at `src/bindings/generated.ts`.

---

## 4. Frontend Integration (React calling Rust)

The frontend interacts with the Rust backend exclusively through the generated bindings, ensuring end-to-end type safety.

### The Bindings File
- **Location:** `src/bindings/generated.ts`
- **Exports:**
  - `commands`: An object containing async wrapper functions for all Tauri commands (e.g., `commands.getBestMoves()`).
  - `events`: An object containing typed event listeners (e.g., `events.gameMoveEvent.listen()`).

### Key React Components utilizing Commands & Events
The React components import the `commands` and `events` objects from `src/bindings/generated.ts` to trigger backend actions and listen for updates.

**Active Game Management:**
- **Location:** `src/components/boards/BoardGame.tsx`
- **Commands used:** `commands.startGame`, `commands.makeGameMove`, `commands.takeBackGameMove`, `commands.abortGame`, `commands.resignGame`, `commands.getGameState`, `commands.getGameEngineLogs`.
- **Events listened to:** `events.gameMoveEvent`, `events.clockUpdateEvent`, `events.gameOverEvent`.

**Database and PGN Management:**
- **Locations:** `src/components/databases/DatabasesPage.tsx`, `src/components/databases/AddDatabase.tsx`
- **Commands used:** `commands.clearGames`, `commands.convertPgn`, `commands.exportToPgn`, `commands.deleteDatabase`, `commands.mergePlayers`, `commands.createIndexes`, `commands.deleteIndexes`.

**Engine Evaluation and Analysis:**
- **Locations:** `src/components/boards/EvalListener.tsx`, `src/components/panels/analysis/ReportPanel.tsx`, `src/components/engines/EnginesPage.tsx`
- **Commands used:** `commands.getEngineConfig`, `commands.cancelAnalysis`.
- **Events listened to:** `events.bestMovesPayload` (updates the evaluation bar).

**Progress & Background Tasks:**
- **Locations:** `src/hooks/useProgress.ts`, `src/components/home/AccountCard.tsx`
- **Events listened to:** `events.progressEvent` to update UI loading states.
