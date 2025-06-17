# Security Policy

## Supported Versions

We actively support the following versions of Lufalyze with security updates:

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < 1.0   | :x:                |

## Security Features

Lufalyze is designed with security and privacy as core principles:

### 🔒 Privacy-First Design
- **No server uploads**: All audio processing happens locally in your browser
- **No data collection**: We don't collect, store, or transmit any personal data
- **No tracking**: No analytics, cookies, or user tracking
- **Offline capable**: Works completely offline once loaded

### 🛡️ Security Measures
- **Sandboxed processing**: Audio analysis runs in isolated Web Workers
- **Memory-safe**: Rust/WebAssembly provides memory safety guarantees
- **Content Security Policy**: Strict CSP headers prevent XSS attacks
- **HTTPS only**: Deployed with HTTPS and security headers
- **No external dependencies at runtime**: All processing is self-contained

### 🔍 Third-Party Dependencies
- All dependencies are regularly audited for vulnerabilities
- We use minimal dependencies to reduce attack surface
- WebAssembly module is built from auditable Rust source code

## Reporting a Vulnerability

If you discover a security vulnerability in Lufalyze, please help us by reporting it responsibly:

### How to Report
1. **Email**: Send details to [security@lufalyze.com] (replace with actual email)
2. **GitHub**: Use private vulnerability reporting (if enabled)
3. **Timeline**: We aim to respond within 48 hours

### What to Include
- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Suggested fix (if you have one)

### What to Expect
1. **Acknowledgment**: We'll confirm receipt within 48 hours
2. **Assessment**: We'll evaluate the report within 5 business days
3. **Fix**: Critical issues will be patched within 2 weeks
4. **Disclosure**: We'll coordinate responsible disclosure with you

## Security Best Practices for Users

### For End Users
- Use the latest version of the application
- Access only through official deployment URLs
- Keep your browser updated
- Be cautious with audio files from untrusted sources

### For Developers
- Run `npm audit` regularly to check for vulnerabilities
- Keep dependencies updated
- Use the provided security headers in deployment
- Test with Content Security Policy enabled

## Scope

This security policy covers:
- The main Lufalyze application
- WebAssembly audio processing module
- Build and deployment configurations
- Documentation and examples

**Out of scope:**
- User's local browser security
- Third-party hosting platforms
- User-generated audio content

## Contact

For security-related questions or concerns:
- Security issues: [security@lufalyze.com] (replace with actual email)
- General questions: [GitHub Issues](https://github.com/tillrd/Lufalyze/issues)

---

**Note**: This is an open-source project focused on client-side audio analysis. No server-side components handle user data. 