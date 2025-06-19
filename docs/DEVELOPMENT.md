# Development Guide

This guide covers development setup, architecture overview, and contribution guidelines for Lufalyze.

## 🚀 Quick Setup

### Prerequisites
- **Node.js** 18+ and npm
- **Rust** 1.70+ (for WebAssembly compilation)
- **wasm-pack** for Rust → WebAssembly builds
- Modern browser with WebAssembly support

### Installation
```bash
# Clone repository
git clone https://github.com/tillrd/Lufalyze.git
cd Lufalyze

# Install dependencies
npm install

# Build WebAssembly module (optional - pre-built version included)
cd loudness-wasm
wasm-pack build --target web --out-dir ../pkg
cd ..

# Start development server
npm run dev
```

## 📁 Project Structure

```
Lufalyze/
├── src/                    # React frontend source
│   ├── components/         # React components
│   ├── workers/           # Web Workers for audio processing
│   ├── utils/             # Utilities (PDF export, etc.)
│   └── types/             # TypeScript definitions
├── loudness-wasm/         # Rust WebAssembly module
│   ├── src/lib.rs         # Core audio analysis algorithms
│   └── Cargo.toml         # Rust dependencies
├── public/                # Static assets
├── docs/                  # Documentation
├── tests/                 # E2E tests (Playwright)
└── pkg/                   # Compiled WebAssembly output
```

## 🏗️ Architecture Overview

### Frontend (React + TypeScript)
- **Component Architecture**: Modular React components with TypeScript
- **State Management**: React hooks for local state management
- **Styling**: Tailwind CSS with responsive design
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support

### Audio Processing Pipeline
```
Audio File → Web Audio API → Web Worker → WebAssembly → Analysis Results
```

1. **File Upload**: Browser File API with format validation
2. **Audio Decoding**: Web Audio API decodeAudioData()
3. **Worker Processing**: Off-main-thread analysis in Web Worker
4. **WebAssembly Analysis**: Rust implementation of ITU-R BS.1770-4
5. **Results Display**: Real-time UI updates with analysis data

### WebAssembly Module (Rust)
- **Performance**: SIMD optimizations where available
- **Memory Safety**: Rust's ownership system prevents common audio processing bugs
- **Standards Compliance**: Exact implementation of ITU-R BS.1770-4 and EBU R 128
- **Musical Analysis**: Key detection using Krumhansl-Schmuckler profiles

## 🛠️ Development Workflow

### Available Scripts
```bash
# Development
npm run dev              # Start dev server with hot reload
npm run build           # Production build
npm run preview         # Preview production build locally

# Testing
npm run test            # Run unit tests (Vitest)
npm run test:e2e        # Run E2E tests (Playwright)
npm run test:ui         # Run tests with UI

# WebAssembly
npm run build:wasm      # Rebuild WebAssembly module
npm run optimize:wasm   # Optimize WASM binary size

# Code Quality
npm run lint            # ESLint checks
npm run type-check      # TypeScript type checking
npm run format          # Prettier formatting
```

### Hot Reload Development
The development server supports:
- **React Fast Refresh** for component changes
- **TypeScript compilation** with error reporting
- **Tailwind CSS** hot reload for styling changes
- **WebAssembly module** auto-reload (requires manual rebuild)

## 🧪 Testing Strategy

### Unit Tests (Vitest)
```bash
# Run all tests
npm run test

# Run specific test file
npm run test src/utils/pdfExport.test.ts

# Run tests in watch mode
npm run test --watch
```

### End-to-End Tests (Playwright)
```bash
# Run E2E tests
npm run test:e2e

# Run tests in headed mode (visible browser)
npm run test:e2e --headed

# Run specific test
npm run test:e2e tests/e2e/ui.spec.ts
```

### Test Files
- `src/test/` - Unit tests for utilities and components
- `tests/e2e/` - End-to-end UI testing
- `loudness-wasm/tests/` - Rust unit tests for audio algorithms

## 📋 Code Standards

### TypeScript Guidelines
- **Strict mode**: All TypeScript strict checks enabled
- **Explicit types**: Prefer explicit type annotations over `any`
- **Interface naming**: Use descriptive names without Hungarian notation
- **Function signatures**: Document complex functions with JSDoc

### React Component Guidelines
```typescript
// Good: Functional component with explicit props interface
interface AudioAnalyzerProps {
  audioBuffer: AudioBuffer;
  onAnalysisComplete: (results: AnalysisResults) => void;
}

export const AudioAnalyzer: React.FC<AudioAnalyzerProps> = ({ 
  audioBuffer, 
  onAnalysisComplete 
}) => {
  // Component implementation
};
```

