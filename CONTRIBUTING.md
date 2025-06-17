# Contributing to Lufalyze

Thank you for your interest in contributing to Lufalyze! This document provides guidelines for contributing to the project.

## 🌟 Ways to Contribute

### Code Contributions
- Bug fixes and improvements
- New features and enhancements
- Performance optimizations
- Documentation improvements

### Non-Code Contributions
- Bug reports and feature requests
- Documentation improvements
- Testing and quality assurance
- UI/UX feedback and suggestions

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Rust and wasm-pack (for WebAssembly development)
- Git

### Development Setup

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/Lufalyze.git
   cd Lufalyze
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build WebAssembly module**
   ```bash
   cd loudness-wasm
   wasm-pack build --target web --out-dir ../public
   cd ..
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Run tests**
   ```bash
   npm run test
   npm run test:e2e
   ```

## 📝 Development Guidelines

### Code Style
- Use TypeScript for all new JavaScript code
- Follow existing code formatting (Prettier configuration)
- Use meaningful variable and function names
- Add comments for complex logic

### Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat: add new loudness visualization`
- `fix: resolve WebAssembly memory leak`
- `docs: update installation instructions`
- `test: add integration tests for file upload`

### Branch Naming
- `feat/feature-name` for new features
- `fix/bug-description` for bug fixes
- `docs/update-readme` for documentation
- `test/add-unit-tests` for testing improvements

## 🐛 Bug Reports

When reporting bugs, please include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Browser and OS information
- Audio file details (format, size) if relevant
- Console errors (if any)

Use our [bug report template](.github/ISSUE_TEMPLATE/bug_report.md).

## 💡 Feature Requests

For feature requests, please:
- Describe the feature clearly
- Explain the use case and benefits
- Consider implementation complexity
- Check if it aligns with project goals

Use our [feature request template](.github/ISSUE_TEMPLATE/feature_request.md).

## 🔧 Technical Areas

### Frontend (React + TypeScript)
- Components in `src/components/`
- Hooks and utilities in `src/hooks/` and `src/utils/`
- Styling with Tailwind CSS
- PWA features and service workers

### WebAssembly (Rust)
- Audio processing logic in `loudness-wasm/src/`
- FFT and loudness calculations
- Memory-efficient algorithms
- Browser compatibility

### Build System
- Vite configuration
- TypeScript configuration
- Testing setup (Vitest + Playwright)
- PWA build pipeline

## 🧪 Testing

### Unit Tests
```bash
npm run test           # Run unit tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

### End-to-End Tests
```bash
npm run test:e2e       # Run E2E tests
npm run test:e2e:ui    # Interactive mode
```

### Manual Testing
- Test with various audio file formats
- Check responsive design on different devices
- Verify offline functionality
- Test performance with large files

## 📚 Documentation

### Code Documentation
- Add JSDoc comments for functions
- Document complex algorithms
- Update README.md for setup changes
- Keep DEPLOYMENT.md current

### User Documentation
- Update feature descriptions
- Add usage examples
- Include troubleshooting guides
- Maintain accuracy with code changes

## 🚢 Pull Request Process

1. **Create a branch**
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes**
   - Follow coding standards
   - Add tests for new features
   - Update documentation

3. **Test thoroughly**
   ```bash
   npm run build
   npm run test
   npm run test:e2e
   ```

4. **Commit and push**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   git push origin feat/your-feature-name
   ```

5. **Create Pull Request**
   - Use descriptive title and description
   - Link related issues
   - Include testing instructions
   - Add screenshots for UI changes

### PR Review Process
- Maintainers will review within 48-72 hours
- Address feedback and suggestions
- Ensure CI checks pass
- Squash commits before merge (if requested)

## 🔒 Security Contributions

For security-related contributions:
- Review our [Security Policy](SECURITY.md)
- Report vulnerabilities privately first
- Follow responsible disclosure practices
- Help improve security documentation

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🤝 Code of Conduct

### Our Standards
- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Maintain professional communication

### Enforcement
- Issues will be addressed promptly
- Contact maintainers for concerns
- Serious violations may result in temporary or permanent bans

## 💬 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **Discussions**: For questions and general discussion
- **Documentation**: Check existing docs first
- **Code Review**: Ask for feedback on approach before implementing large features

## 🎯 Project Goals

Keep these in mind when contributing:
- **Privacy-first**: No data collection or external tracking
- **Performance**: Fast, efficient audio processing
- **Accessibility**: Usable by everyone
- **Simplicity**: Clean, intuitive interface
- **Open Source**: Transparent and auditable code

---

**Thank you for contributing to Lufalyze!** 🎵

Every contribution, no matter how small, helps make audio analysis more accessible to everyone. 