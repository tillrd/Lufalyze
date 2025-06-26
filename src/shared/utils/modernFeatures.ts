/**
 * Modern Web Technologies Implementation
 * Implements various modern browser features while maintaining compatibility
 */

// Modern JavaScript: Iterator methods for arrays
export const useIteratorMethods = () => {
  // Array.prototype.findLast() and findLastIndex() polyfill for older browsers
  if (!(Array.prototype as any).findLast) {
    (Array.prototype as any).findLast = function<T>(this: T[], predicate: (value: T, index: number, array: T[]) => boolean): T | undefined {
      for (let i = this.length - 1; i >= 0; i--) {
        if (predicate(this[i], i, this)) {
          return this[i];
        }
      }
      return undefined;
    };
  }

  if (!(Array.prototype as any).findLastIndex) {
    (Array.prototype as any).findLastIndex = function<T>(this: T[], predicate: (value: T, index: number, array: T[]) => boolean): number {
      for (let i = this.length - 1; i >= 0; i--) {
        if (predicate(this[i], i, this)) {
          return i;
        }
      }
      return -1;
    };
  }

  // Array.prototype.at() polyfill
  if (!(Array.prototype as any).at) {
    (Array.prototype as any).at = function<T>(this: T[], index: number): T | undefined {
      const len = this.length;
      const relativeIndex = index < 0 ? len + index : index;
      return (relativeIndex >= 0 && relativeIndex < len) ? this[relativeIndex] : undefined;
    };
  }
};

// Modern JavaScript: String methods
export const useStringMethods = () => {
  // String.prototype.isWellFormed() and toWellFormed() polyfill
  if (!(String.prototype as any).isWellFormed) {
    (String.prototype as any).isWellFormed = function(this: string): boolean {
      try {
        encodeURIComponent(this);
        return true;
      } catch {
        return false;
      }
    };
  }

  if (!(String.prototype as any).toWellFormed) {
    (String.prototype as any).toWellFormed = function(this: string): string {
      return this.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD');
    };
  }
};

// Modern JavaScript: URL.canParse() polyfill
export const canParseURL = (url: string, base?: string): boolean => {
  if ('canParse' in URL && typeof URL.canParse === 'function') {
    return URL.canParse(url, base);
  }
  
  // Polyfill implementation
  try {
    new URL(url, base);
    return true;
  } catch {
    return false;
  }
};

// Modern JavaScript: Promise.try() polyfill
export const PromiseTry = <T>(fn: () => T | Promise<T>): Promise<T> => {
  if ('try' in Promise && typeof (Promise as any).try === 'function') {
    return (Promise as any).try(fn);
  }
  
  // Polyfill implementation
  return new Promise((resolve) => resolve(fn()));
};

// Modern JavaScript: ClipboardItem.supports() detection
export const clipboardSupportsType = async (type: string): Promise<boolean> => {
  if ('ClipboardItem' in window && 'supports' in ClipboardItem) {
    return ClipboardItem.supports(type);
  }
  
  // Basic fallback detection
  if ('clipboard' in navigator && 'write' in navigator.clipboard) {
    try {
      const testItem = new ClipboardItem({ [type]: new Blob(['test'], { type }) });
      return true;
    } catch {
      return false;
    }
  }
  
  return false;
};

// Modern JavaScript: Float16Array detection and polyfill
export const supportsFloat16Array = (): boolean => {
  return 'Float16Array' in window;
};

// Modern Browser API: Screen Wake Lock
export class ScreenWakeLock {
  private wakeLock: WakeLockSentinel | null = null;

  async request(): Promise<boolean> {
    if ('wakeLock' in navigator && navigator.wakeLock) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        return true;
      } catch (error) {
        console.warn('Screen Wake Lock failed:', error);
        return false;
      }
    }
    return false;
  }

  async release(): Promise<void> {
    if (this.wakeLock) {
      await this.wakeLock.release();
      this.wakeLock = null;
    }
  }

  get active(): boolean {
    return this.wakeLock !== null && !this.wakeLock.released;
  }
}

// Modern Browser API: Visual Viewport API
export class VisualViewportManager {
  private callbacks: Map<string, (event: Event) => void> = new Map();

  constructor() {
    if ('visualViewport' in window) {
      this.setupListeners();
    }
  }

  private setupListeners() {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = (event: Event) => {
      this.callbacks.forEach(callback => callback(event));
    };

    viewport.addEventListener('resize', handleResize);
    viewport.addEventListener('scroll', handleResize);
  }

  onViewportChange(id: string, callback: (event: Event) => void) {
    this.callbacks.set(id, callback);
  }

  removeListener(id: string) {
    this.callbacks.delete(id);
  }

  get viewport() {
    return window.visualViewport;
  }

  get height(): number {
    return window.visualViewport?.height || window.innerHeight;
  }

  get width(): number {
    return window.visualViewport?.width || window.innerWidth;
  }
}

// Modern Browser API: Storage Access API
export class StorageAccessManager {
  async requestAccess(): Promise<boolean> {
    if ('requestStorageAccess' in document && document.requestStorageAccess) {
      try {
        await document.requestStorageAccess();
        return true;
      } catch (error) {
        console.warn('Storage access request failed:', error);
        return false;
      }
    }
    return false;
  }