### Accessibility Requirements
- **ARIA labels**: All interactive elements must have accessible names
- **Keyboard navigation**: Full functionality available via keyboard
- **Color contrast**: WCAG 2.1 AA compliance (4.5:1 ratio minimum)
- **Screen readers**: Test with VoiceOver/NVDA

### Performance Guidelines
- **Web Workers**: Keep heavy processing off main thread
- **Memory management**: Clean up audio buffers and ArrayBuffers
- **Bundle size**: Monitor with `npm run build` and webpack-bundle-analyzer
- **Lazy loading**: Use React.lazy() for non-critical components

## 🔧 WebAssembly Development

### Rust Environment Setup
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Add WebAssembly target
rustup target add wasm32-unknown-unknown
```

### Building WebAssembly Module
```bash
cd loudness-wasm

# Development build (with debug symbols)
wasm-pack build --dev --target web --out-dir ../pkg

# Production build (optimized)
wasm-pack build --target web --out-dir ../pkg

# Check binary size
ls -la ../pkg/loudness_wasm_bg.wasm
```

### Rust Code Guidelines
- **Safety**: Use `unsafe` blocks only when necessary with clear comments
- **Performance**: Profile with `cargo bench` for audio processing functions
- **Error handling**: Use `Result<T, E>` for fallible operations
- **Documentation**: Document all public functions with `///` comments

## 🐛 Debugging

### Browser DevTools
- **Console**: Check for JavaScript errors and WebAssembly loading issues
- **Network**: Monitor file upload progress and size limits
- **Performance**: Profile audio processing with Performance tab
- **Memory**: Watch for memory leaks during audio analysis

### Common Issues

#### WebAssembly Not Loading
```javascript
// Check if WebAssembly is supported
if (typeof WebAssembly === 'object') {
  console.log('WebAssembly supported');
} else {
  console.error('WebAssembly not supported');
}
```

#### Audio Decoding Failures
```javascript
// Check supported audio formats
const audio = new Audio();
console.log('MP3 support:', audio.canPlayType('audio/mpeg'));
console.log('WAV support:', audio.canPlayType('audio/wav'));
```

#### Memory Issues
```javascript
// Monitor memory usage
console.log('Memory usage:', performance.memory?.usedJSHeapSize);
```

## 📦 Build & Deployment

### Production Build
```bash
# Full production build
npm run build

# Analyze bundle size
npm run build -- --analyze

# Test production build locally
npm run preview
```

### Deployment (Netlify)
- **Automatic**: Pushes to `main` branch trigger builds
- **Preview**: Pull requests get preview deployments
- **Configuration**: See `netlify.toml` for build settings
- **Custom headers**: Security headers configured in `_headers`

### Build Optimization
- **Code splitting**: Automatic chunk splitting by Vite
- **Tree shaking**: Dead code elimination
- **Asset optimization**: Image compression and minification
- **WebAssembly**: Compressed WASM binary

## 🔒 Security Considerations

### Content Security Policy
```html
<!-- Strict CSP headers for security -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self' 'wasm-unsafe-eval';">
```

### File Upload Security
- **Size limits**: Maximum file sizes enforced client-side
- **Type validation**: MIME type checking before processing
- **Local processing**: No files sent to servers
- **Memory limits**: Prevent out-of-memory attacks

## 📚 Additional Resources

### Standards Documentation
- [ITU-R BS.1770-4](https://www.itu.int/rec/R-REC-BS.1770/en) - Loudness measurement standard
- [EBU R 128](https://tech.ebu.ch/docs/r/r128.pdf) - Loudness normalisation standard
- [Web Audio API](https://webaudio.github.io/web-audio-api/) - Browser audio processing

### Development Tools
- [wasm-pack](https://rustwasm.github.io/wasm-pack/) - Rust to WebAssembly workflow
- [Vite](https://vitejs.dev/) - Build tool and development server
- [Vitest](https://vitest.dev/) - Unit testing framework
- [Playwright](https://playwright.dev/) - End-to-end testing

### Performance Profiling
- [Chrome DevTools](https://developers.google.com/web/tools/chrome-devtools) - Browser profiling
- [cargo bench](https://doc.rust-lang.org/cargo/commands/cargo-bench.html) - Rust benchmarking
- [WebAssembly optimization](https://rustwasm.github.io/book/reference/code-size.html) - Size optimization

---

## 🤝 Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for:
- Pull request workflow
- Issue reporting guidelines  
- Code review process
- Community guidelines 