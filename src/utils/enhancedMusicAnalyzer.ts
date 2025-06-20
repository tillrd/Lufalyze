/**
 * Enhanced Music Analyzer with S-KEY + WASM Integration
 * Combines traditional WASM key detection with TensorFlow.js S-KEY neural network
 */

// @ts-ignore - TensorFlow.js types
import * as tf from '@tensorflow/tfjs';
// @ts-ignore - TensorFlow.js WASM backend
import '@tensorflow/tfjs-backend-wasm';

// Interfaces for type safety
interface MusicAnalysisResult {
  key: string;
  root_note: string;
  is_major: boolean;
  confidence: number;
  method: string;
  enhanced: boolean;
  traditional_confidence?: number;
  tonal_clarity: number;
  harmonic_complexity: number;
  chroma: number[];
  scales: Array<{
    name: string;
    strength: number;
    category: string;
  }>;
}

interface BenchmarkResult {
  traditional: {
    key: string;
    confidence: number;
    time_ms: number;
  };
  skey: {
    key?: string;
    confidence?: number;
    available: boolean;
    time_ms: number;
  };
}

interface SKEYFeatures {
  chroma: number[];
  spectral_centroid: number;
  zero_crossing_rate: number;
  rms_energy: number;
}

export class EnhancedMusicAnalyzer {
  private wasmAnalyzer: any;
  private skeyModel: tf.LayersModel | null = null;
  private isInitialized = false;
  private initializePromise: Promise<void> | null = null;
  private skeyEnabled = true;
  private sampleRate: number;

  constructor(sampleRate: number = 44100) {
    this.sampleRate = sampleRate;
  }

