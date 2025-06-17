# Build System Documentation

## Overview

Lufalyze uses a sophisticated build system that automatically generates version information, builds WebAssembly modules, and deploys to production.

## Version Management

### Automatic Version Generation

The build system automatically generates version information including:

- **Version**: From `package.json`
- **Build Hash**: Current Git commit hash
- **Build Date**: ISO timestamp of build
- **Build Number**: GitHub Actions run number or timestamp

### Environment Variables

The following environment variables are automatically set during build:

- `VITE_VERSION`: Application version (e.g., "1.0.0")
- `VITE_BUILD_HASH`: Git commit hash (e.g., "a1b2c3d")
- `VITE_BUILD_DATE`: Build timestamp (e.g., "2024-01-01T12:00:00Z")
- `VITE_BUILD_NUMBER`: Build number (e.g., "123")

## Local Development

### Setup

```bash
npm install
npm run version  # Generate version info
npm run dev      # Start development server
```

### Version Script

Run the version script manually:

```bash
npm run version
```

This creates `.env.local` with current build information.

## Production Build

### Netlify Build Process

1. **Version Generation**: Extract version from package.json and Git
2. **Rust Installation**: Install Rust toolchain and wasm-pack
3. **WASM Compilation**: Build loudness analysis module
4. **React Build**: Build frontend with version info
5. **Asset Copying**: Copy WASM files to dist

### Build Script (`build.sh`)

```bash
chmod +x ./build.sh && ./build.sh
```

The build script:
- Generates version information
- Installs Rust and wasm-pack
- Compiles WebAssembly module
- Builds React application
- Copies assets

## GitHub Actions CI/CD

### Workflow Features

- **Automated Testing**: Runs unit and E2E tests
- **Version Management**: Automatic version injection
- **Build Artifacts**: Uploads build for deployment
- **Netlify Deployment**: Automatic deployment on main branch

### Workflow Triggers

- **Push to main**: Full build and deploy
- **Pull requests**: Build and test only

### Required Secrets

For GitHub Actions deployment:

```
NETLIFY_AUTH_TOKEN=your_netlify_token
NETLIFY_SITE_ID=your_site_id
```

## Build Environments

### Development

- Uses local Git commit hash
- Timestamp-based build numbers
- Hot reload enabled

### Production (Netlify)

- Uses GitHub commit hash
- GitHub Actions run number
- Optimized build
- Asset compression

### GitHub Actions

- Full CI/CD pipeline
- Automated testing
- Deploy previews
- Production deployment

## Version Display

Version information is displayed in the About dialog:

```
Version: 1.0.0
Build: a1b2c3d (#123) • 1/1/2024
```

## Troubleshooting

### Common Issues

1. **Missing version info**: Run `npm run version`
2. **WASM build fails**: Check Rust installation
3. **GitHub Actions fails**: Check secrets configuration

### Build Logs

Check build logs in:
- **Local**: Terminal output
- **Netlify**: Deploy logs in dashboard
- **GitHub**: Actions tab

## File Structure

```
├── .github/workflows/deploy.yml    # GitHub Actions
├── scripts/version.js              # Version generator
├── build.sh                        # Production build script
├── netlify.toml                     # Netlify configuration
└── package.json                     # Dependencies and scripts
``` 