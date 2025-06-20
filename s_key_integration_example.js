/**
 * S-KEY Integration Example for Lufalyze
 * Demonstrates how to add S-KEY neural network key detection to existing WASM system
 */

// Enhanced MusicAnalyzer with S-KEY integration
class EnhancedMusicAnalyzer {
    constructor(sampleRate = 44100) {
        this.sampleRate = sampleRate;
        this.wasmAnalyzer = null; // Your existing WASM analyzer
        this.skeyModel = null;
        this.isSkeyInitialized = false;
        this.initializePromise = null;
    }

    // Initialize both WASM and S-KEY systems
    async initialize() {
        if (this.initializePromise) {
            return this.initializePromise;
        }

        this.initializePromise = this._doInitialize();
        return this.initializePromise;
    }

    async _doInitialize() {
        try {
            // Initialize existing WASM analyzer
            const wasmModule = await import('./public/loudness_wasm.js');
            await wasmModule.default();
            this.wasmAnalyzer = new wasmModule.MusicAnalyzer(this.sampleRate);
            console.log('✅ WASM analyzer initialized');

            // Try to initialize S-KEY (graceful fallback if unavailable)
            try {
                await this.initializeSKEY();
            } catch (error) {
                console.warn('⚠️ S-KEY initialization failed, using traditional algorithm only:', error);
            }

        } catch (error) {
            console.error('❌ Failed to initialize analyzers:', error);
            throw error;
        }
    }

    // Initialize S-KEY neural network
    async initializeSKEY() {
        try {
            // Option 1: TensorFlow.js approach
            if (typeof tf !== 'undefined') {
                await tf.setBackend('wasm');
                this.skeyModel = await tf.loadLayersModel('/models/s_key_model.json');
                this.isSkeyInitialized = true;
                console.log('✅ S-KEY TensorFlow.js model loaded');
                return;
            }

            // Option 2: ONNX.js approach (if TensorFlow.js not available)
            if (typeof ort !== 'undefined') {
                this.skeyModel = await ort.InferenceSession.create('/models/s_key_model.onnx', {
                    executionProviders: ['wasm']
                });
                this.isSkeyInitialized = true;
                console.log('✅ S-KEY ONNX model loaded');
                return;
            }

            throw new Error('No suitable ML framework found for S-KEY');

        } catch (error) {
            console.warn('S-KEY model loading failed:', error);
            throw error;
        }
    }

    // Main analysis function with S-KEY + traditional hybrid approach
    async analyzeMusic(pcmData) {
        await this.initialize();

        // Always run traditional algorithm first (fast, reliable baseline)
        const traditionalResult = this.wasmAnalyzer.analyze_music(pcmData);
        
        // Try S-KEY if available and traditional confidence is low
        if (this.isSkeyInitialized && traditionalResult.confidence < 0.8) {
            try {
                const skeyResult = await this.analyzeMusicSKEY(pcmData);
                
                // Use S-KEY result if it's more confident
                if (skeyResult.confidence > traditionalResult.confidence) {
                    return {
                        ...skeyResult,
                        method: 'S-KEY',
                        traditional_result: traditionalResult,
                        enhanced: true
                    };
                }
            } catch (error) {
                console.warn('S-KEY analysis failed, using traditional result:', error);
            }
        }

        // Return traditional result (possibly enhanced)
        return {
            ...traditionalResult,
            method: traditionalResult.confidence > 0.7 ? 'Traditional (High Confidence)' : 'Traditional',
            enhanced: false
        };
    }

    // S-KEY neural network analysis
    async analyzeMusicSKEY(pcmData) {
        if (!this.isSkeyInitialized) {
            throw new Error('S-KEY not initialized');
        }

        // Extract features for S-KEY
        const features = this.extractSKEYFeatures(pcmData);
        
        let prediction;
        let probabilities;

        // TensorFlow.js inference
        if (typeof tf !== 'undefined' && this.skeyModel.predict) {
            const inputTensor = tf.tensor2d([features]);
            prediction = await this.skeyModel.predict(inputTensor);
            probabilities = await prediction.data();
            inputTensor.dispose();
            prediction.dispose();
        }
        // ONNX.js inference
        else if (this.skeyModel.run) {
            const inputTensor = new ort.Tensor('float32', features, [1, features.length]);
            const results = await this.skeyModel.run({ input: inputTensor });
            probabilities = results.output.data;
        }
        else {
            throw new Error('Unknown model format');
        }

        // Decode S-KEY prediction
        return this.decodeSKEYPrediction(probabilities, features);
    }

