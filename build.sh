#!/bin/bash
set -e

echo "🦀 Installing Rust..."
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source ~/.cargo/env

echo "📦 Installing wasm-pack..."
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

echo "🔧 Building WebAssembly module..."
cd loudness-wasm
wasm-pack build --target web --out-dir pkg
cd ..

echo "⚛️ Building React application..."
vite build

echo "📋 Copying WASM files..."
cp loudness-wasm/pkg/loudness_wasm* dist/

echo "✅ Build complete!" 