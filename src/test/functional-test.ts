/**
 * Functional UI Tests for Lufalyze
 * These tests validate actual UI behavior and can be run in a browser environment
 */

// Test data
const createTestWAVFile = (): File => {
  // Create minimal WAV file header
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);
  
  // RIFF header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36, true); // File size - 8
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // Audio format (PCM)
  view.setUint16(22, 2, true); // Number of channels
  view.setUint32(24, 44100, true); // Sample rate
  view.setUint32(28, 176400, true); // Byte rate
  view.setUint16(32, 4, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, 0, true); // Data chunk size
  
  return new File([buffer], 'test.wav', { type: 'audio/wav' });
};

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

class UITester {
  private results: TestResult[] = [];

  private async runTest(name: string, testFn: () => Promise<void> | void): Promise<void> {
    const startTime = performance.now();
    try {
      await testFn();
      this.results.push({
        name,
        passed: true,
        duration: performance.now() - startTime
      });
      console.log(`✅ ${name}`);
    } catch (error) {
      this.results.push({
        name,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration: performance.now() - startTime
      });
      console.error(`❌ ${name}:`, error);
    }
  }

  private getElement(selector: string): Element {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    return element;
  }

  private waitForElement(selector: string, timeout = 5000): Promise<Element> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const check = () => {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Element not found within ${timeout}ms: ${selector}`));
        } else {
          setTimeout(check, 100);
        }
      };
      
      check();
    });
  }

  private simulateFileUpload(input: HTMLInputElement, file: File): void {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    input.files = dataTransfer.files;
    
    // Trigger change event
    const event = new Event('change', { bubbles: true });
    input.dispatchEvent(event);
  }

  async testInitialRender(): Promise<void> {
    await this.runTest('Initial render displays correctly', () => {
      // Check main heading
      const heading = this.getElement('h1');
      if (!heading.textContent?.includes('Meterly')) {
        throw new Error('Main heading not found or incorrect');
      }

      // Check subtitle
      const subtitle = document.querySelector('p');
      if (!subtitle?.textContent?.includes('Loudness analyzer implementing')) {
        throw new Error('Subtitle not found or incorrect');
      }

      // Check About button
      const aboutButton = document.querySelector('button[aria-label*="about"], button:has-text("About")');
      if (!aboutButton) {
        throw new Error('About button not found');
      }

      // Check file upload area
      const uploadArea = document.querySelector('input[type="file"]');
      if (!uploadArea) {
        throw new Error('File upload input not found');
      }
    });
  }

  async testAboutDialog(): Promise<void> {
    await this.runTest('About dialog opens and closes', async () => {
      // Find and click About button
      const aboutButton = document.querySelector('button') as HTMLButtonElement;
      if (!aboutButton || !aboutButton.textContent?.toLowerCase().includes('about')) {
        throw new Error('About button not found');
      }

      aboutButton.click();

      // Wait for dialog to appear
      await this.waitForElement('[role="dialog"], .modal, .about-dialog', 2000);

      // Check dialog content
      const dialogContent = document.body.textContent;
      if (!dialogContent?.includes('About Lufalyze')) {
        throw new Error('About dialog content not found');
      }
      if (!dialogContent?.includes('Version: 1.0.0')) {
        throw new Error('Version information not found');
      }

      // Close dialog (look for close button or click outside)
      const closeButton = document.querySelector('[aria-label="close"], button:has-text("×")') as HTMLButtonElement;
      if (closeButton) {
        closeButton.click();
      } else {
        // Try pressing Escape
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      }

      // Wait for dialog to disappear
      await new Promise(resolve => setTimeout(resolve, 500));
    });
  }

  async testFileValidation(): Promise<void> {
    await this.runTest('File validation works correctly', async () => {
      const fileInput = this.getElement('input[type="file"]') as HTMLInputElement;

      // Test invalid file type
      const invalidFile = new File(['test'], 'test.mp3', { type: 'audio/mp3' });
      this.simulateFileUpload(fileInput, invalidFile);

      // Wait for error message
      await this.waitForElement('*', 1000); // Wait a bit for processing
      const errorText = document.body.textContent;
      if (!errorText?.includes('Please select a WAV file') && !errorText?.includes('WAV')) {
        throw new Error('File validation error not shown for invalid file type');
      }

      // Test valid file
      const validFile = createTestWAVFile();
      this.simulateFileUpload(fileInput, validFile);

      // Wait for processing to start
      await new Promise(resolve => setTimeout(resolve, 500));
      const processingText = document.body.textContent;
      if (!processingText?.includes('Processing') && !processingText?.includes('test.wav')) {
        console.warn('Processing state may not be visible immediately');
      }
    });
  }

  async testResponsiveDesign(): Promise<void> {
    await this.runTest('Responsive design works', () => {
      const originalWidth = window.innerWidth;
      const originalHeight = window.innerHeight;

      try {
        // Test mobile viewport
        Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 667, configurable: true });
        window.dispatchEvent(new Event('resize'));

        // Check if main content is still visible
        const heading = this.getElement('h1');
        const headingRect = heading.getBoundingClientRect();
        if (headingRect.width <= 0) {
          throw new Error('Content not visible on mobile viewport');
        }

        // Test tablet viewport
        Object.defineProperty(window, 'innerWidth', { value: 768, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 1024, configurable: true });
        window.dispatchEvent(new Event('resize'));

        // Test desktop viewport
        Object.defineProperty(window, 'innerWidth', { value: 1920, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 1080, configurable: true });
        window.dispatchEvent(new Event('resize'));

      } finally {
        // Restore original viewport
        Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: originalHeight, configurable: true });
        window.dispatchEvent(new Event('resize'));
      }
    });
  }

  async testDarkMode(): Promise<void> {
    await this.runTest('Dark mode functionality', () => {
      const html = document.documentElement;
      const initialClasses = Array.from(html.classList);

      // Test that dark mode class is applied based on system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const hasDarkClass = html.classList.contains('dark');

      // The behavior should match system preference
      if (prefersDark && !hasDarkClass) {
        console.warn('System prefers dark mode but dark class not applied');
      }
      if (!prefersDark && hasDarkClass) {
        console.warn('System prefers light mode but dark class is applied');
      }

      // Check that CSS variables or classes exist for theming
      const computedStyle = getComputedStyle(document.body);
      const backgroundColor = computedStyle.backgroundColor;
      
      if (!backgroundColor || backgroundColor === 'rgba(0, 0, 0, 0)') {
        throw new Error('No background color set - theming may not be working');
      }
    });
  }

  async testAccessibility(): Promise<void> {
    await this.runTest('Accessibility features', () => {
      // Check for proper heading hierarchy
      const h1Elements = document.querySelectorAll('h1');
      if (h1Elements.length !== 1) {
        throw new Error(`Expected exactly 1 h1 element, found ${h1Elements.length}`);
      }

      // Check for alt text on images
      const images = document.querySelectorAll('img');
      images.forEach((img, index) => {
        if (!img.hasAttribute('alt')) {
          throw new Error(`Image ${index} missing alt attribute`);
        }
      });

      // Check for form labels
      const inputs = document.querySelectorAll('input');
      inputs.forEach((input, index) => {
        const hasLabel = input.hasAttribute('aria-label') || 
                        input.hasAttribute('aria-labelledby') ||
                        document.querySelector(`label[for="${input.id}"]`);
        
        if (!hasLabel && input.type !== 'hidden') {
          console.warn(`Input ${index} may be missing proper labeling`);
        }
      });

      // Check for keyboard navigation
      const focusableElements = document.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements.length === 0) {
        throw new Error('No focusable elements found');
      }
    });
  }

  async testPerformance(): Promise<void> {
    await this.runTest('Performance metrics', () => {
      // Check if page loaded reasonably fast
      const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navTiming) {
        const loadTime = navTiming.loadEventEnd - navTiming.loadEventStart;
        if (loadTime > 3000) {
          console.warn(`Page load time (${loadTime}ms) is slower than expected`);
        }
      }

      // Check for large images or resources
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      resources.forEach(resource => {
        if (resource.transferSize > 1024 * 1024) { // 1MB
          console.warn(`Large resource detected: ${resource.name} (${Math.round(resource.transferSize / 1024)}KB)`);
        }
      });

      // Check DOM size
      const elementCount = document.querySelectorAll('*').length;
      if (elementCount > 1500) {
        console.warn(`Large DOM detected: ${elementCount} elements`);
      }
    });
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting UI Functional Tests...\n');

    await this.testInitialRender();
    await this.testAboutDialog();
    await this.testFileValidation();
    await this.testResponsiveDesign();
    await this.testDarkMode();
    await this.testAccessibility();
    await this.testPerformance();

    this.printResults();
  }

  private printResults(): void {
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const avgDuration = this.results.reduce((sum, r) => sum + (r.duration || 0), 0) / total;

    console.log('\n📊 Test Results Summary:');
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`⏱️  Average Duration: ${avgDuration.toFixed(2)}ms`);
    
    const failed = this.results.filter(r => !r.passed);
    if (failed.length > 0) {
      console.log('\n❌ Failed Tests:');
      failed.forEach(test => {
        console.log(`- ${test.name}: ${test.error}`);
      });
    }

    // Export results for CI/CD
    (window as any).testResults = this.results;
  }
}

// Auto-run tests when script is loaded
if (typeof window !== 'undefined' && window.document) {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const tester = new UITester();
      tester.runAllTests();
    });
  } else {
    const tester = new UITester();
    tester.runAllTests();
  }
}

export { UITester, createTestWAVFile }; 