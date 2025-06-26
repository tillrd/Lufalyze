#!/bin/bash
set -e

echo "📋 Generating build information..."
export VITE_VERSION=$(node -p "require('./package.json').version")
export VITE_BUILD_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
export VITE_BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
export VITE_BUILD_NUMBER=${BUILD_ID:-$(date +%s)}

echo "Version: $VITE_VERSION"
echo "Build Hash: $VITE_BUILD_HASH"
echo "Build Date: $VITE_BUILD_DATE"
echo "Build Number: $VITE_BUILD_NUMBER"

echo "🦀 Installing Rust..."
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source ~/.cargo/env

echo "📦 Installing wasm-pack..."
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

echo "🎨 Generating PWA icons..."
node scripts/generate-icons.cjs

echo "🔧 Building WebAssembly module..."
cd loudness-wasm
wasm-pack build --target web --out-dir pkg
cd ..

echo "⚛️ Building React application with version info..."
npx vite build

echo "📋 Copying WASM files..."
cp loudness-wasm/pkg/loudness_wasm* dist/

echo "✅ Build complete!"
echo "Final version info written to build" 