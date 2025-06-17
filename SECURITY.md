# Security Policy

Last updated: June 17, 2025

## Supported Versions

We currently support the following versions of Lufalyze:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of Lufalyze seriously. If you believe you have found a security vulnerability, please report it to us as described below.

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to rich@tillrd.com.

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

Please include the following information in your report:
- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

## Security Measures

### Application Security

- **Content Security Policy**: Strict CSP headers to prevent XSS attacks
- **Cross-Origin Resource Sharing**: Proper CORS configuration
- **HTTPS**: Required for all connections
- **WebAssembly Security**: Memory-safe processing environment
- **Input Validation**: Strict validation of all user inputs
- **Output Encoding**: Proper encoding of all output

### Development Security

- **Code Review**: All changes require review before merging
- **Dependency Scanning**: Regular updates of dependencies
- **Security Testing**: Regular security audits
- **Build Process**: Secure build pipeline

## Security Updates

Security updates will be released as patch versions (e.g., 1.0.1, 1.0.2). We will notify users of security updates through:

1. GitHub Security Advisories
2. Release notes
3. Documentation updates

## Contact

For security-related questions or concerns, please contact:

Richard Tillard  
GitHub: [https://github.com/tillrd](https://github.com/tillrd)

## License

This Security Policy is licensed under the MIT License, the same as our software. 
