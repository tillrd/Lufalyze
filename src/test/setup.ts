import '@testing-library/jest-dom';

// Mock Web Workers
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  
  constructor() {}
  
  postMessage(data: any) {
    // Simulate async worker response
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage(new MessageEvent('message', {
          data: {
            type: 'result',
            data: {
              loudness: -14.5,
              loudnessDetailed: {
                momentaryMax: -12.3,
                shortTermMax: -13.1,
                integrated: -14.5
              },
              rms: -18.2,
              validBlocks: 100,
              totalBlocks: 120,
              performance: {
                totalTime: 250,
                kWeightingTime: 50,
                blockProcessingTime: 200
              }
            }
          }
        }));
      }
    }, 100);
  }
  
  terminate() {}
}

// Mock AudioContext
class MockAudioContext {
  sampleRate = 44100;
  
  decodeAudioData(buffer: ArrayBuffer): Promise<AudioBuffer> {
    return Promise.resolve({
      duration: 3.5,
      sampleRate: 44100,
      numberOfChannels: 2,
      length: 154350,
      getChannelData: (channel: number) => new Float32Array(154350).fill(0.1)
    } as AudioBuffer);
  }
}



// Setup global mocks
(global as any).Worker = MockWorker;
(global as any).AudioContext = MockAudioContext;

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: () => Promise.resolve()
  }
});

// Mock URL.createObjectURL
global.URL.createObjectURL = () => 'mocked-url';
global.URL.revokeObjectURL = () => {};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock performance
Object.defineProperty(global, 'performance', {
  value: {
    now: () => Date.now()
  }
});

// Mock console for cleaner test output  
global.console = {
  ...console,
  log: () => {},
  warn: () => {},
  error: () => {}
}; 