# 🎚️ Lufalyze

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
[![Netlify Status](https://api.netlify.com/api/v1/badges/your-badge-id/deploy-status)](https://app.netlify.com/sites/lufalyze/deploys)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-000000?style=flat&logo=rust&logoColor=white)](https://www.rust-lang.org/)

A modern, browser-based loudness analyzer implementing the EBU R 128 / ITU-R BS.1770-4 specification. Process audio files directly in your browser with WebAssembly-powered analysis.

[Live Demo](https://lufalyze.com) • [Documentation](https://github.com/tillrd/Lufalyze/wiki) • [Report Bug](https://github.com/tillrd/Lufalyze/issues)

![Lufalyze Screenshot](./docs/screenshot.png)

</div>

## ✨ Features

- 🎯 **Standards Compliant**: Full ITU-R BS.1770-4 implementation
- 🔒 **Privacy First**: All processing happens locally - no uploads
- 📊 **Multiple Metrics**: 
  - Integrated Loudness (LUFS)
  - Momentary Max
  - Short Term Max
  - RMS Level
- 🎧 **Platform Targets**: Compare against:
  - Spotify (-14 LUFS)
  - Apple Music (-16 LUFS)
  - YouTube (-14 LUFS)
  - Netflix (-27 LUFS)
- 🌓 **Modern UI**: Responsive design with dark/light mode
- 📱 **Progressive Web App**: Install and use offline
- ⚡ **WebAssembly Performance**: Fast processing with Rust

## 🛠️ Technical Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **Audio Processing**: Web Audio API + WebAssembly (Rust)
- **File Decoding**: music-metadata for WAV support
- **Worker Processing**: Web Workers for non-blocking UI
- **Build System**: Vite + wasm-pack

## 🎛️ How It Works

### ITU-R BS.1770-4 Algorithm Implementation

1. **Pre-filtering (K-weighting)**
   ```rust
   // K-weighting filter coefficients
   const K_WEIGHTING: [f32; 3] = [1.0, -1.69065929318241, 0.73248077421585];
   const K_WEIGHTING_DENOM: [f32; 3] = [1.0, -2.0, 1.0];
   ```
   - Applies K-weighting filter to match human perception
   - Pre-emphasis filter for high frequencies
   - Shelf filter for low frequencies

2. **Channel Weighting**
   ```rust
   // Channel weights per ITU-R BS.1770-4
   const CHANNEL_WEIGHTS: [f32; 5] = [1.0, 1.0, 1.0, 1.41, 1.41]; // L, R, C, Ls, Rs
   ```
   - Applies weights to each channel
   - Center and surround channels weighted higher
   - Sums weighted channels for total energy

3. **Mean Square Calculation**
   ```rust
   // Mean square calculation
   let mean_square = samples.iter()
       .map(|&x| x * x)
       .sum::<f32>() / samples.len() as f32;
   ```
   - Squares each sample
   - Averages over the measurement period
   - Handles both momentary and integrated measurements

4. **Gating Algorithm**
   ```rust
   // Gating threshold calculation
   let gate_threshold = -70.0 + 10.0 * (mean_square.log10());
   ```
   - Removes silent passages
   - Uses relative threshold
   - Improves measurement accuracy

5. **Loudness Calculation**
   ```rust
   // Final loudness calculation
   let loudness = -0.691 + 10.0 * (gated_mean_square.log10());
   ```
   - Converts to LUFS scale
   - Applies calibration offset
   - Produces final measurement

### Processing Pipeline

1. **File Input**
   - WAV file loading
   - Sample rate conversion
   - Channel management

2. **Block Processing**
   - 400ms blocks for momentary
   - 3s blocks for short-term
   - Full file for integrated

3. **Measurement Types**
   - Momentary: 400ms window
   - Short-term: 3s window
   - Integrated: Full program

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Rust toolchain with wasm-pack
- npm or yarn

### Quick Start

```bash
# Clone and setup
git clone https://github.com/tillrd/Lufalyze.git
cd Lufalyze
npm install

# Build WASM module
npm run build:wasm

# Start development
npm run dev
```

### Building for Production

```bash
# Build everything
npm run build

# Preview production build
npm run preview
```

## 🌐 Browser Support

- Chrome 67+ (SharedArrayBuffer required)
- Firefox 79+
- Safari 15.2+
- Edge 79+

## 📊 Performance

- 3-minute stereo file: ~500ms
- Real-time factor: ~360x (44.1kHz)
- Memory usage: ~50MB typical

## 🔒 Privacy & Security

- **Privacy-first**: All processing local
- **No data collection**: Files stay on device
- **No tracking**: No analytics or cookies
- **CSP**: Strict Content Security Policy
- **HTTPS**: Required for SharedArrayBuffer

[Privacy Policy](PRIVACY.md) • [Security Policy](SECURITY.md)

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 🤝 Contributing

We welcome contributions! See our [Contributing Guidelines](CONTRIBUTING.md) for:
- Development setup
- Code standards
- PR process
- Bug reporting

## 🗺️ Roadmap

- [ ] Additional audio formats (MP3, FLAC)
- [ ] True Peak measurement
- [ ] Loudness Range (LRA)
- [ ] Batch processing
- [ ] Real-time monitoring
- [ ] Export capabilities

---

<div align="center">

**Built with ❤️ for audio engineers and enthusiasts**

*Lufalyze: Making loudness analysis accessible to everyone*

</div> 