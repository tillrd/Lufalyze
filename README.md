# Lufalyze

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/tillrd/Lufalyze/pulls)
[![Netlify Status](https://api.netlify.com/api/v1/badges/0ac3ebeb-2efc-4914-8a69-b0196ed08e87/deploy-status)](https://app.netlify.com/projects/lufalyze/deploys)
[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4%EF%B8%8F-red)](https://github.com/sponsors/tillrd)

### Navigation
<a href="https://lufalyze.com">📊 Try Demo</a> • <a href="docs/TECHNICAL.md">🔬 Technical Docs</a> • <a href="#platform-targets">🎯 Platform Targets</a> • <a href="#getting-started">🚀 Getting Started</a>

## Overview

**Lufalyze** is a professional web-based audio analysis platform that implements **ITU-R BS.1770-4** and **EBU R 128** standards for precise loudness measurement. Analyze audio directly in your browser with **WebAssembly performance** and **complete privacy**.

### ✨ Key Features

- **🎯 Professional Loudness Analysis** - ITU-R BS.1770-4 / EBU R 128 compliance with ±0.1 LU accuracy
- **🔍 Technical Quality Assessment** - True peak detection, clipping analysis, DC offset detection, and spectral analysis
- **📊 PDF Reports** - Professional analysis reports with platform target comparisons
- **🎚️ Platform Targets** - Pre-configured targets for Spotify, YouTube, Apple Music, Netflix, and more
- **🔒 Privacy-Focused** - All processing happens locally in your browser
- **⚡ High Performance** - WebAssembly-powered analysis with 50x real-time speed
- **⌨️ Keyboard Shortcuts** - Full keyboard navigation (press **H** for help)
- **♿ Accessibility** - Screen reader support and ARIA compliance
- **🌙 Dark Mode** - Comfortable viewing in any lighting condition

## Quick Start

### 📱 **Web App (Recommended)**
1. Visit **[lufalyze.com](https://lufalyze.com)**
2. Upload your audio file (WAV, MP3, FLAC, AAC, OGG, M4A)
3. View instant analysis results
4. Export professional PDF reports (press **E**)

### 💻 **Local Development**
```bash
# Clone and install
git clone https://github.com/tillrd/Lufalyze.git
cd Lufalyze
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Platform Targets

| Platform | Target (LUFS) | Tolerance |
|----------|---------------|-----------|
| **Spotify** | -14.0 | ±1.0 |
| **YouTube** | -14.0 | ±1.0 |
| **Apple Music** | -16.0 | ±1.0 |
| **Netflix** | -27.0 | ±1.0 |
| **Amazon Music** | -24.0 | ±1.0 |
| **TikTok/Instagram** | -14.0 | ±1.0 |
| **Broadcast TV** | -23.0 | ±1.0 |

## Supported Formats

| Format | Max Size |
|--------|----------|
| **WAV** | 100MB |
| **FLAC** | 200MB |
| **MP3** | 75MB |
| **M4A/AAC** | 75MB |
| **OGG Vorbis** | 75MB |
| **WebM Audio** | 75MB |

## 🔍 Analysis Capabilities

Lufalyze provides **comprehensive audio analysis** focused on loudness measurement and technical quality assessment:

### **Loudness Analysis**
- **ITU-R BS.1770-4 Compliance** - Professional-grade loudness measurement
- **EBU R 128 Standards** - Broadcast-quality analysis with ±0.1 LU accuracy
- **Multi-Metric Analysis** - Momentary, Short-term, and Integrated LUFS
- **Platform Optimization** - Automatic compliance checking for streaming services

### **Technical Assessment**
- **True Peak Detection** - Comprehensive peak analysis with platform compliance
- **Quality Metrics** - Clipping detection, DC offset analysis, and noise assessment
- **Spectral Analysis** - Frequency balance across 7 bands with professional insights
- **Stereo Analysis** - Phase correlation, stereo width, and imaging quality

### **Performance Metrics**
- **Accuracy**: Professional-grade measurement with ±0.1 LU precision
- **Processing Speed**: Real-time analysis with WebAssembly optimization
- **Coverage**: Works with all supported audio formats
- **Reliability**: Consistent results across different audio content types

## Documentation Structure

| Document | Audience | Content |
|----------|----------|---------|
| **[README.md](README.md)** | Everyone | Overview, quick start, basic usage |
| **[docs/TECHNICAL.md](docs/TECHNICAL.md)** | Developers & Researchers | Mathematical formulas, algorithms, implementation details |
| **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** | Contributors | Development setup, architecture, testing, deployment |
| **[CONTRIBUTING.md](CONTRIBUTING.md)** | Contributors | Pull request workflow, coding standards, community guidelines |
| **[LICENSE](LICENSE)** | Legal | MIT license terms |

## Keyboard Shortcuts

| Key | Action | Context |
|-----|--------|---------|
| **U** | Upload file | Always |
| **E** | Export PDF report | After analysis |
| **C** | Copy results | After analysis |
| **D** | Toggle dark mode | Always |
| **H** | Show help | Always |
| **S** | Jump to spectrum | Always |
| **L** | Jump to loudness | Always |
| **P** | Jump to platform targets | Always |
| **F** | Jump to file details | Always |
| **T** | Jump to technical analysis | Always |
| **1-5** | Select platform target | Always |
| **Esc** | Close modals | In modals |



## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Audio Processing**: WebAssembly (Rust) + Web Audio API
- **Styling**: Tailwind CSS + Headless UI
- **PDF Generation**: PDF-lib for professional reports
- **Testing**: Vitest + Playwright E2E
- **Deployment**: Netlify with automatic builds
- **Standards**: ITU-R BS.1770-4, EBU R 128, WCAG 2.1 AA

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for:

- 🛠️ **Development setup** and build instructions
- 📝 **Coding standards** and style guidelines  
- 🧪 **Testing requirements** and procedures
- 📋 **Pull request process** and review criteria
- 🐛 **Bug reporting** and feature requests

## License & Credits

- **License**: [MIT License](LICENSE) - Free for commercial and personal use
- **Standards**: Implements ITU-R BS.1770-4 and EBU R 128 specifications
- **Creator**: [Richard Tillard](https://github.com/tillrd) ([@tillrd](https://github.com/tillrd))
- **Privacy**: No data collection, no analytics, no tracking
- **Security**: All processing local, no server uploads

## Links

- **🌐 Live Application**: [lufalyze.com](https://lufalyze.com)
- **📁 GitHub Repository**: [github.com/tillrd/Lufalyze](https://github.com/tillrd/Lufalyze)
- **📚 Technical Documentation**: [docs/TECHNICAL.md](docs/TECHNICAL.md)
- **🔗 EBU R 128 Standard**: [tech.ebu.ch/docs/r/r128.pdf](https://tech.ebu.ch/docs/r/r128.pdf)
- **🔗 ITU-R BS.1770-4**: [itu.int/rec/R-REC-BS.1770](https://www.itu.int/rec/R-REC-BS.1770/en)
- **💖 Sponsor Development**: [github.com/sponsors/tillrd](https://github.com/sponsors/tillrd)

---

**Lufalyze** - Professional Audio Analysis Platform

Built with ❤️ for the audio engineering community

<a href="https://lufalyze.com">Try it now</a> • <a href="docs/TECHNICAL.md">Technical docs</a> • <a href="https://github.com/tillrd/Lufalyze/issues">Report issues</a> 
