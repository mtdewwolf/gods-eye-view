#!/usr/bin/env bash
# Regenerate the checked-in browser renderer from its pinned upstream source.
set -euo pipefail
revision=ebee968af1db616d27dce8e45ac190004b6043c4
root="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
git init -q "$tmp/source"
git -C "$tmp/source" fetch -q https://github.com/mtdewwolf/CesiumRS.git "$revision"
git -C "$tmp/source" checkout -q --detach FETCH_HEAD
cd "$tmp/source"
rustup run 1.98.1 cargo build --locked --release --target wasm32-unknown-unknown --features browser
[ "$(wasm-bindgen --version)" = 'wasm-bindgen 0.2.129' ] || { echo 'Install wasm-bindgen-cli 0.2.129' >&2; exit 1; }
mkdir "$tmp/package"
wasm-bindgen --target web --out-dir "$tmp/package" --out-name cesium_rs target/wasm32-unknown-unknown/release/cesium_rs.wasm
cp LICENSE NOTICE web/host/vendor/DOMPurify-LICENSE assets/Meshoptimizer-LICENSE.md "$tmp/package/"
rm -rf "$root/vendor/cesiumrs-browser"
mkdir -p "$root/vendor"
mv "$tmp/package" "$root/vendor/cesiumrs-browser"
