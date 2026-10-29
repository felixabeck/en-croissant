# ChessFable design system

ChessRiddle web is the visual source of truth. Copy executable values from
`chess-tactics-app/frontend/web/src/app/globals.css` and the implemented
`src/components/ui/` controls. Executable CSS takes precedence over ChessRiddle's
`.claude/DESIGN.md` prose. There is no shared token package or automatic sync.

`src/styles/theme.ts` is the single executable home of the copied values.
`appCssVariablesResolver` publishes `--cf-*` variables for both schemes and maps
Mantine's body, text, border and semantic variants onto them. Use these variables
instead of repeating colour values at call sites.

## Tokens and surfaces

| Tokens | Meaning |
| --- | --- |
| `background`, `foreground` | Page surface and body text |
| `card`, `card-foreground`, `popover`, `popover-foreground` | Panels and floating content |
| `surface-inset` | Nested containers inside cards |
| `interactive`, `interactive-hover`, `inset` | Pressable controls, hover and readonly overlays |
| `primary`, `primary-foreground`, `ring` | Fixed gold actions, contrasting text and focus |
| `secondary`, `secondary-foreground`, `muted`, `muted-foreground`, `accent`, `accent-foreground` | Supporting surfaces and text |
| `destructive`, `destructive-foreground`, `warning`, `warning-foreground` | Error and warning feedback |
| `border`, `border-strong`, `input` | Separators, strong separators and fields |
| `chart-1` through `chart-8` | Statistics and categorical chart colours |
| `move-correct`, `move-incorrect` | Strong correction and incorrect-move feedback |
| `eval-bar-dark`, `eval-bar-light`, `eval-bar-center` | Evaluation presentation |
| `tier-*`, `square-highlight-*`, `resize-handle` | Copied specialised reference tokens |
| `shadow-card`, `shadow-card-dark`, `shadow-elevated`, `shadow-gold` | Quiet cards, floating surfaces and primary hover |

The golden rule is to alternate surface tiers. A page uses `background` (tier 0),
its cards use `card` (tier 1), and nested groups use `surface-inset` (tier 2).
Interactive controls inside inset containers use `interactive`. In dark mode this
makes them recessed, and `interactive-hover` lifts them on hover. Cards have a
border and no default shadow. `Paper` and `Card` support `variant="inset"`.

The exact muted-foreground token stays available. Mantine's secondary text is
contrast-adjusted for readability across the three surface tiers.

## Typography and radii

Inter is the sans and heading family. JetBrains Mono is for notation, logs and
code. Self-hosted subsets cover Latin, extended Latin, Cyrillic, extended Cyrillic,
Greek and Vietnamese. System fonts provide scripts such as CJK. Merida supplies
U+2654–U+265F within both families. Font declarations and fallback metrics live in
`src/styles/fonts.css`, assets and redistribution notices in `public/fonts/`.
Every face uses swap display and loads offline under the existing CSP.

The theme defines ChessRiddle's heading, title, body and caption scale. Labels use
medium weight, headings use semibold or bold, and numeric displays use tabular
Inter figures. Preserve the compact notation and engine-line spacing.

Choose radius by actual control dimensions: xs 4px, sm 8px, md 12px, lg 16px, or
full. Checkboxes use xs, compact controls sm, small buttons md, standard inputs
and cards lg, and switches, segments and badges use full.

## Controls

| Mantine variant or control | ChessRiddle treatment |
| --- | --- |
| Button `filled` | Primary gold, contrasting text, gold hover shadow |
| Button `default`, `light` | Secondary interactive fill and quiet primary border |
| Button `subtle`, `transparent` | Ghost text and a visible hover surface |
| Button `danger` colour | Destructive feedback or action |
| Tabs | Tinted active pill in default, outline and pills variants |
| SegmentedControl | Inset pill shell, card indicator and gold ring |
| Inputs and select triggers | Inset or interactive fill, primary focus border and ring |
| Combobox, Menu, Popover | Card surface, quiet gold border, rounded selected options |
| Checkbox, Switch | Gold checked state, square checkbox and card switch thumb |
| Badge | Primary, muted or semantic tinted pill with inset ring |
| Slider, RangeSlider, Progress | Primary or explicit semantic fill |
| Accordion | Gold-tinted open header with a quiet ring |
| Tooltip, AppModal, Notification | Bordered card surface and appropriate elevation |

Focus visibility is required. Buttons, checkbox/switch, segments, and text fields
retain their distinct focus treatments. Respect reduced motion and hover capability.
Icon-only actions go through `IconAction`, dialogs through `AppModal`.

Mantine's built-in named palettes remain default except the explicitly warm `dark`
scale. New `danger`, `success`, `warning`, `info` palettes carry chrome feedback.
`warning` is distinct from the warm brown `chart-4` used by warning badges, and
info badges use `chart-1` while the info palette derives from `chart-6`.
Engine arrow hues, NAG annotation colours, drawing brushes, premove/check overlays
and existing per-board coordinate colours retain their board meaning.

## Icon identities

Phase 1 retains Tabler imports. The reviewed Phase 2 migrates them together to
ChessRiddle's pinned Lucide library. The target identities are:

| Meaning | Lucide identity |
| --- | --- |
| Appearance, board, sound, privacy | `Palette`, `ChessKnight`, `Volume2`, `Shield` |
| Settings, account, puzzles, trophy | `Settings`, `User`, `Puzzle`, `Trophy` |
| Guide, library, statistics, history | `Info`, `Library`, `ChartNoAxesCombined`, `History` |
| Engine, analysis | `Brain`, `ScanSearch` |
| First, previous, next, last move | `ChevronFirst`, `ChevronLeft`, `ChevronRight`, `ChevronLast` |
| Play, pause, delete, close | `Play`, `Pause`, `Trash2`, `X` |
| Copy, visible, hidden, search, expand | `Copy`, `Eye`, `EyeOff`, `Search`, `ChevronDown` |

Use the same artwork for meanings with a ChessRiddle counterpart. Other meanings
use the closest Lucide identity. The narrow sidebar uses monochrome icons, with
16px control icons, 20px navigation icons and stroke 2. Existing native window
control SVGs and the chessboard artwork remain.

## Board defaults and maintenance

Users without a saved board get `chessriddle.svg`, the flat ChessRiddle maple
board. Its asset and coordinate map reproduce the reference maple preset.
Existing `board-image` selections remain unchanged, all previous choices stay
available, and the piece-set default remains `staunty`. No wood texture is added.
Light, Dark and Auto keep their existing behaviour.

No hard-coded colours, no new icon library, no accent picker. Use the existing
semantic variables and shared controls. Board-functional colours are the explicit
exception above. To re-sync, compare the executable ChessRiddle CSS and control
implementations, update `theme.ts` and the relevant component modules together,
copy changed font subsets with their notices, and verify both colour schemes.
