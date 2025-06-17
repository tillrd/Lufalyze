# Deployment Guide for Lufalyze

This guide covers deploying Lufalyze to Netlify with proper configuration for WebAssembly and SharedArrayBuffer support.

## Prerequisites

1. **Rust and wasm-pack**: Required for building the WASM module
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://rustup.rs/ | sh
   cargo install wasm-pack
   ```

2. **Node.js 18+**: Required for the build process
   ```bash
   # Check your Node.js version
   node --version
   ```

3. **Netlify CLI** (optional): For command-line deployment
   ```bash
   npm install -g netlify-cli
   ```

## Deployment Methods

### Method 1: Automatic Deployment via Git (Recommended)

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Connect to Netlify**:
   - Go to [netlify.com](https://netlify.com) and log in
   - Click "New site from Git"
   - Connect your GitHub repository
   - Select your Lufalyze repository

3. **Configure Build Settings**:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: `18` (set in Environment Variables)

4. **Deploy**: Netlify will automatically build and deploy your site

### Method 2: Manual Deployment via CLI

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build the project**:
   ```bash
   npm run build
   ```

3. **Deploy to Netlify**:
   ```bash
   # Login to Netlify (first time only)
   netlify login
   
   # Deploy preview
   npm run deploy:preview
   
   # Deploy to production
   npm run deploy
   ```

### Method 3: Drag and Drop Deployment

1. **Build locally**:
   ```bash
   npm install
   npm run build
   ```

2. **Upload to Netlify**:
   - Go to [netlify.com](https://netlify.com)
   - Drag the `dist/` folder to the deployment area

## Required Configuration

### 1. Environment Variables

Set these in your Netlify dashboard under Site Settings → Environment Variables:

```
NODE_VERSION=18
VITE_BUILD_HASH=CONTEXT_ID
```

### 2. Headers Configuration

The `netlify.toml` file is already configured with the required headers:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Cross-Origin-Embedder-Policy = "require-corp"
    Cross-Origin-Opener-Policy = "same-origin"
```

These headers are **critical** for SharedArrayBuffer support, which is required for WebAssembly performance.

### 3. Redirects for SPA

The `netlify.toml` includes SPA redirect configuration:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## Build Process Overview

1. **WASM Compilation**: `npm run build:wasm`
   - Compiles Rust code to WebAssembly
   - Generates `loudness_wasm.js` and `loudness_wasm_bg.wasm`

2. **React Build**: `vite build`
   - Bundles React application
   - Optimizes for production
   - Generates Progressive Web App files

3. **Post-build**: `npm run postbuild`
   - Copies WASM files to dist directory
   - Ensures proper file placement for deployment

## Troubleshooting

### Build Failures

1. **WASM build fails**:
   ```bash
   # Ensure Rust is installed
   rustc --version
   
   # Install wasm-pack
   cargo install wasm-pack
   
   # Clean and rebuild
   cd loudness-wasm
   cargo clean
   cd ..
   npm run build:wasm
   ```

2. **Node.js version issues**:
   - Ensure you're using Node.js 18+
   - Use nvm to switch versions if needed

3. **TypeScript errors**:
   ```bash
   # Check for type errors
   npm run lint
   ```

### Runtime Issues

1. **WASM loading fails**:
   - Check browser console for CORS errors
   - Verify headers are properly set
   - Ensure WASM files are accessible

2. **SharedArrayBuffer not available**:
   - Check that COOP and COEP headers are set
   - Site must be served over HTTPS
   - Some browsers require additional flags in development

### Performance Optimization

1. **Caching**: Headers are configured for optimal caching
   - WASM files: 1 year cache
   - Static assets: 1 year cache
   - JS/CSS: 1 day cache

2. **Service Worker**: PWA is enabled for offline functionality

3. **Bundle Splitting**: Vendor chunks are separated for better caching

## Domain Configuration

### Custom Domain

1. **Add domain in Netlify**:
   - Go to Site Settings → Domain Management
   - Add your custom domain

2. **DNS Configuration**:
   - Point your domain to Netlify's load balancer
   - Enable HTTPS (automatic with Let's Encrypt)

### Subdomain Deployment

You can deploy to a subdomain by configuring your DNS:

```
meterly.yourdomain.com → [your-site].netlify.app
```

## Monitoring and Analytics

### Performance Monitoring

Monitor your deployment with:
- Netlify Analytics (built-in)
- Web Vitals (configured in app)
- Browser DevTools for performance profiling

### Error Tracking

The app includes error boundaries and console logging for debugging production issues.

## Security Considerations

1. **HTTPS Only**: Required for SharedArrayBuffer
2. **Content Security Policy**: Configured in HTML
3. **No Server Dependencies**: All processing is client-side
4. **CORS Headers**: Properly configured for cross-origin isolation

## Maintenance

### Regular Updates

1. **Dependencies**: Keep npm packages updated
2. **Rust**: Update Rust toolchain periodically
3. **Browser Compatibility**: Test with latest browser versions

### Backup Strategy

- Code is version controlled in Git
- Netlify keeps deployment history
- No server-side data to backup

---

For issues or questions, check the [troubleshooting section](README.md#troubleshooting) in the main README. 