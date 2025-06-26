import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Plugin to add COEP and COOP headers
const coepCoopPlugin = {
  name: 'coep-coop-headers',
  configureServer(server) {
    server.middlewares.use((_req, res, next) => {
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      next();
    });
  }
};

// Plugin to ensure CSP compliance by preventing inline styles
const cspPlugin = {
  name: 'csp-compliance',
  generateBundle(options, bundle) {
    // Ensure no inline styles are generated
    Object.keys(bundle).forEach(fileName => {
      const chunk = bundle[fileName];
      if (chunk.type === 'chunk' && chunk.code) {
        // Remove any potential inline style injections
        chunk.code = chunk.code.replace(/style\.textContent\s*=/, 'style.setAttribute("data-css",');
      }
    });
  }
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    coepCoopPlugin,
    cspPlugin,
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
      manifest: {
        name: 'Lufalyze - Loudness Analyzer',
        short_name: 'Lufalyze',
        description: 'Browser-based loudness analyzer implementing EBU R 128 / ITU-R BS.1770-4 specification',
        theme_color: '#4f46e5',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any'
          }
        ],
        categories: ['productivity', 'utilities', 'music'],
        lang: 'en'
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  define: {
    'import.meta.env.VITE_BUILD_HASH': JSON.stringify(process.env.VITE_BUILD_HASH || 'development')
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: ['log', 'info'], // Only drop console.log and console.info, keep warn/error
        drop_debugger: true
      }
    },
    cssCodeSplit: false, // Force all CSS into a single external file for CSP compliance
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Core React libraries
          if (id.includes('react') || id.includes('react-dom')) {
            return 'react-vendor';
          }
          
          // PDF-related code: REMOVE manual chunking to allow dynamic imports to work
          // This lets Vite automatically code-split PDF imports when they're dynamic
          // if (id.includes('pdf-lib')) { return 'pdf-vendor'; } // REMOVED
          // if (id.includes('src/utils/pdfExport')) { return 'pdf-utils'; } // REMOVED
          
          // Audio processing libraries  
          if (id.includes('web-audio-beat-detector') || id.includes('wav-decoder')) {
            return 'audio-vendor';
          }
          
          // UI utilities
          if (id.includes('clsx') || id.includes('html2canvas')) {
            return 'ui-vendor';
          }
          
          // WebAssembly and workers
          if (id.includes('comlink')) {
            return 'wasm-vendor';
          }
          
          // Utility libraries (smaller chunks)
          if (id.includes('wavesurfer.js')) {
            return 'utils';
          }
          
          // Keep other dependencies in vendor if they're large
          if (id.includes('node_modules') && id.split('/').pop()?.length > 40000) {
            return 'vendor-large';
          }
        },
        assetFileNames: (assetInfo) => {
          // Keep .wasm files in root for easier loading
          if (assetInfo.name?.endsWith('.wasm')) {
            return '[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        chunkFileNames: 'assets/[name]-[hash].js'
      }
    },
    assetsInlineLimit: 0,
    outDir: 'dist',
    assetsDir: 'assets',
    manifest: true,
    // Increase chunk size warning limit to reduce noise for optimized chunks
    chunkSizeWarningLimit: 300
  },
  optimizeDeps: {
    exclude: [],
    include: [
      'react',
      'react-dom',
      'clsx'
    ]
  },
  worker: {
    format: 'es'
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      // Modern HTTP: Additional security and performance headers
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      // Modern HTTP: Performance hints
      'Accept-CH': 'Viewport-Width, Device-Memory, RTT, Downlink, ECT',
      // Modern HTTP: Feature policy
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), fullscreen=(self)'
    },
    fs: {
      allow: ['..']
    }
  },
  preview: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  assetsInclude: ['**/*.wasm']
}); 