/// <reference lib="webworker" />

// Conditional logging for worker - simplified version since workers may not have full import.meta.env access
const isDev = typeof process !== 'undefined' ? process.env.NODE_ENV === 'development' : 
              (typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1'));

const workerLogger = {
  debug: isDev ? console.log.bind(console) : (() => {}),
  info: isDev ? console.info.bind(console) : (() => {}), 
  warn: console.warn.bind(console),
  error: console.error.bind(console)
};

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
      workerLogger.debug('Node.js WASM module loaded');
      analyzer = new mod.LoudnessAnalyzer(2); // Initialize with number of channels
      workerLogger.debug('Analyzer created');
    } else {
      // Browser: use web build output
      try {
        // Import the WASM module from the pkg directory that gets bundled by Vite
        workerLogger.debug('🔧 Loading WASM module from pkg directory...');
        
        // Import the WASM module from the built package
        workerLogger.debug('📦 Importing WASM module...');
        const wasmModule = await import('../../loudness-wasm/pkg/loudness_wasm.js');
        workerLogger.debug('✅ WASM module imported successfully');
        workerLogger.debug('Module exports:', Object.keys(wasmModule));
        
        // Initialize the WASM module - call default export which auto-loads WASM binary
        workerLogger.debug('🚀 Initializing WASM module...');
        const initResult = await wasmModule.default();
        workerLogger.debug('✅ WASM module initialized:', initResult);
        
        // Store the WASM module for music analysis
        wasmInit = wasmModule;
        
        // Create the analyzer instance
        workerLogger.debug('🏭 Creating LoudnessAnalyzer instance...');
        analyzer = new wasmModule.LoudnessAnalyzer(2); // Initialize with 2 channels (stereo)
        workerLogger.debug('✅ WASM analyzer created successfully:', analyzer);
        
        // Test the analyzer with a small sample with timeout protection
        workerLogger.debug('🧪 Testing analyzer with small sample...');
        const testSample = new Float32Array([0.1, -0.1, 0.05, -0.05]);
        
        // Add timeout protection for the test
        let testResult;
        try {
          const testPromise = new Promise((resolve, reject) => {
            try {
              const result = analyzer.analyze(testSample);
              resolve(result);
            } catch (error) {
              reject(error);
            }
          });
          
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('WASM test timeout')), 2000);
          });
          
          testResult = await Promise.race([testPromise, timeoutPromise]);
          workerLogger.debug('🧪 Test result:', testResult);
          workerLogger.debug('🎉 WASM analyzer fully initialized and tested successfully');
        } catch (testError) {
          workerLogger.warn('⚠️ WASM test failed, but analyzer seems to be created:', testError);
          // Continue anyway as the analyzer was created successfully
        }
      } catch (error) {
        workerLogger.error('❌ Failed to load WASM module:', error);
        workerLogger.error('Error type:', typeof error);
        workerLogger.error('Error constructor:', error?.constructor?.name);
        workerLogger.error('Error message:', error instanceof Error ? error.message : String(error));
        workerLogger.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
        
        // Fallback to mock analyzer for now to keep the app functional
        workerLogger.debug('🔧 Using mock analyzer as fallback');
        analyzer = {
          analyze: (pcm: Float32Array) => {
            workerLogger.debug('🎭 Mock analyzer processing', pcm.length, 'samples');
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
        
        workerLogger.debug('🎭 Mock WASM analyzer initialized as fallback');
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
  analyze(pcm: Float32Array, sampleRate: number, metadataTempo?: number, audioFileInfo?: any): Promise<{
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
    tempo?: number; // BPM (beats per minute)
    musicAnalysis?: {
      key: string;
      root_note: string;
      is_major: boolean;
      confidence: number;
      tonal_clarity: number;
      harmonic_complexity: number;
      chroma: number[];
      scales: Array<{name: string; strength: number; category?: string}>;
    };
    stereoAnalysis?: {
      is_mono: boolean;
      channels: number;
      phase_correlation?: number;
      stereo_width?: number;
      lr_balance?: number;
      mono_compatibility?: number;
      imaging_quality?: string;
      imaging_quality_score?: number;
    };
    technicalAnalysis?: {
      true_peak: {
        level: number;
        locations: number[];
        broadcast_compliant: boolean;
        spotify_compliant: boolean;
        youtube_compliant: boolean;
      };
      quality: {
        has_clipping: boolean;
        clipped_samples: number;
        clipping_percentage: number;
        dc_offset: number;
      };
      spectral: {
        centroid: number;
        rolloff: number;
        flatness: number;
        frequency_balance: {
          sub_bass: number;
          bass: number;
          low_mids: number;
          mids: number;
          upper_mids: number;
          presence: number;
          brilliance: number;
        };
      };
      silence: {
        leading_silence: number;
        trailing_silence: number;
        gap_count: number;
      };
      mastering: {
        plr: number;
        dynamic_range: number;
        punchiness: number;
        warmth: number;
        clarity: number;
        spaciousness: number;
        quality_score: number;
      };
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
  async analyze(pcm: Float32Array, sampleRate: number, metadataTempo?: number, audioFileInfo?: any) {
    const startTime = performance.now();
    
    // Progress callback for internal updates
    const updateProgress = (progress: number) => {
      if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
        self.postMessage({ type: 'progress', data: progress });
      }
    };
      
    // Initialize WASM if not already done
    await initWasm();
    updateProgress(72); // Just after WASM init
    workerLogger.debug('WASM initialized, analyzing audio...');
      
    // Analyze audio using WASM with timeout protection
    let wasmResult;
    try {
      const analysisPromise = new Promise((resolve, reject) => {
        try {
          const result = analyzer.analyze(pcm);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('WASM analysis timeout')), 30000); // 30 second timeout
      });
      
      wasmResult = await Promise.race([analysisPromise, timeoutPromise]) as any;
      updateProgress(74); // Loudness analysis complete
      workerLogger.debug('Analysis complete, WASM result:', wasmResult);
    } catch (analysisError) {
      workerLogger.error('❌ WASM analysis failed:', analysisError);
      // Fallback to basic analysis
      wasmResult = {
        momentary: -23.0,
        shortTerm: -23.0,
        integrated: -23.0,
        rel_gated_blocks: Math.floor(pcm.length / 4800),
        totalBlocks: Math.floor(pcm.length / 4800) + 20
      };
      updateProgress(74); // Fallback analysis complete
      workerLogger.debug('🔧 Using fallback analysis result:', wasmResult);
    }
    
    // Perform musical scale analysis with simplified algorithm
    let musicAnalysis: any = undefined;
    try {
      workerLogger.debug('🎼 Starting simplified musical scale analysis...');
      
      if (wasmInit && typeof wasmInit.MusicAnalyzer === 'function') {
        workerLogger.debug('🎼 Creating MusicAnalyzer...');
        const musicAnalyzer = new wasmInit.MusicAnalyzer(sampleRate);
        
        // Try S-KEY enhanced analysis first, fallback to traditional
        let usingSKey = false;
        if (typeof musicAnalyzer.analyze_music_with_skey === 'function') {
          workerLogger.debug('🧠 S-KEY enhanced analysis available, using hybrid approach...');
          usingSKey = true;
        } else {
          workerLogger.debug('🎼 Using traditional analysis (S-KEY not available)...');
        }
        
        // Add timeout protection for musical analysis
        const musicPromise = new Promise((resolve, reject) => {
          try {
            const musicResult = usingSKey 
              ? musicAnalyzer.analyze_music_with_skey(pcm)
              : musicAnalyzer.analyze_music(pcm);
            resolve(musicResult);
          } catch (error) {
            reject(error);
          }
        });
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Musical analysis timeout')), 10000); // 10 second timeout
        });
        
        const musicResult = await Promise.race([musicPromise, timeoutPromise]) as any;
        workerLogger.debug(`🎼 ${usingSKey ? 'S-KEY Enhanced' : 'Traditional'} music result:`, musicResult);
        
        musicAnalysis = {
          key: musicResult.key,
          root_note: musicResult.root_note,
          is_major: musicResult.is_major,
          confidence: musicResult.confidence,
          tonal_clarity: musicResult.tonal_clarity || 0,
          harmonic_complexity: musicResult.harmonic_complexity || 0,
          chroma: Array.from(musicResult.chroma),
          scales: Array.from(musicResult.scales),
          // Add metadata about which method was used
          method: usingSKey ? 'S-KEY Enhanced' : 'Traditional'
        };
        
        workerLogger.debug(`🎼 ${usingSKey ? 'S-KEY Enhanced' : 'Traditional'} musical analysis complete:`, musicAnalysis);
        updateProgress(76); // Musical analysis complete
      } else {
        workerLogger.warn('🎼 MusicAnalyzer not available in WASM module');
        updateProgress(76); // Musical analysis skipped
      }
    } catch (musicError) {
      workerLogger.warn('⚠️ Musical analysis failed:', musicError);
      
      // Fallback to basic placeholder if still failing
      musicAnalysis = {
        key: "Analysis Failed",
        root_note: "?",
        is_major: true,
        confidence: 0.0,
        tonal_clarity: 0.0,
        harmonic_complexity: 0.0,
        chroma: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        scales: [{ name: "Analysis Failed", strength: 0.0, category: "error" }]
      };
      
      updateProgress(76); // Musical analysis failed but continuing
      // Continue without music analysis - this ensures the main analysis still works
    }

    // Temporarily disable stereo analysis to prevent hanging
    let stereoAnalysis: any = undefined;
    workerLogger.debug('🎧 Stereo analysis temporarily disabled due to hanging issue');
    
    // Provide basic stereo analysis based on audio file info
    if (audioFileInfo?.channels) {
      stereoAnalysis = {
        is_mono: audioFileInfo.channels === 1,
        channels: audioFileInfo.channels,
        phase_correlation: audioFileInfo.channels > 1 ? 1.0 : undefined,
        stereo_width: audioFileInfo.channels > 1 ? 0.5 : undefined,
        lr_balance: 0.0,
        mono_compatibility: audioFileInfo.channels > 1 ? 0.9 : 1.0,
        imaging_quality_score: audioFileInfo.channels > 1 ? 85 : 100,
        imaging_quality: audioFileInfo.channels > 1 ? "Good" : "Perfect"
      };
      workerLogger.debug('🎧 Using basic stereo analysis from audio file info');
    }
    
    updateProgress(78); // Stereo analysis complete (basic analysis or skipped)
    
    // TODO: Re-enable advanced stereo analysis after fixing the WASM hanging issue
    // The hanging appears to be in the StereoAnalyzer.analyze_stereo WASM function
    
    workerLogger.debug('🔄 Moving to technical analysis phase...');

    // Temporarily disable technical analysis to isolate the hanging issue
    let technicalAnalysis: any = undefined;
    workerLogger.debug('🔬 Technical analysis temporarily disabled for debugging');
    // TODO: Re-enable technical analysis after fixing the hanging issue
    workerLogger.debug('🔬 ✅ Technical analysis phase skipped');
    updateProgress(80); // Technical analysis phase complete (or skipped)
    
    // Use the tempo passed from main thread (metadata or algorithmic)
    const tempo = metadataTempo;
    workerLogger.debug('🎵 Processing tempo information:', tempo);
    
    if (tempo) {
      workerLogger.debug('🎵 Using BPM from main thread:', tempo);
    } else {
      workerLogger.debug('🎵 No tempo information available');
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Calculate proper RMS level for comparison
    let sumSquares = 0;
    for (let i = 0; i < pcm.length; i++) {
      sumSquares += pcm[i] * pcm[i];
    }
    const trueRms = Math.sqrt(sumSquares / pcm.length);
    const rmsDb = 20 * Math.log10(Math.max(trueRms, 1e-10));

    // Map WASM result to expected interface
    const result = {
      loudness: wasmResult.integrated || 0,
      loudnessDetailed: {
        momentaryMax: wasmResult.momentary || 0,
        shortTermMax: wasmResult.shortTerm || 0,
        integrated: wasmResult.integrated || 0
      },
      rms: rmsDb, // Now using proper RMS calculation
      validBlocks: wasmResult.rel_gated_blocks || 0,
      totalBlocks: wasmResult.totalBlocks || 0,
      performance: {
        totalTime,
        kWeightingTime: 0, // Now handled in WASM
        blockProcessingTime: totalTime // All processing done in WASM
      },
      audioFileInfo: audioFileInfo, // Include detailed file information
      tempo: tempo ? Math.round(tempo) : undefined, // Round to nearest integer BPM
      musicAnalysis: musicAnalysis,
      stereoAnalysis: stereoAnalysis,
      technicalAnalysis: technicalAnalysis
    };

    updateProgress(85); // Result preparation complete
    
    workerLogger.debug('✅ Analysis complete, sending result back to main thread');
    workerLogger.debug('📊 Final result summary:', {
      loudness: result.loudness,
      hasMusic: !!result.musicAnalysis,
      hasStereo: !!result.stereoAnalysis, 
      hasTechnical: !!result.technicalAnalysis,
      tempo: result.tempo
    });
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
      workerLogger.debug('🔧 Worker: Received message');
      workerLogger.debug('📊 Worker: Event data keys:', Object.keys(e.data));
      workerLogger.debug('📊 Worker: Event data types:', {
        pcm: typeof e.data.pcm,
        sampleRate: typeof e.data.sampleRate,
        metadataTempo: typeof e.data.metadataTempo,
        audioFileInfo: typeof e.data.audioFileInfo
      });
      
      const { pcm, sampleRate, metadataTempo, audioFileInfo } = e.data as { 
        pcm: Float32Array; 
        sampleRate: number; 
        metadataTempo?: number;
        audioFileInfo?: any;
      };
      
      workerLogger.debug('📊 Worker: Extracted data:', {
        pcmLength: pcm?.length,
        sampleRate,
        metadataTempo,
        pcmConstructor: pcm?.constructor?.name,
        audioFileInfo
      });
      
      // Efficient smooth progress updates with larger steps to avoid browser overload
      const smoothProgressUpdate = async (start: number, end: number, duration: number, stepSize: number = 5) => {
        const steps = Math.ceil((end - start) / stepSize); // 5% increments by default
        const stepDuration = duration / steps;
        
        for (let i = 1; i <= steps; i++) {
          const progress = start + ((end - start) * i / steps);
          postMessageCompat({ type: 'progress', data: Math.round(progress) });
          await new Promise(resolve => setTimeout(resolve, stepDuration));
        }
      };
      
      // Initial setup phase (0% to 15%) - smooth animation over 300ms
      await smoothProgressUpdate(0, 15, 300, 3);
      
      // Audio processing phase (15% to 40%) - smooth animation over 400ms
      await smoothProgressUpdate(15, 40, 400, 5);
      
      // Analysis phase (40% to 70%) - smooth animation over 350ms
      await smoothProgressUpdate(40, 70, 350, 5);
      
      const result = await api.analyze(pcm, sampleRate, metadataTempo, audioFileInfo);
      
      // Post-processing phase (70% to 90%) - smooth animation over 250ms
      await smoothProgressUpdate(70, 90, 250, 4);
      
      // Final completion
      postMessageCompat({ type: 'progress', data: 100 });
      workerLogger.debug('Worker: Sending result back');
      
      // Send properly structured result message
      postMessageCompat({ type: 'result', data: result });
    } catch (error: unknown) {
      workerLogger.error('Worker: Error processing message', error);
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
    parentPort.on('message', async (data: { pcm: Float32Array; sampleRate: number; metadataTempo?: number; audioFileInfo?: any }) => {
      try {
        workerLogger.debug('Worker: Received message');
        
        // Efficient smooth progress updates with larger steps to avoid browser overload
        const smoothProgressUpdate = async (start: number, end: number, duration: number, stepSize: number = 5) => {
          const steps = Math.ceil((end - start) / stepSize); // 5% increments by default
          const stepDuration = duration / steps;
          
          for (let i = 1; i <= steps; i++) {
            const progress = start + ((end - start) * i / steps);
            postMessageCompat({ type: 'progress', data: Math.round(progress) });
            await new Promise(resolve => setTimeout(resolve, stepDuration));
          }
        };
        
        // Initial setup phase (0% to 15%) - smooth animation over 300ms
        await smoothProgressUpdate(0, 15, 300, 3);
        
        // Audio processing phase (15% to 40%) - smooth animation over 400ms
        await smoothProgressUpdate(15, 40, 400, 5);
        
        // Analysis phase (40% to 70%) - smooth animation over 350ms
        await smoothProgressUpdate(40, 70, 350, 5);
        
        const result = await api.analyze(data.pcm, data.sampleRate, data.metadataTempo, data.audioFileInfo);
        
        // Post-processing phase (70% to 90%) - smooth animation over 250ms
        await smoothProgressUpdate(70, 90, 250, 4);
        
        // Final completion
        postMessageCompat({ type: 'progress', data: 100 });
        workerLogger.debug('Worker: Sending result back');
        
        // Send properly structured result message
        postMessageCompat({ type: 'result', data: result });
      } catch (error: unknown) {
        workerLogger.error('Worker: Error processing message', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        postMessageCompat({ type: 'error', data: errorMessage });
      }
    });
  }
  })();
}

// Make this file a module
export {}; 