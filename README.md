# Lufalyze

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/tillrd/Lufalyze/pulls)
[![Netlify Status](https://api.netlify.com/api/v1/badges/0ac3ebeb-2efc-4914-8a69-b0196ed08e87/deploy-status)](https://app.netlify.com/projects/lufalyze/deploys)
[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4%EF%B8%8F-red)](https://github.com/sponsors/tillrd)

<div align="center">
  <h3>
    <a href="https://lufalyze.netlify.app">Demo</a>
    <span> • </span>
    <a href="https://github.com/tillrd/Lufalyze/blob/main/README.md#algorithm">Algorithm</a>
    <span> • </span>
    <a href="https://github.com/tillrd/Lufalyze/blob/main/README.md#platform-targets">Targets</a>
    <span> • </span>
    <a href="https://github.com/tillrd/Lufalyze/blob/main/README.md#getting-started">Getting Started</a>
  </h3>
</div>

## Overview

Lufalyze is a web-based loudness analyzer that implements the ITU-R BS.1770-4 standard. It provides accurate loudness measurements for audio files across different platforms and standards.

## Features

- **ITU-R BS.1770-4 Implementation**: Accurate loudness measurement following international standards
- **Platform-Specific Targets**: Pre-configured targets for major streaming platforms
- **Real-time Analysis**: Instant feedback on audio loudness
- **Privacy-Focused**: All processing happens locally in your browser
- **Cross-Platform**: Works on any modern web browser
- **Offline Support**: Functions without internet connection
- **Dark Mode**: Comfortable viewing in any lighting condition

## Algorithm

Lufalyze implements the ITU-R BS.1770-4 algorithm for loudness measurement. The process includes:

1. **Pre-filtering**: Applies K-weighting filter to the audio
2. **Mean Square Calculation**: Computes mean square of the filtered signal
3. **Gating**: Applies relative and absolute gating
4. **Integration**: Calculates integrated loudness over time
5. **Normalization**: Applies platform-specific targets

```typescript
// Example of the core algorithm implementation
const processAudio = async (audioData: Float32Array) => {
  // Apply K-weighting filter
  const filtered = applyKWeighting(audioData);
  
  // Calculate mean square
  const meanSquare = calculateMeanSquare(filtered);
  
  // Apply gating
  const gated = applyGating(meanSquare);
  
  // Calculate integrated loudness
  const integratedLoudness = calculateIntegratedLoudness(gated);
  
  return integratedLoudness;
};
```

## Platform Targets

| Platform | Target (LUFS) | Tolerance |
|----------|---------------|-----------|
| Spotify | -14.0 | ±1.0 |
| YouTube | -14.0 | ±1.0 |
| Apple Music | -16.0 | ±1.0 |
| Netflix | -27.0 | ±1.0 |
| Amazon | -24.0 | ±1.0 |

## Getting Started

### Prerequisites

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Audio file in a supported format (WAV, MP3, FLAC)

### Usage

1. Visit [Lufalyze](https://lufalyze.netlify.app)
2. Upload your audio file
3. Select your target platform
4. View the analysis results

## Development

### Installation

```bash
# Clone the repository
git clone https://github.com/tillrd/Lufalyze.git

# Navigate to project directory
cd Lufalyze

# Install dependencies
npm install

# Start development server
npm run dev
```

### Building

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Technical Stack

- **Frontend**: React + TypeScript
- **Audio Processing**: WebAssembly
- **Build Tool**: Vite
- **Deployment**: Netlify
- **Testing**: Vitest
- **CI/CD**: GitHub Actions

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

Richard Tillard - [@tillrd](https://github.com/tillrd)

Project Link: [https://github.com/tillrd/Lufalyze](https://github.com/tillrd/Lufalyze) 