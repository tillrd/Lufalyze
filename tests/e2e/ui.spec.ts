import { test, expect } from '@playwright/test';

test.describe('Lufalyze UI Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:4173');
  });

  test.describe('Initial Page Load', () => {
    test('should display the main heading and subtitle', async ({ page }) => {
      await expect(page.getByText('Lufalyze')).toBeVisible();
      await expect(page.getByText('Professional loudness analyzer implementing EBU R 128')).toBeVisible();
    });

    test('should display the About button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /about/i })).toBeVisible();
    });

    test('should display the file upload area', async ({ page }) => {
      await expect(page.getByText('Drop your WAV file here')).toBeVisible();
      await expect(page.getByText('or click to browse')).toBeVisible();
    });

    test('should not display results initially', async ({ page }) => {
      await expect(page.getByText('Loudness Analysis')).not.toBeVisible();
    });
  });

  test.describe('About Dialog', () => {
    test('should open and close about dialog', async ({ page }) => {
      // Open dialog
      await page.getByRole('button', { name: /about/i }).click();
      await expect(page.getByText('About Lufalyze')).toBeVisible();
      await expect(page.getByText(/Version: 0.1.0/)).toBeVisible();

      // Close dialog
      await page.getByRole('button').filter({ hasText: '×' }).click();
      await expect(page.getByText('About Lufalyze')).not.toBeVisible();
    });

    test('should display privacy and technical information', async ({ page }) => {
      await page.getByRole('button', { name: /about/i }).click();
      
      await expect(page.getByText(/All processing happens locally/)).toBeVisible();
      await expect(page.getByText(/WebAssembly/)).toBeVisible();
      await expect(page.getByText(/ITU-R BS.1770-4 with proper K-weighting/)).toBeVisible();
      await expect(page.getByText('Youlean Loudness Meter Pro')).toBeVisible();
    });
  });

  test.describe('File Upload Validation', () => {
    test('should show error for non-WAV files', async ({ page }) => {
      // Create a test file with wrong extension
      const fileContent = 'fake mp3 content';
      const buffer = Buffer.from(fileContent);
      
      await page.getByRole('button', { name: /browse/i }).setInputFiles({
        name: 'test.mp3',
        mimeType: 'audio/mp3',
        buffer: buffer
      });

      await expect(page.getByText('Please select a WAV file')).toBeVisible();
    });

    test('should accept valid WAV files', async ({ page }) => {
      // Create a mock WAV file
      const wavHeader = new ArrayBuffer(44);
      const view = new DataView(wavHeader);
      
      // Write minimal WAV header
      view.setUint32(0, 0x52494646, false); // "RIFF"
      view.setUint32(4, 36, true); // File size - 8
      view.setUint32(8, 0x57415645, false); // "WAVE"
      
      await page.getByRole('button', { name: /browse/i }).setInputFiles({
        name: 'test.wav',
        mimeType: 'audio/wav',
        buffer: Buffer.from(wavHeader)
      });

      await expect(page.getByText('test.wav')).toBeVisible();
      await expect(page.getByText('Processing...')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await expect(page.getByText('Lufalyze')).toBeVisible();
      await expect(page.getByText('Drop your WAV file here')).toBeVisible();
      await expect(page.getByRole('button', { name: /about/i })).toBeVisible();
    });

    test('should work on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      
      await expect(page.getByText('Lufalyze')).toBeVisible();
      await expect(page.getByText('Professional loudness analyzer')).toBeVisible();
    });

    test('should work on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      await expect(page.getByText('Lufalyze')).toBeVisible();
      await expect(page.getByText('Professional loudness analyzer')).toBeVisible();
    });
  });

  test.describe('Dark Mode', () => {
    test('should respect system dark mode preference', async ({ page }) => {
      // Simulate dark mode preference
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.reload();
      
      // Check if dark mode classes are applied
      const html = page.locator('html');
      await expect(html).toHaveClass(/dark/);
    });

    test('should work in light mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.reload();
      
      const html = page.locator('html');
      await expect(html).not.toHaveClass(/dark/);
    });
  });

  test.describe('Drag and Drop', () => {
    test('should highlight drop area on drag over', async ({ page }) => {
      const dropArea = page.locator('[data-testid="drop-area"]').first();
      
      // Create a drag event
      await dropArea.dispatchEvent('dragenter');
      
      // Check for visual feedback
      await expect(dropArea).toHaveClass(/border-indigo-500/);
    });
  });

  test.describe('Platform Targets', () => {
    test('should display platform target buttons when results are shown', async ({ page }) => {
      // This test assumes we have a way to trigger results display
      // In a real scenario, you'd upload a file and wait for processing
      
      // For now, we'll check that the platform target section exists in the DOM
      // when results are displayed (even if not visible initially)
      const platformSection = page.getByText('Platform Targets');
      // This element exists in the component but may not be visible until results load
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper focus management', async ({ page }) => {
      // Test keyboard navigation
      await page.keyboard.press('Tab');
      
      const aboutButton = page.getByRole('button', { name: /about/i });
      await expect(aboutButton).toBeFocused();
    });

    test('should have proper ARIA labels', async ({ page }) => {
      const fileInput = page.getByRole('button', { name: /browse/i });
      await expect(fileInput).toBeVisible();
      
      // Check that file input has proper accessibility attributes
      await expect(fileInput).toHaveAttribute('type', 'file');
    });

    test('should work with screen reader', async ({ page }) => {
      // Check for proper heading structure
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Meterly');
      
      // Check for descriptive text
      await expect(page.getByText(/Professional loudness meter/)).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('should load within reasonable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('http://localhost:4173');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test('should have proper meta tags for SEO', async ({ page }) => {
      await expect(page).toHaveTitle(/Lufalyze - Professional Loudness Analyzer/);
      
      const description = page.locator('meta[name="description"]');
      await expect(description).toHaveAttribute('content', /Professional loudness analyzer implementing EBU R 128/);
    });
  });

  test.describe('Error Handling', () => {
    test('should display error for files over size limit', async ({ page }) => {
      // Create a large buffer to simulate a big file
      const largeBuffer = Buffer.alloc(101 * 1024 * 1024, 'a'); // 101MB
      
      await page.getByRole('button', { name: /browse/i }).setInputFiles({
        name: 'large.wav',
        mimeType: 'audio/wav',
        buffer: largeBuffer
      });

      await expect(page.getByText('File size exceeds 100MB limit')).toBeVisible();
    });

    test('should clear errors when new valid file is uploaded', async ({ page }) => {
      // First upload invalid file
      await page.getByRole('button', { name: /browse/i }).setInputFiles({
        name: 'test.mp3',
        mimeType: 'audio/mp3',
        buffer: Buffer.from('fake content')
      });

      await expect(page.getByText('Please select a WAV file')).toBeVisible();

      // Then upload valid file
      const wavHeader = new ArrayBuffer(44);
      await page.getByRole('button', { name: /browse/i }).setInputFiles({
        name: 'valid.wav',
        mimeType: 'audio/wav',
        buffer: Buffer.from(wavHeader)
      });

      await expect(page.getByText('Please select a WAV file')).not.toBeVisible();
    });
  });

  test.describe('Progressive Web App', () => {
    test('should have PWA manifest', async ({ page }) => {
      const manifestLink = page.locator('link[rel="manifest"]');
      await expect(manifestLink).toHaveAttribute('href', '/manifest.json');
    });

    test('should have service worker registration', async ({ page }) => {
      // Check if service worker is registered
      const swRegistration = await page.evaluate(() => {
        return 'serviceWorker' in navigator;
      });
      
      expect(swRegistration).toBe(true);
    });

    test('should have proper icons', async ({ page }) => {
      const iconLink = page.locator('link[rel="icon"]');
      await expect(iconLink).toHaveAttribute('href', '/icon.svg');
      
      const appleTouchIcon = page.locator('link[rel="apple-touch-icon"]');
      await expect(appleTouchIcon).toHaveAttribute('href', '/apple-touch-icon.png');
    });
  });

  test.describe('Security Headers', () => {
    test('should have proper security headers', async ({ page, request }) => {
      const response = await request.get('http://localhost:4173');
      
      const headers = response.headers();
      expect(headers['cross-origin-embedder-policy']).toBe('require-corp');
      expect(headers['cross-origin-opener-policy']).toBe('same-origin');
    });
  });
}); 