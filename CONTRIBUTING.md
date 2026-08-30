# Contributing

When it comes to open source, there are different ways you can contribute, all
of which are valuable. Here's few guidelines that should help you as you prepare
your contribution.

## Table of Contents

- [Initial Steps](#initial-steps)
- [Development](#development)
  - [Commands](#commands)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Extra Notes](#extra-notes)

## Initial Steps

Before you start working on a contribution, please check the issues page. It's possible someone else is already working on something similar, or perhaps there is a reason that feature isn't implemented. The maintainers will point you in the right direction.

> If you still have questions, please check [the Discord](https://discord.gg/tdYzfDbSSW)

## Development

The following steps will get you setup to contribute changes to this repo:

- Fork the repo
- Clone your forked repository: `git clone git@github.com:{your_username}/en-croissant.git`
- Enter the en-croissant directory: `cd en-croissant`
- Create a new branch off the `master` branch: `git checkout -b your-feature-name`
- Install dependencies `pnpm i`
- Open the code in your preferred IDE and contribute your changes

> It is recommended take a look at the [Commands](#commands) and [Extra Notes](#extra-notes) sections before starting.

### Commands

`pnpm i`

- Installs all dependencies

`pnpm dev`

- Starts the app in development mode to see changes in real time
- Merges `src-tauri/tauri.dev.conf.json`, which overrides the bundle identifier to
  `com.chessriddle.encroissant.dev`. Everything Tauri derives from the identifier moves with it:
  the app
  data directory (`db/`, `engines/`, `engine-images/`, `credentials/`, `puzzles/`), the config
  directory (`path-authority.json`), the log directory, the OS keyring service name, and — on Linux
  and Windows — the webview's storage. On Linux that means
  `~/.local/share/com.chessriddle.encroissant.dev` and
  `~/.config/com.chessriddle.encroissant.dev` instead of the installed release's
  `~/.local/share/com.chessriddle.encroissant`. A dev build may therefore run alongside an installed
  release without two processes writing the same SQLite files.
- **Only `pnpm dev` is isolated.** `pnpm tauri dev`, `cargo tauri dev` and a bare `cargo run` do not
  merge the config, so they run under the release identifier and write the installed release's data.
  A debug build that starts under a non-`.dev` identifier logs a warning saying so.
- Two things the identifier does not cover: a database folder chosen explicitly in the app's
  settings is honoured as given, and the updater still points at the production endpoint.
- Seed the dev directory by copying out of the release directory, for example
  `cp -r ~/.local/share/com.chessriddle.encroissant/{engines,images} ~/.local/share/com.chessriddle.encroissant.dev/`.
  Keyring secrets do not follow a file copy: a copied `lichess-accounts.json` lists accounts whose
  tokens live under the release's keyring service, and the first dev launch prunes them.

`pnpm test`

- Runs all tests, generating a report

`pnpm format`

- Formats the project according to the project guidelines

`pnpm lint:fix`

- Lints the project according to the project guidelines

`pnpm i18n:extract`

- Extracts all translation keys from the code and updates the translation files in [src/translation](./src/translation/)

`pnpm build`

- Builds the entire app from source. The built app can be found at [src-tauri/target/release](./src-tauri/target/release/)

## Submitting a Pull Request

- Implement your contributions (see the [Development](#development) section for more information)
- Before submitting a PR, first build the app using `pnpm build` and check every feature you've contributed to.
- Format and lint your code using `pnpm format` followed by `pnpm lint:fix`. If you added or changed any translation keys, run `pnpm i18n:extract` to update the translation files.
- Go to [the comparison page](https://github.com/franciscoBSalgueiro/en-croissant/compare) and select the branch you just pushed in the `compare:` dropdown
- Submit the new PR. The maintainers will follow up ASAP.

## Extra Notes

The app uses the Rust language for interacting with the filesystem, chess engines and databases, and React with Vite (using TypeScript, of course) for displaying the GUI.

- The Rust code can be found in [src-tauri/src](./src-tauri/src/)
- The React code can be found in [src](./src/)