    // Extract features that S-KEY expects
    extractSKEYFeatures(pcmData) {
        // Convert Float32Array to regular array for processing
        const audioArray = Array.from(pcmData);
        
        // Extract chroma features (12-dimensional)
        const chroma = this.extractChromaFeatures(audioArray);
        
        // Extract auxiliary features for major/minor distinction
        const auxiliary = this.extractAuxiliaryFeatures(audioArray);
        
        // Combine features (total: 12 + auxiliary_size)
        return [...chroma, ...auxiliary];
    }

    // Extract 12-dimensional chroma vector
    extractChromaFeatures(audioArray) {
        // Simplified chroma extraction (you'd use more sophisticated method)
        const chroma = new Array(12).fill(0);
        
        // Simple FFT-based chroma (placeholder - use proper implementation)
        const fftSize = 2048;
        const hop = fftSize / 2;
        
        for (let i = 0; i < audioArray.length - fftSize; i += hop) {
            const window = audioArray.slice(i, i + fftSize);
            const spectrum = this.computeFFT(window);
            this.addToChroma(spectrum, chroma);
        }
        
        // Normalize
        const sum = chroma.reduce((a, b) => a + b, 0);
        return sum > 0 ? chroma.map(x => x / sum) : chroma;
    }

    // Extract auxiliary features for S-KEY
    extractAuxiliaryFeatures(audioArray) {
        // S-KEY uses auxiliary features to distinguish major/minor
        // These are dataset-specific and learned during training
        
        // Placeholder features (in real implementation, these would be:)
        // - Spectral centroid
        // - Spectral rolloff  
        // - Zero crossing rate
        // - Tempo-related features
        // - Harmonic/percussive separation features
        
        const spectralCentroid = this.calculateSpectralCentroid(audioArray);
        const zeroCrossingRate = this.calculateZeroCrossingRate(audioArray);
        const rmsEnergy = this.calculateRMSEnergy(audioArray);
        
        return [spectralCentroid, zeroCrossingRate, rmsEnergy];
    }

    // Decode S-KEY neural network output
    decodeSKEYPrediction(probabilities, originalFeatures) {
        // S-KEY outputs 24 probabilities (12 major + 12 minor keys)
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        // Find the key with highest probability
        const maxIdx = probabilities.indexOf(Math.max(...probabilities));
        const confidence = Math.max(...probabilities);
        
        const root = maxIdx % 12;
        const isMajor = maxIdx < 12;
        
        // Calculate additional metrics
        const tonal_clarity = this.calculateSKEYTonalClarity(probabilities);
        const harmonic_complexity = this.calculateSKEYComplexity(originalFeatures);
        
        return {
            key: `${noteNames[root]} ${isMajor ? 'Major' : 'Minor'}`,
            root_note: noteNames[root],
            is_major: isMajor,
            confidence: confidence,
            tonal_clarity: tonal_clarity,
            harmonic_complexity: harmonic_complexity,
            chroma: originalFeatures.slice(0, 12), // First 12 features are chroma
            scales: this.generateSKEYScales(probabilities, noteNames)
        };
    }

