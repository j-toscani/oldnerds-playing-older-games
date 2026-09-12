# @onog/replay-parser

Rust crate wrapping [`s2protocol`](https://github.com/j-toscani/s2protocol-rs)
(a fork of `sebosp/s2protocol-rs`), compiled to a pre-built WASM artifact
checked into `pkg/`. Exports a single `parse(bytes: Uint8Array)` function
returning a `ParsedReplay` object (the parser's contribution to `ReplayData`
from `@onog/shared`).

Consumers (the website) use `pkg/` like a finished dependency — no Rust
toolchain required. Only rebuild this package if you change `src/lib.rs` or
bump the `s2protocol` dependency.

## Why a fork instead of the crates.io release

`s2protocol` v3.5.6 as published cannot be compiled for `wasm32-unknown-unknown`:
its `include_assets` dependency (used only to embed a 53 MB BalanceData asset
archive we don't need) pulls in `zstd-sys`, a C library Apple's system `clang`
cannot assemble for wasm32. The fork
([`j-toscani/s2protocol-rs`](https://github.com/j-toscani/s2protocol-rs),
branch `feat/optional-included-assets`) makes that dependency an opt-out
feature instead of deleting anything — default behavior for other consumers
is unchanged, and the patch remains upstream-PR-able. See
`docs/features/replay-library-local.md` (§ "Entscheidungen nach dem Spike")
for the full rationale.

We depend on it via a `rev`-pinned git dependency (not a submodule — this is
a dependency, not part of our source tree) with `default-features = false`,
plus the checked-in `Cargo.lock` for the exact resolved tree.

## Rebuilding

Requirements: a `rustup`-managed Rust toolchain with the `wasm32-unknown-unknown`
target, and `wasm-pack`.

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
```

### Toolchain pitfall 1: a second (e.g. Homebrew) Rust install shadows rustup

If another Rust install is also on `PATH` ahead of the rustup shim (on this
project's dev machine it was an **Intel Homebrew `rust` formula running under
Rosetta**, `/usr/local/bin/cargo`/`rustc` before `~/.cargo/bin`), Cargo
resolves `rustc` from `PATH` too — and a distro/Homebrew Rust typically has no
`wasm32` standard library. The build then fails with
`error[E0463]: can't find crate for 'core'`, even though
`rustup target list --installed` shows the target as installed.
Fix: remove the other install (`brew uninstall rust`) so only `rustup`
provides `cargo`/`rustc`, or as a one-off, pin explicitly:

```bash
TC=~/.rustup/toolchains/stable-aarch64-apple-darwin/bin
RUSTC=$TC/rustc PATH="$TC:$PATH" cargo build --release --target wasm32-unknown-unknown --no-default-features
```

### Toolchain pitfall 2: `rust-lld` can't find `libLLVM.dylib`

On some rustup installs, `rust-lld` (and `rust-objcopy`) are linked against
`@rpath/libLLVM.dylib`, but their rpath (`@loader_path/../lib`) points one
directory short of where the toolchain actually ships the file
(`<toolchain>/lib/libLLVM.dylib`, not
`<toolchain>/lib/rustlib/<target>/lib/libLLVM.dylib`). Linking then aborts
with `dyld: Library not loaded: @rpath/libLLVM.dylib`. Two ways to fix it,
neither touches anything outside the rustup install:

```bash
# Once, permanently (until the next `rustup update` re-links the toolchain):
ln -sf ../../../libLLVM.dylib \
  ~/.rustup/toolchains/stable-aarch64-apple-darwin/lib/rustlib/aarch64-apple-darwin/lib/libLLVM.dylib

# Or per invocation, e.g. in CI:
DYLD_FALLBACK_LIBRARY_PATH=~/.rustup/toolchains/stable-aarch64-apple-darwin/lib
```

### Full rebuild command

With both pitfalls fixed (no second Rust install, `libLLVM.dylib` symlinked),
plain `cargo`/`wasm-pack` from `PATH` work:

```bash
wasm-pack build --release --target web --out-dir pkg -- --no-default-features
```

`wasm-opt` is disabled (`[package.metadata.wasm-pack.profile.release]` in
`Cargo.toml`) — wasm-pack's bundled version doesn't yet support the
bulk-memory ops current Rust emits for `wasm32` by default. Costs a few KB,
not correctness; current artifact is 236 KB / well under the ~800 KB
reference from the #58 spike.

Update `pkg/BUILD_INFO.json` afterwards (`s2protocolRev`, `parserVersion`,
`rustcVersion`, `wasmPackVersion`, `buildDate`, `wasmSha256` — the SHA-256 of
`pkg/replay_parser_bg.wasm`). It records provenance without requiring anyone
to rebuild in order to verify it. There is deliberately no CI check for
byte-identical output — Rust/WASM builds aren't reproducible across machines
or compiler versions; CI instead rebuilds and runs the tests below.

## Tests

```bash
cargo test --lib
```

Native (non-wasm) unit tests covering only our own wrapper logic — signature
validation, name unescaping, control-code labels, FILETIME conversion, winner
derivation. We do not test `s2protocol`'s own parsing correctness; that's its
job, not ours. `tests/fixtures/Burrow.SC2Replay` (MIT-licensed, from the fork)
is used as a real, non-synthetic input for the end-to-end smoke test.
