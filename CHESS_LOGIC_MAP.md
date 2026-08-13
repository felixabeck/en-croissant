# Chess Logic Map: En Croissant 🥐

Dieses Dokument analysiert die Architektur des En Croissant-Projekts mit Fokus auf die Anbindung von Schachengines, die Datenbankhaltung von Partien, die asynchrone Prozessierung, das Frontend-Streaming und zeigt potenzielle Flaschenhälse der aktuellen Implementierung auf.

## 1. Engine-Anbindung und UCI-Protokoll

Die Engine-Kommunikation ist in `src-tauri/src/engine/process.rs` implementiert.

**Wichtige Structs:**

- `BaseEngine`: Kapselt den Systemprozess der Engine sowie die Streams für Standardein- und -ausgabe (`stdin`, `stdout`).

**Ablauf der Anbindung:**

1. **Prozessstart**: Über `tokio::process::Command` wird die Engine als asynchroner Subprozess gestartet. Die Kanäle für `stdin`, `stdout` und `stderr` werden über `Stdio::piped()` umgeleitet.
2. **Initialisierung**: Die Methode `init_uci()` sendet die Strings `"uci"` und `"isready"` in den `stdin` der Engine und blockiert asynchron (`wait_for`), bis die Engine mit `"uciok"` und `"readyok"` antwortet.
3. **Konfiguration**: Engine-Optionen werden über die Methode `set_option` gesendet (z.B. für UCI_Chess960 oder Threads).
4. **Spielablauf**: Positionen werden über `set_position` als FEN und nachfolgende Züge (`moves`) an die Engine übergeben. Der Befehl zum Suchen wird durch `go` initiiert, wobei Parameter über das Struct `GoMode` (z.B. Zeit, Tiefe, Infinite) übergeben werden.

## 2. Asynchrone Prozesse für Engine-Ausgaben

Da Engines ihre Berechnungen asynchron im Hintergrund durchführen und ständig Output generieren (z.B. Suchtiefe, Evaluationswerte), wird asynchrones I/O via `tokio` genutzt.

- **Lesen von `stderr`**: Direkt nach dem Start der Engine wird ein separater `tokio::spawn` Task gestartet, der kontinuierlich `stderr` zeilenweise ausliest (`AsyncBufReadExt::next_line`) und Fehler via `log::error!` protokolliert, ohne den Hauptthread zu blockieren.
- **Lesen von `stdout`**: Der Standard-Output wird über `Lines<BufReader<ChildStdout>>` gelesen. Methoden wie `wait_for` oder `wait_for_bestmove` iterieren asynchron über eingehende Zeilen (`reader.next_line().await`).
- **Parsing**: Jede gelesene Zeile wird durch das Crate `vampirc_uci::parse_one` in die `UciMessage` Enum geparst, um auf `BestMove` Nachrichten zu reagieren.
- **Loghaltung**: Alle ausgehenden und eingehenden Kommunikationen werden sofort als `EngineLog::Gui(String)` oder `EngineLog::Engine(String)` in einem Vektor (`self.logs: Vec<EngineLog>`) gespeichert.

## 3. Datenhaltung in der Datenbank

Das Projekt verwendet SQLite in Verbindung mit dem `diesel` ORM für die strukturierte Ablage der Schachpartien (`src-tauri/src/db/models.rs` und `schema.rs`).

**Wichtige Structs:**

- `Game` (Queryable) / `NewGame` (Insertable): Repräsentieren eine Schachpartie.
- Assoziierte Structs: `Player`, `Site`, `Event`.

**Schema und Speicherung:**

- **Metadaten**: Spieler-IDs (`white_id`, `black_id`), Event (`event_id`), Datum, Zeitkontrolle, Resultat (`Outcome`-Enum als Text wie "1-0", "0-1") und ECO-Code.
- **Spielzustand**:
  - `fen`: Speichert optional die Start-FEN, falls es keine Standard-Ausgangsstellung ist.
  - `moves`: Die Züge werden als `Vec<u8>` (Binary Blob) gespeichert. Dies spart Speicherplatz gegenüber Klartext-PGN und wird beim Abfragen dekodiert.
  - Weitere Felder wie `ply_count` (Anzahl der Halbzüge) und `pawn_home`.