    // Generate scale analysis from S-KEY probabilities
    generateSKEYScales(probabilities, noteNames) {
        const scales = [];
        
        // Convert probabilities to scale strengths
        for (let i = 0; i < 24; i++) {
            const root = i % 12;
            const isMajor = i < 12;
            const scaleName = `${noteNames[root]} ${isMajor ? 'Major' : 'Natural Minor'}`;
            const strength = probabilities[i];
            
            if (strength > 0.1) { // Only include significant scales
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

    // Helper functions (simplified implementations)
    computeFFT(signal) {
        // Placeholder - use proper FFT implementation
        // In real implementation, use Web Audio API or FFT library
        return signal.map((x, i) => Math.abs(x * Math.cos(i * 0.1)));
    }

    addToChroma(spectrum, chroma) {
        // Map frequency bins to chroma classes
        for (let i = 0; i < spectrum.length; i++) {
            const freq = (i * this.sampleRate) / (2 * spectrum.length);
            const pitchClass = this.frequencyToPitchClass(freq);
            chroma[pitchClass] += spectrum[i];
        }
    }

    frequencyToPitchClass(freq) {
        if (freq <= 0) return 0;
        const midiNote = 69 + 12 * Math.log2(freq / 440);
        return Math.round(midiNote) % 12;
    }

    calculateSpectralCentroid(signal) {
        // Placeholder calculation
        return signal.reduce((sum, val, i) => sum + val * i, 0) / signal.length;
    }

    calculateZeroCrossingRate(signal) {
        let crossings = 0;
        for (let i = 1; i < signal.length; i++) {
            if ((signal[i] >= 0) !== (signal[i-1] >= 0)) {
                crossings++;
            }
        }
        return crossings / signal.length;
    }

    calculateRMSEnergy(signal) {
        const sumSquares = signal.reduce((sum, val) => sum + val * val, 0);
        return Math.sqrt(sumSquares / signal.length);
    }

    calculateSKEYTonalClarity(probabilities) {
        // Measure how confident the network is
        const max = Math.max(...probabilities);
        const avg = probabilities.reduce((a, b) => a + b) / probabilities.length;
        return max > 0 ? Math.min(max / avg, 10) / 10 : 0;
    }

    calculateSKEYComplexity(features) {
        // Use feature variance as complexity measure
        const chroma = features.slice(0, 12);
        const variance = this.calculateVariance(chroma);
        return Math.min(variance * 5, 1); // Scale to 0-1
    }

    calculateVariance(array) {
        const mean = array.reduce((a, b) => a + b) / array.length;
        const squaredDiffs = array.map(x => (x - mean) ** 2);
        return squaredDiffs.reduce((a, b) => a + b) / array.length;
    }
}

// Usage example
async function demonstrateSKEYIntegration() {
    console.log('🎼 Demonstrating S-KEY + WASM Integration');
    
    // Create enhanced analyzer
    const analyzer = new EnhancedMusicAnalyzer(44100);
    
    try {
        // Initialize (loads both WASM and S-KEY if available)
        await analyzer.initialize();
        
        // Simulate audio data (replace with real audio)
        const audioData = new Float32Array(44100 * 2); // 2 seconds of silence
        for (let i = 0; i < audioData.length; i++) {
            audioData[i] = Math.sin(2 * Math.PI * 440 * i / 44100) * 0.1; // A4 sine wave
        }
        
        // Analyze with hybrid S-KEY + traditional approach
        const result = await analyzer.analyzeMusic(audioData);
        
        console.log('🎵 Analysis Result:');
        console.log(`   Key: ${result.key}`);
        console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        console.log(`   Method: ${result.method}`);
        console.log(`   Enhanced: ${result.enhanced}`);
        
        if (result.traditional_result) {
            console.log(`   Traditional confidence: ${(result.traditional_result.confidence * 100).toFixed(1)}%`);
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Analysis failed:', error);
        throw error;
    }
}

// Export for use in your application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EnhancedMusicAnalyzer, demonstrateSKEYIntegration };
} else if (typeof window !== 'undefined') {
    window.EnhancedMusicAnalyzer = EnhancedMusicAnalyzer;
    window.demonstrateSKEYIntegration = demonstrateSKEYIntegration;
}

// Auto-run demonstration if loaded directly
if (typeof window !== 'undefined' && window.location) {
    console.log('🚀 S-KEY Integration Example Loaded');
    console.log('Use: new EnhancedMusicAnalyzer() or demonstrateSKEYIntegration()');
} 