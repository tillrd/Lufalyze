# Privacy Policy

## Overview

Lufalyze is designed with privacy as a fundamental principle. This document explains how we handle (or rather, don't handle) your data.

## The Short Version

**We don't collect, store, or transmit any of your data. Period.**

## Detailed Privacy Information

### 🔒 No Data Collection
- **Audio files**: Never uploaded to any server - processed entirely in your browser
- **Personal information**: We don't ask for or collect any personal data
- **Usage analytics**: No tracking, analytics, or telemetry of any kind
- **Cookies**: No cookies are set or used

### 🖥️ Local Processing Only
- All audio analysis happens locally in your browser using WebAssembly
- Your audio files never leave your device
- Processing results are computed and displayed locally
- No network requests are made for audio processing

### 🌐 What Happens Online
The only network activity occurs when:
1. **Loading the application**: Downloading the app files (HTML, CSS, JS, WASM)
2. **Static hosting**: Served from CDN/hosting provider (no server-side processing)

### 🛡️ Technical Privacy Protections

#### Client-Side Architecture
- **Web Workers**: Audio processing runs in isolated browser workers
- **WebAssembly**: Memory-safe processing environment
- **No external APIs**: No communication with external services during use
- **Progressive Web App**: Can work completely offline

#### Browser Security
- **Same-origin policy**: Prevents unauthorized access to your files
- **Content Security Policy**: Blocks malicious script injection
- **HTTPS**: Encrypted connection when loading the app

### 📁 File Access
- Files are accessed only when you explicitly select them
- Files are processed in browser memory only
- No files are saved, cached, or transmitted
- File processing is temporary and cleared when you close the app

### 🔍 Third-Party Services

#### Hosting Provider
- The app is hosted on [Netlify/hosting provider]
- Standard web server logs may include:
  - IP address
  - Browser type
  - Access time
  - Requested files
- These logs don't contain any audio data or processing results

#### No Third-Party Integrations
- No advertising networks
- No social media trackers
- No email collection
- No user accounts or authentication

### 🌍 International Considerations
- No data crosses borders (everything is local)
- GDPR compliant by design (no data collection)
- CCPA compliant (no personal information handling)
- Suitable for any privacy jurisdiction

### 🔧 Developer Information

If you're running this locally or contributing:
- Source code is open and auditable
- Build process is transparent
- No hidden data collection in dependencies
- WebAssembly module source is available

### 📱 Mobile and Desktop Use
- Same privacy protections apply across all devices
- No additional permissions required
- Works in any modern browser
- No app installation tracking

## Your Rights

Since we don't collect data, most privacy rights are automatically fulfilled:
- **Right to access**: No data to access
- **Right to deletion**: No data to delete
- **Right to portability**: All results stay with you
- **Right to correction**: No stored data to correct

## Changes to This Policy

- This policy may be updated to reflect changes in the application
- Material changes will be noted in the project repository
- Check the repository for the latest version

## Contact

For privacy-related questions:
- **GitHub Issues**: [Lufalyze Issues](https://github.com/tillrd/Lufalyze/issues)
- **Email**: [privacy@lufalyze.com] (replace with actual email)

## Transparency

This privacy policy is stored in the public repository, making our privacy practices fully transparent and auditable.

---

**Last updated**: December 2024  
**Effective date**: December 2024

---

*"Privacy by design means privacy by default."* 