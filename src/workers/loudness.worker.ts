/// <reference lib="webworker" />

// WASM analyzer instance
let analyzer: any = null;
let wasmInit: any = null;

async function initWasm() {
  if (!analyzer) {
    // @ts-ignore
    let mod: any;
    if (typeof self === 'undefined') {
      // Node.js: use nodejs build output
      mod = await import('../../loudness-wasm/pkg/loudness_wasm.js');
      console.log('Node.js WASM module loaded');
      analyzer = new mod.LoudnessAnalyzer(2); // Initialize with number of channels
      console.log('Analyzer created');
    } else {
      // Browser: use web build output
      try {
        // Load WASM using fetch and WebAssembly.instantiate
        const wasmPath = '/loudness_wasm_bg.wasm';
        console.log('Loading WASM from:', wasmPath);
        
        const wasmResponse = await fetch(wasmPath);
        if (!wasmResponse.ok) {
          throw new Error(`Failed to fetch WASM: ${wasmResponse.status} ${wasmResponse.statusText}`);
        }
        
        const wasmBytes = await wasmResponse.arrayBuffer();
        console.log('WASM bytes loaded:', wasmBytes.byteLength);
        
        // For now, let's create a mock analyzer that returns test data
        // This will help us verify the worker pipeline works
        analyzer = {
          analyze: (pcm: Float32Array) => {
            console.log('Mock analyzer processing', pcm.length, 'samples');
            // Return mock results that match the expected structure
            return {
              momentary: -23.0,
              shortTerm: -23.0, 
              integrated: -23.0,
              rel_gated_blocks: 100,
              totalBlocks: 120
            };
          }
        };
        
        console.log('Mock WASM analyzer initialized');
      } catch (error) {
        console.error('Failed to load WASM module:', error);
        throw new Error('WASM module failed to load. Please ensure the build process completed successfully.');
      }
    }
  }
}

// Constants for ITU-R BS.1770-4
const K_WEIGHTING = [1.0, 1.0, 1.0, 1.41, 1.41];
const G = 1.0;
const LOWER_BOUND = -70.0;
const UPPER_BOUND = -10.0;
const INTEGRATION_TIME = 0.4; // seconds
const BLOCK_SIZE = 0.1; // seconds
const OVERLAP = 0.75; // 75% overlap between blocks

interface WorkerAPI {
  analyze(pcm: Float32Array, sampleRate: number): Promise<{
    loudness: number;
    loudnessDetailed: {
      momentaryMax: number;
      shortTermMax: number;
      integrated: number;
    };
    rms: number;
    validBlocks: number;
    totalBlocks: number;
    performance: {
      totalTime: number;
      kWeightingTime: number;
      blockProcessingTime: number;
    };
  }>;
}

// Pre-emphasis filter coefficients for K-weighting
const K_WEIGHTING_COEFFS = {
  b: [1.0, -1.69065929318241, 0.73248077421585],
  a: [1.0, -1.99004745483398, 0.99007225036621]
};

function applyKWeighting(samples: Float32Array): Float32Array {
  const result = new Float32Array(samples.length);
  const b = K_WEIGHTING_COEFFS.b;
  const a = K_WEIGHTING_COEFFS.a;
  
  // Apply pre-emphasis filter
  for (let i = 0; i < samples.length; i++) {
    let sum = 0;
    for (let j = 0; j < b.length; j++) {
      if (i - j >= 0) {
        sum += b[j] * samples[i - j];
      }
    }
    for (let j = 1; j < a.length; j++) {
      if (i - j >= 0) {
        sum -= a[j] * result[i - j];
      }
    }
    result[i] = sum;
  }
  
  return result;
}

function calculateBlockLoudness(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sum / samples.length);
  return 20 * Math.log10(rms);
}

const api: WorkerAPI = {
  async analyze(pcm: Float32Array, sampleRate: number) {
    const startTime = performance.now();
      
    // Initialize WASM if not already done
    await initWasm();
    console.log('WASM initialized, analyzing audio...');
      
    // Analyze audio using WASM
    const wasmResult = analyzer.analyze(pcm);
    console.log('Analysis complete, WASM result:', wasmResult);
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Map WASM result to expected interface
    const result = {
      loudness: wasmResult.integrated || 0,
      loudnessDetailed: {
        momentaryMax: wasmResult.momentary || 0,
        shortTermMax: wasmResult.shortTerm || 0,
        integrated: wasmResult.integrated || 0
      },
      rms: wasmResult.integrated || 0, // Use integrated as RMS approximation for now
      validBlocks: wasmResult.rel_gated_blocks || 0,
      totalBlocks: wasmResult.totalBlocks || 0,
      performance: {
        totalTime,
        kWeightingTime: 0, // Now handled in WASM
        blockProcessingTime: totalTime // All processing done in WASM
      }
    };

    console.log('Mapped result:', result);
    return result;
  }
};

// Handle messages in both browser and Node.js environments
function postMessageCompat(message: any) {
  if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
    self.postMessage(message);
  } else if (typeof globalThis !== 'undefined' && (globalThis as any).parentPort) {
    (globalThis as any).parentPort.postMessage(message);
  }
}

if (typeof self !== 'undefined') {
  // Browser environment
  self.onmessage = async (e: MessageEvent) => {
    try {
      console.log('Worker: Received message');
      const { pcm, sampleRate } = e.data as { pcm: Float32Array; sampleRate: number };
      
      // Send progress message
      postMessageCompat({ type: 'progress', data: 50 });
      
      const result = await api.analyze(pcm, sampleRate);
      console.log('Worker: Sending result back');
      
      // Send properly structured result message
      postMessageCompat({ type: 'result', data: result });
    } catch (error: unknown) {
      console.error('Worker: Error processing message', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      postMessageCompat({ type: 'error', data: errorMessage });
    }
  };
} else if (typeof globalThis !== 'undefined' && (globalThis as any).process?.versions?.node) {
  // Node.js environment
  (async () => {
  const { parentPort } = await import('worker_threads');
  if (parentPort) {
      (globalThis as any).parentPort = parentPort;
    parentPort.on('message', async (data: { pcm: Float32Array; sampleRate: number }) => {
      try {
        console.log('Worker: Received message');
        
        // Send progress message
        postMessageCompat({ type: 'progress', data: 50 });
        
        const result = await api.analyze(data.pcm, data.sampleRate);
        console.log('Worker: Sending result back');
        
        // Send properly structured result message
        postMessageCompat({ type: 'result', data: result });
      } catch (error: unknown) {
        console.error('Worker: Error processing message', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        postMessageCompat({ type: 'error', data: errorMessage });
      }
    });
  }
  })();
}

// Make this file a module
export {}; 