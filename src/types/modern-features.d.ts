// Type declarations for modern web features

declare global {
  interface Array<T> {
    findLast(predicate: (value: T, index: number, array: T[]) => boolean): T | undefined;
    findLastIndex(predicate: (value: T, index: number, array: T[]) => boolean): number;
    at(index: number): T | undefined;
  }

  interface String {
    isWellFormed(): boolean;
    toWellFormed(): string;
  }

  interface URLConstructor {
    canParse(url: string, base?: string): boolean;
  }

  interface PromiseConstructor {
    try<T>(fn: () => T | Promise<T>): Promise<T>;
  }

  interface ClipboardItemConstructor {
    supports(type: string): boolean;
  }

  interface Navigator {
    wakeLock?: {
      request(type: 'screen'): Promise<WakeLockSentinel>;
    };
    userActivation?: {
      isActive: boolean;
      hasBeenActive: boolean;
    };
  }

  interface WakeLockSentinel {
    released: boolean;
    type: string;
    release(): Promise<void>;
  }

  interface Window {
    visualViewport?: {
      height: number;
      width: number;
      offsetLeft: number;
      offsetTop: number;
      pageLeft: number;
      pageTop: number;
      scale: number;
      addEventListener(type: string, listener: EventListener): void;
      removeEventListener(type: string, listener: EventListener): void;
    };
    Float16Array?: any;
  }

  interface Document {
    requestStorageAccess?(): Promise<void>;
    hasStorageAccess?(): Promise<boolean>;
  }

  interface HTMLElement {
    popover?: string;
    showPopover?(): void;
    hidePopover?(): void;
    togglePopover?(force?: boolean): void;
  }

  interface HTMLVideoElement {
    requestVideoFrameCallback?(callback: (time: number, metadata: any) => void): number;
    cancelVideoFrameCallback?(handle: number): void;
  }

  namespace Intl {
    interface DurationFormat {
      new (locale?: string, options?: any): DurationFormat;
      format(duration: any): string;
    }
    const DurationFormat: {
      new (locale?: string, options?: any): DurationFormat;
    };
  }
}

export {}; 