  /**
   * Initialize both WASM and S-KEY systems
   */
  async initialize(): Promise<void> {
    if (this.initializePromise) {
      return this.initializePromise;
    }

    this.initializePromise = this._doInitialize();
    return this.initializePromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      // Initialize WASM analyzer
      await this.initializeWasm();
      
      // Try to initialize S-KEY (graceful fallback)
      try {
        await this.initializeSKEY();
      } catch (error) {
        console.warn('⚠️ S-KEY initialization failed, using traditional algorithm only:', error);
        this.skeyEnabled = false;
      }

      this.isInitialized = true;
      console.log('✅ Enhanced Music Analyzer initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced Music Analyzer:', error);
      throw error;
    }
  }

  /**
   * Initialize WASM module
   */
     private async initializeWasm(): Promise<void> {
     try {
       // Dynamic import of WASM module
       // @ts-ignore - WASM module is dynamically loaded
       const wasmModule = await import('/loudness_wasm.js');
       await wasmModule.default();
       
       this.wasmAnalyzer = new wasmModule.MusicAnalyzer(this.sampleRate);
       console.log('✅ WASM analyzer initialized');
     } catch (error) {
       console.error('❌ Failed to initialize WASM:', error);
       throw error;
     }
   }

  /**
   * Initialize S-KEY TensorFlow.js model
   */
  private async initializeSKEY(): Promise<void> {
    try {
      // Set WASM backend for TensorFlow.js
      await tf.setBackend('wasm');
      await tf.ready();
      
      // Try to load pre-trained S-KEY model
      try {
        this.skeyModel = await tf.loadLayersModel('/models/s_key_model.json');
        console.log('✅ S-KEY TensorFlow.js model loaded');
      } catch (modelError) {
        // If model loading fails, create a simple placeholder model
        console.warn('⚠️ S-KEY model not found, creating placeholder model');
        this.skeyModel = this.createPlaceholderSKEYModel();
      }
      
      this.skeyEnabled = true;
    } catch (error) {
      console.warn('S-KEY initialization failed:', error);
      this.skeyEnabled = false;
      throw error;
    }
  }

  /**
   * Create a placeholder S-KEY model for testing
   */
  private createPlaceholderSKEYModel(): tf.LayersModel {
    // Create a simple neural network with S-KEY architecture
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [15], // 12 chroma + 3 auxiliary features
          units: 64,
          activation: 'relu',
          name: 'encoder'
        }),
        tf.layers.dense({
          units: 24, // 12 major + 12 minor keys
          activation: 'softmax',
          name: 'key_classifier'
        })
      ]
    });

    console.log('✅ Placeholder S-KEY model created');
    return model;
  }

  /**
   * Enhanced music analysis with S-KEY + traditional hybrid approach
   */
  async analyzeMusic(pcmData: Float32Array): Promise<MusicAnalysisResult> {
    await this.initialize();

    // Use WASM S-KEY implementation if available
    if (this.wasmAnalyzer.analyze_music_with_skey) {
      try {
        const result = this.wasmAnalyzer.analyze_music_with_skey(pcmData);
        return this.processWasmResult(result);
      } catch (error) {
        console.warn('WASM S-KEY analysis failed, falling back to JavaScript implementation:', error);
      }
    }

    // Fallback to JavaScript implementation
    return this.analyzeWithJavaScript(pcmData);
  }

  /**
   * JavaScript-based S-KEY + traditional analysis
   */
  private async analyzeWithJavaScript(pcmData: Float32Array): Promise<MusicAnalysisResult> {
    // Run traditional algorithm first
    const traditionalResult = this.wasmAnalyzer.analyze_music(pcmData);
    const traditional = this.processWasmResult(traditionalResult);

    // Try S-KEY enhancement if traditional confidence is low
    if (this.skeyEnabled && this.skeyModel && traditional.confidence < 0.8) {
      try {
        const skeyResult = await this.analyzeMusicSKEY(pcmData);
        
        // Use S-KEY result if more confident
        if (skeyResult.confidence > traditional.confidence) {
          return {
            ...skeyResult,
            method: 'S-KEY Enhanced (JS)',
            enhanced: true,
            traditional_confidence: traditional.confidence
          };
        }
      } catch (error) {
        console.warn('S-KEY analysis failed:', error);
      }
    }

    // Return traditional result
    return {
      ...traditional,
      method: traditional.confidence > 0.7 ? 'Traditional (High Confidence)' : 'Traditional',
      enhanced: false
    };
  }

  /**
   * S-KEY neural network analysis using TensorFlow.js
   */
  private async analyzeMusicSKEY(pcmData: Float32Array): Promise<MusicAnalysisResult> {
    if (!this.skeyModel) {
      throw new Error('S-KEY model not initialized');
    }

    // Extract S-KEY features
    const features = this.extractSKEYFeatures(pcmData);
    
    // Run inference
    const inputTensor = tf.tensor2d([features.chroma.concat([
      features.spectral_centroid,
      features.zero_crossing_rate,
      features.rms_energy
    ])]);
    
    const prediction = this.skeyModel.predict(inputTensor) as tf.Tensor;
    const probabilities = await prediction.data();
    
    // Cleanup tensors
    inputTensor.dispose();
    prediction.dispose();

    // Decode prediction
    return this.decodeSKEYPrediction(Array.from(probabilities), features);
  }

  /**
   * Extract features for S-KEY neural network
   */
  private extractSKEYFeatures(pcmData: Float32Array): SKEYFeatures {
    // Extract chroma using traditional method (from WASM)
    const traditionalResult = this.wasmAnalyzer.analyze_music(pcmData);
    const chroma = traditionalResult.chroma || new Array(12).fill(0);

    // Extract auxiliary features
    const spectralCentroid = this.calculateSpectralCentroid(pcmData);
    const zeroCrossingRate = this.calculateZeroCrossingRate(pcmData);
    const rmsEnergy = this.calculateRMSEnergy(pcmData);

    return {
      chroma: Array.from(chroma),
      spectral_centroid: spectralCentroid,
      zero_crossing_rate: zeroCrossingRate,
      rms_energy: rmsEnergy
    };
  }

  /**
   * Calculate spectral centroid
   */
  private calculateSpectralCentroid(pcmData: Float32Array): number {
    const fftSize = 2048;
    const hopSize = 1024;
    const maxSamples = Math.min(pcmData.length, this.sampleRate * 2); // Max 2 seconds
    
    let totalCentroid = 0;
    let frameCount = 0;

    for (let start = 0; start + fftSize <= maxSamples; start += hopSize) {
      const frame = pcmData.slice(start, start + fftSize);
      
      // Apply Hann window
      for (let i = 0; i < frame.length; i++) {
        const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (frame.length - 1));
        frame[i] *= window;
      }
      
      // Simple FFT approximation (for real implementation, use proper FFT)
      const spectrum = this.simpleFFT(frame);
      
      let weightedSum = 0;
      let magnitudeSum = 0;
      
      for (let bin = 0; bin < spectrum.length / 2; bin++) {
        const freq = bin * this.sampleRate / spectrum.length;
        const magnitude = Math.sqrt(spectrum[bin * 2] ** 2 + spectrum[bin * 2 + 1] ** 2);
        weightedSum += freq * magnitude;
        magnitudeSum += magnitude;
      }
      
      if (magnitudeSum > 0) {
        totalCentroid += weightedSum / magnitudeSum;
        frameCount++;
      }
    }

    if (frameCount > 0) {
      const avgCentroid = totalCentroid / frameCount;
      // Normalize to 0-1 range
      return Math.max(0, Math.min(1, (avgCentroid - 200) / 7800));
    }
    
    return 0.5; // Default middle value
  }

  /**
   * Calculate zero crossing rate
   */
  private calculateZeroCrossingRate(pcmData: Float32Array): number {
    let crossings = 0;
    
    for (let i = 1; i < pcmData.length; i++) {
      if ((pcmData[i] >= 0) !== (pcmData[i - 1] >= 0)) {
        crossings++;
      }
    }
    
    // Normalize to 0-1 range
    return Math.min(1, (crossings / pcmData.length) * 2);
  }

  /**
   * Calculate RMS energy
   */
  private calculateRMSEnergy(pcmData: Float32Array): number {
    let sumSquares = 0;
    
    for (let i = 0; i < pcmData.length; i++) {
      sumSquares += pcmData[i] ** 2;
    }
    
    const rms = Math.sqrt(sumSquares / pcmData.length);
    
    if (rms > 0) {
      const db = 20 * Math.log10(rms);
      // Scale from -60dB to 0dB range
      return Math.max(0, Math.min(1, (db + 60) / 60));
    }
    
    return 0;
  }

  /**
   * Simple FFT approximation (placeholder - use proper FFT in production)
   */
  private simpleFFT(signal: Float32Array): number[] {
    const N = signal.length;
    const result = new Array(N * 2).fill(0);
    
    for (let k = 0; k < N; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        real += signal[n] * Math.cos(angle);
        imag += signal[n] * Math.sin(angle);
      }
      
      result[k * 2] = real;
      result[k * 2 + 1] = imag;
    }
    
    return result;
  }

  /**
   * Decode S-KEY neural network prediction
   */
  private decodeSKEYPrediction(probabilities: number[], features: SKEYFeatures): MusicAnalysisResult {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    // Find highest probability key
    const maxIdx = probabilities.indexOf(Math.max(...probabilities));
    const confidence = Math.max(...probabilities);
    
    const root = maxIdx % 12;
    const isMajor = maxIdx < 12; // First 12 are major, last 12 are minor
    
    // Calculate additional metrics
    const tonalClarity = this.calculateSKEYTonalClarity(probabilities);
    const harmonicComplexity = this.calculateSKEYComplexity(features.chroma);
    
    // Generate scale analysis from probabilities
    const scales = this.generateSKEYScales(probabilities, noteNames);

    return {
      key: `${noteNames[root]} ${isMajor ? 'Major' : 'Minor'}`,
      root_note: noteNames[root],
      is_major: isMajor,
      confidence: confidence,
      method: 'S-KEY',
      enhanced: true,
      tonal_clarity: tonalClarity,
      harmonic_complexity: harmonicComplexity,
      chroma: features.chroma,
      scales: scales
    };
  }

  /**
   * Calculate tonal clarity from S-KEY probabilities
   */
  private calculateSKEYTonalClarity(probabilities: number[]): number {
    const max = Math.max(...probabilities);
    const avg = probabilities.reduce((a, b) => a + b) / probabilities.length;
    return max > 0 ? Math.min(max / avg, 10) / 10 : 0;
  }

  /**
   * Calculate harmonic complexity
   */
  private calculateSKEYComplexity(chroma: number[]): number {
    const variance = this.calculateVariance(chroma);
    return Math.min(variance * 5, 1);
  }

  /**
   * Calculate variance of array
   */
  private calculateVariance(array: number[]): number {
    const mean = array.reduce((a, b) => a + b) / array.length;
    const squaredDiffs = array.map(x => (x - mean) ** 2);
    return squaredDiffs.reduce((a, b) => a + b) / array.length;
  }

  /**
   * Generate scale analysis from S-KEY probabilities
   */
  private generateSKEYScales(probabilities: number[], noteNames: string[]): Array<{name: string, strength: number, category: string}> {
    const scales = [];
    
    // Convert probabilities to scale strengths
    for (let i = 0; i < 24; i++) {
      const root = i % 12;
      const isMajor = i < 12;
      const scaleName = `${noteNames[root]} ${isMajor ? 'Major' : 'Natural Minor'}`;
      const strength = probabilities[i];
      
      if (strength > 0.1) {
        scales.push({
          name: scaleName,
          strength: strength,
          category: isMajor ? 'Major Family' : 'Minor Family'
        });
      }
    }
    
    // Sort by strength and return top 8
    scales.sort((a, b) => b.strength - a.strength);
    return scales.slice(0, 8);
  }

  /**
   * Process WASM result into TypeScript interface
   */
  private processWasmResult(wasmResult: any): MusicAnalysisResult {
    return {
      key: wasmResult.key || 'Unknown',
      root_note: wasmResult.root_note || 'C',
      is_major: wasmResult.is_major || true,
      confidence: wasmResult.confidence || 0,
      method: wasmResult.method || 'Traditional',
      enhanced: wasmResult.enhanced || false,
      traditional_confidence: wasmResult.traditional_confidence,
      tonal_clarity: wasmResult.tonal_clarity || 0,
      harmonic_complexity: wasmResult.harmonic_complexity || 0,
      chroma: Array.from(wasmResult.chroma || new Array(12).fill(0)),
      scales: Array.from(wasmResult.scales || [])
    };
  }

  /**
   * Benchmark traditional vs S-KEY performance
   */
  async benchmarkAlgorithms(pcmData: Float32Array): Promise<BenchmarkResult> {
    await this.initialize();

    // Use WASM benchmark if available
    if (this.wasmAnalyzer.benchmark_algorithms) {
      try {
        const result = this.wasmAnalyzer.benchmark_algorithms(pcmData);
        return {
          traditional: {
            key: result.traditional.key,
            confidence: result.traditional.confidence,
            time_ms: result.traditional.time_ms
          },
          skey: {
            key: result.skey.key,
            confidence: result.skey.confidence,
            available: result.skey.available,
            time_ms: result.skey.time_ms
          }
        };
      } catch (error) {
        console.warn('WASM benchmark failed:', error);
      }
    }

    // JavaScript fallback benchmark
    return this.benchmarkWithJavaScript(pcmData);
  }

  /**
   * JavaScript benchmark implementation
   */
  private async benchmarkWithJavaScript(pcmData: Float32Array): Promise<BenchmarkResult> {
    // Traditional analysis
    const traditionalStart = performance.now();
    const traditionalResult = this.wasmAnalyzer.analyze_music(pcmData);
    const traditionalTime = performance.now() - traditionalStart;

    // S-KEY analysis
    const skeyStart = performance.now();
    let skeyResult: any = null;
    
    if (this.skeyEnabled && this.skeyModel) {
      try {
        skeyResult = await this.analyzeMusicSKEY(pcmData);
      } catch (error) {
        console.warn('S-KEY benchmark failed:', error);
      }
    }
    
    const skeyTime = performance.now() - skeyStart;

    return {
      traditional: {
        key: traditionalResult.key,
        confidence: traditionalResult.confidence,
        time_ms: traditionalTime
      },
      skey: {
        key: skeyResult?.key,
        confidence: skeyResult?.confidence,
        available: this.skeyEnabled && this.skeyModel !== null,
        time_ms: skeyTime
      }
    };
  }

  /**
   * Enable or disable S-KEY enhancement
   */
  setSKEYEnabled(enabled: boolean): void {
    this.skeyEnabled = enabled;
    
    // Update WASM analyzer if available
    if (this.wasmAnalyzer && this.wasmAnalyzer.set_skey_enabled) {
      this.wasmAnalyzer.set_skey_enabled(enabled);
    }
  }

  /**
   * Check if S-KEY is available and enabled
   */
  isSKEYEnabled(): boolean {
    return this.skeyEnabled && (this.skeyModel !== null);
  }

  /**
   * Get current backend information
   */
  getBackendInfo(): { wasm: boolean, skey: boolean, backend: string } {
    return {
      wasm: this.wasmAnalyzer !== null,
      skey: this.isSKEYEnabled(),
      backend: tf.getBackend()
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.skeyModel) {
      this.skeyModel.dispose();
      this.skeyModel = null;
    }
    
    this.isInitialized = false;
    this.initializePromise = null;
  }
} 