  async hasAccess(): Promise<boolean> {
    if ('hasStorageAccess' in document && document.hasStorageAccess) {
      return await document.hasStorageAccess();
    }
    return true; // Assume access if API not available
  }
}

// Modern Browser API: User Activation
export const hasUserActivation = (): boolean => {
  if ('userActivation' in navigator) {
    return navigator.userActivation.isActive;
  }
  return false; // Conservative fallback
};

// Modern JavaScript: Intl.DurationFormat polyfill
export class DurationFormatter {
  private static supported = 'DurationFormat' in Intl;

  static format(duration: { hours?: number; minutes?: number; seconds?: number }, options: any = {}): string {
    if (this.supported) {
      return new (Intl as any).DurationFormat(options.locale || 'en', options).format(duration);
    }

    // Polyfill implementation
    const { hours = 0, minutes = 0, seconds = 0 } = duration;
    const parts: string[] = [];

    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${Math.round(seconds)}s`);

    return parts.join(' ') || '0s';
  }

  static isSupported(): boolean {
    return this.supported;
  }
}

// Modern Browser API: Navigation Timing
export const getNavigationTiming = () => {
  if ('getEntriesByType' in performance) {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        load: navigation.loadEventEnd - navigation.loadEventStart,
        total: navigation.loadEventEnd - navigation.fetchStart,
        dns: navigation.domainLookupEnd - navigation.domainLookupStart,
        tcp: navigation.connectEnd - navigation.connectStart,
        request: navigation.responseStart - navigation.requestStart,
        response: navigation.responseEnd - navigation.responseStart,
        domInteractive: navigation.domInteractive - navigation.fetchStart,
      };
    }
  }
  return null;
};

// Modern Browser API: requestVideoFrameCallback detection
export const supportsRequestVideoFrameCallback = (): boolean => {
  const video = document.createElement('video');
  return 'requestVideoFrameCallback' in video;
};

// Modern Browser API: Lazy loading detection
export const supportsLazyLoading = (): boolean => {
  return 'loading' in HTMLImageElement.prototype;
};

// Modern HTML: Popover API utilities
export class PopoverManager {
  static isSupported(): boolean {
    return 'popover' in HTMLElement.prototype;
  }

  static show(element: HTMLElement): boolean {
    if ('showPopover' in element) {
      try {
        (element as any).showPopover();
        return true;
      } catch (error) {
        console.warn('Popover show failed:', error);
        return false;
      }
    }
    return false;
  }

  static hide(element: HTMLElement): boolean {
    if ('hidePopover' in element) {
      try {
        (element as any).hidePopover();
        return true;
      } catch (error) {
        console.warn('Popover hide failed:', error);
        return false;
      }
    }
    return false;
  }

  static toggle(element: HTMLElement): boolean {
    if ('togglePopover' in element) {
      try {
        (element as any).togglePopover();
        return true;
      } catch (error) {
        console.warn('Popover toggle failed:', error);
        return false;
      }
    }
    return false;
  }
}

// Feature detection summary
export const getModernFeatureSupport = () => {
  return {
    // CSS Features
    cssNesting: CSS.supports('selector(&)'),
    hasSelector: CSS.supports('selector(:has(*))'),
    startingStyle: CSS.supports('@starting-style'),
    textWrap: CSS.supports('text-wrap', 'balance'),
    aspectRatio: CSS.supports('aspect-ratio', '1'),
    backdropFilter: CSS.supports('backdrop-filter', 'blur(1px)'),
    overscrollBehavior: CSS.supports('overscroll-behavior', 'contain'),
    scrollbarGutter: CSS.supports('scrollbar-gutter', 'stable'),
    transitionBehavior: CSS.supports('transition-behavior', 'allow-discrete'),
    containerQueries: CSS.supports('@container'),
    
    // JavaScript Features
    iteratorMethods: 'findLast' in Array.prototype,
    stringMethods: 'isWellFormed' in String.prototype,
    urlCanParse: 'canParse' in URL,
    promiseTry: 'try' in Promise,
    float16Array: supportsFloat16Array(),
    
    // Browser APIs
    wakeLock: 'wakeLock' in navigator,
    visualViewport: 'visualViewport' in window,
    storageAccess: 'requestStorageAccess' in document,
    userActivation: 'userActivation' in navigator,
    clipboardItem: 'ClipboardItem' in window,
    requestVideoFrameCallback: supportsRequestVideoFrameCallback(),
    lazyLoading: supportsLazyLoading(),
    popover: PopoverManager.isSupported(),
    
    // Intl APIs
    durationFormat: DurationFormatter.isSupported(),
    
    // Performance APIs
    navigationTiming: 'getEntriesByType' in performance,
  };
};

// Initialize polyfills
export const initializeModernFeatures = () => {
  useIteratorMethods();
  useStringMethods();
  
  console.log('🚀 Modern web features initialized:', getModernFeatureSupport());
}; 