## 4. Streaming an das Frontend

Die Brücke zum Frontend (React/TypeScript) wird durch Tauri Commands und Events realisiert, welche mit dem `specta` und `tauri-specta` Crate getypt sind, um Typsicherheit zu gewährleisten (`src-tauri/src/game.rs` und `main.rs`).

**Status- und Event-Structs:**

- `GameState`: Der volle Status einer Partie (ID, FEN, Züge, Uhren, Spieler).
- `GameMoveEvent`: Informiert das Frontend über einen getätigten Zug (enthält die Zughistorie, aktuelle FEN, Uhren).
- `ClockUpdateEvent`: Teilt dem Frontend geänderte Zeiten auf der Schachuhr mit.
- `GameOverEvent`: Wird ausgelöst, wenn die Partie durch Matt, Remis oder Zeitüberschreitung beendet wurde (`GameResult`).

**Ablauf**:
Bei Aktionen wie `make_move` oder im Game-Loop (`game.rs`) ruft das Backend `event.emit(app)` auf. Tauri serialisiert das Struct nach JSON und schiebt es über den IPC-Kanal (Inter-Process Communication) an den WebView. Das Frontend subscribt auf diese Events und aktualisiert die UI reaktiv.

## 5. Potenzielle Flaschenhälse (Bottlenecks)

1. **Unbegrenztes Engine-Log-Wachstum**:
   Die `BaseEngine` pusht _jede_ Zeile Output (und Input) in `self.logs: Vec<EngineLog>`. Bei tiefen Engine-Analysen (z.B. Multi-Threaded Stockfish mit `go infinite`) werden tausende Zeilen pro Sekunde generiert. Dies führt über Zeit zu massiver Speicherfragmentierung und hohem RAM-Verbrauch, da der Vektor niemals geleert oder limitiert wird.

2. **Zustandserkennung per FEN-String Hashing**:
   Im `GameController` wird die Erkennung der dreifachen Stellungswiederholung implementiert, indem ein Teil des FEN-Strings (ohne Zugzähler) als Key für eine `HashMap<String, u32>` genutzt wird. Bei jedem Zug eine FEN zu generieren und Strings zu hashen ist im Vergleich zu einem Zobrist-Hash sehr ineffizient.

3. **Blockierende Asynchrone Reads in der Engine**:
   Methoden wie `wait_for_bestmove` blockieren den aktuellen Task, bis die Engine antwortet. Es gibt hier keinen systemseitigen Timeout (z.B. über `tokio::time::timeout`). Hängt sich die Engine auf, wartet dieser Task für immer (`NextLine` blockiert).

4. **Moves in der DB als `Vec<u8>` ohne nativen Index**:
   Züge werden als Binärdaten abgelegt. Möchte man die Datenbank nach Partien durchsuchen, die eine bestimmte Zugabfolge enthalten (z.B. Eröffnungssuche), kann SQLite dies nicht über Standard-Indizes abbilden. Das Backend muss Partien auslesen, dekodieren und matchen, oder es wird ein separater Suchindex (hier `MmapSearchIndex`) benötigt, was zusätzlichen Synchronisierungsaufwand und RAM bedeutet.

5. **Hoher IPC-Traffic (Frontend-Streaming)**:
   Das Senden ganzer Zughistorien (`moves: Vec<GameMove>`) im `GameMoveEvent` bei _jedem_ Zug skaliert schlecht für sehr lange Partien, da die JSON-Payload stetig wächst. Uhren-Updates via Tauri-Events können zudem den IPC-Kanal verstopfen, wenn sie nicht gedrosselt (debounced/throttled) werden.
