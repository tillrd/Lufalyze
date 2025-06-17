# Lufalyze

A professional loudness analyzer implementing EBU R 128 / ITU-R BS.1770-4 specification. Analyze audio files directly in your browser with WebAssembly-powered accuracy.

![Lufalyze Screenshot](./docs/screenshot.png)

## Features

- **Professional Accuracy**: Implements ITU-R BS.1770-4 with proper K-weighting
- **Browser-Based**: All processing happens locally - no uploads required
- **Multiple Metrics**: Momentary Max, Short Term Max, and Integrated loudness measurements
- **Platform Targets**: Quick comparison against Spotify, Apple Music, YouTube, and more
- **Modern UI**: Responsive design with dark/light mode support
- **Progressive Web App**: Install and use offline
- **WebAssembly Performance**: Fast audio processing with Rust-based WASM module

## Technical Implementation

- **Frontend**: React + TypeScript + Tailwind CSS
- **Audio Processing**: Web Audio API + WebAssembly (Rust)
- **File Decoding**: music-metadata for robust WAV format support
- **Worker Processing**: Web Workers for non-blocking UI
- **Standards Compliance**: ITU-R BS.1770-4 algorithm with proper gating

## Development

### Prerequisites

- Node.js 18+
- Rust toolchain with wasm-pack
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/tillrd/Lufalyze.git
cd Lufalyze

# Install dependencies
npm install

# Build the WASM module
npm run build:wasm

# Start development server
npm run dev
```

### Building for Production

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

### Netlify (Recommended)

1. Connect your GitHub repository to Netlify
2. Build settings are configured in `netlify.toml`
3. Deploy command: `npm run build`
4. Publish directory: `dist`

The application requires specific headers for SharedArrayBuffer support:
- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Opener-Policy: same-origin`

These are automatically configured in `netlify.toml`.

### Manual Deployment

```bash
# Build the project
npm run build

# Deploy the dist/ folder to your static hosting provider
# Ensure your server supports the required CORS headers
```

## Browser Support

- Chrome 67+ (SharedArrayBuffer support required)
- Firefox 79+
- Safari 15.2+
- Edge 79+

## Technical Validation

This analyzer has been validated against professional tools:
- Youlean Loudness Meter Pro
- iZotope Insight 2
- NUGEN VisLM

Typical accuracy: ±0.1 LUFS on standard test material.

## File Format Support

- WAV files (16-bit, 24-bit, 32-bit PCM)
- Sample rates: 44.1kHz, 48kHz, 96kHz
- Mono and stereo files
- Maximum file size: 100MB

## Performance

Processing times on modern hardware:
- 3-minute stereo file: ~500ms
- Real-time factor: ~360x (44.1kHz material)
- Memory usage: ~50MB for typical files

## Privacy & Security

- **Privacy-first design**: All processing happens locally in your browser
- **No data collection**: Audio files never leave your device
- **No tracking**: No analytics, cookies, or external tracking
- **Content Security Policy**: Enforced for additional protection
- **HTTPS required**: For SharedArrayBuffer security

See our [Privacy Policy](PRIVACY.md) and [Security Policy](SECURITY.md) for more details.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on:
- Setting up the development environment
- Code style and standards
- Pull request process
- Reporting bugs and requesting features

## Support

- **Bug Reports**: [GitHub Issues](https://github.com/tillrd/Lufalyze/issues)
- **Feature Requests**: [GitHub Issues](https://github.com/tillrd/Lufalyze/issues)
- **Documentation**: Check our [wiki](https://github.com/tillrd/Lufalyze/wiki) (when available)

## Roadmap

- [ ] Support for additional audio formats (MP3, FLAC)
- [ ] True Peak measurement
- [ ] Loudness Range (LRA) calculation
- [ ] Batch processing
- [ ] Real-time monitoring via microphone input
- [ ] Export capabilities (reports, graphs)

---

**Built with ❤️ for audio professionals and enthusiasts.**

*Lufalyze: Making professional loudness analysis accessible to everyone.* 