# Contributing to Ollie

Thanks for wanting to contribute. This is a spare-time, single-maintainer
project, so keeping changes small and focused makes them much faster to
review.

## Getting set up

Ollie is a Tauri v2 (Rust) + React 19 (TypeScript) desktop app.

```bash
# Full dev environment (Tauri launches Vite automatically)
cargo tauri dev
```

You'll need the usual Tauri Linux dependencies — see
`scripts/install-tauri-deps-ubuntu.sh` for the Ubuntu package list.

## Before opening a PR

Run whichever of these apply to your change:

```bash
# Frontend (from app/)
npm run lint       # ESLint
npm run build      # tsc + vite build

# Backend (Rust, from src-tauri/)
cargo check        # type-check
cargo clippy        # lints
cargo test          # tests
```

CI runs these too, but catching issues locally first saves a round trip.

## Code conventions

See [CLAUDE.md](CLAUDE.md) for the architecture overview and established
patterns (IPC command layout, provider abstraction, streaming pipeline,
state management, etc.). Follow existing patterns in the file you're editing
rather than introducing a new one.

## Making changes

* Keep PRs focused — one fix or feature per PR is much easier to review than
  a bundle of unrelated changes.
* Match the existing code style; don't reformat files you're not otherwise
  touching.
* If you're adding a new LLM provider, see the "Adding a New Provider"
  section in CLAUDE.md for the exact steps.
* For UI changes, actually run the app and try the feature — type-checking
  isn't a substitute for clicking through it.

## Opening a PR

* Describe what changed and why, not just what
* Link the issue it fixes, if any
* Note anything you couldn't test (e.g. a provider you don't have API access
  to, or a Linux distro/compositor you don't run)

## Reporting bugs

Use the issue templates — for crashes, especially startup crashes, the OS/
distro, session type (X11 vs Wayland), and GPU/driver info make a real
difference in diagnosing them.

Security vulnerabilities should **not** go through public issues — see
[SECURITY.md](SECURITY.md).
