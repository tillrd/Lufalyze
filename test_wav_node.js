#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple WAV file parser to extract PCM data
function parseWav(buffer, maxSamples = 2646000) { // Limit to ~60 seconds at 44.1kHz
    const view = new DataView(buffer);
    
    // Check WAV header
    const riff = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
    if (riff !== 'RIFF') {
        throw new Error('Not a valid WAV file');
    }
    
    const wave = String.fromCharCode(...new Uint8Array(buffer, 8, 4));
    if (wave !== 'WAVE') {
        throw new Error('Not a valid WAV file');
    }
    
    let audioFormat, numChannels, sampleRate, bitsPerSample;
    
    // Find fmt chunk
    let offset = 12;
    while (offset < buffer.byteLength) {
        const chunkId = String.fromCharCode(...new Uint8Array(buffer, offset, 4));
        const chunkSize = view.getUint32(offset + 4, true);
        
        if (chunkId === 'fmt ') {
            audioFormat = view.getUint16(offset + 8, true);
            numChannels = view.getUint16(offset + 10, true);
            sampleRate = view.getUint32(offset + 12, true);
            bitsPerSample = view.getUint16(offset + 22, true);
            
            console.log(`Audio Format: ${audioFormat}, Channels: ${numChannels}, Sample Rate: ${sampleRate}, Bits: ${bitsPerSample}`);
            
            if (audioFormat !== 1) {
                throw new Error('Only PCM format is supported');
            }
            
            offset += 8 + chunkSize;
            continue;
        }
        
        if (chunkId === 'data') {
            const dataSize = chunkSize;
            const dataOffset = offset + 8;
            
            console.log(`Data chunk found: ${dataSize} bytes at offset ${dataOffset}`);
            
            // Calculate sample info
            const bytesPerSample = Math.floor(bitsPerSample / 8);
            const totalSamples = Math.floor(dataSize / (bytesPerSample * numChannels));
            const samplesToProcess = Math.min(totalSamples, maxSamples);
            
            console.log(`Total samples: ${totalSamples}, Processing: ${samplesToProcess} (${(samplesToProcess / sampleRate).toFixed(1)}s)`);
            
            // Extract PCM data (convert to mono)
            const pcmData = new Float32Array(samplesToProcess);
            
            for (let i = 0; i < samplesToProcess; i++) {
                let sampleValue = 0;
                
                // Average all channels to mono
                for (let ch = 0; ch < numChannels; ch++) {
                    const sampleOffset = dataOffset + (i * numChannels + ch) * bytesPerSample;
                    
                    if (bitsPerSample === 16) {
                        const sample16 = view.getInt16(sampleOffset, true);
                        sampleValue += sample16 / 32768.0;
                    } else if (bitsPerSample === 24) {
                        // 24-bit PCM (little endian)
                        const byte1 = view.getUint8(sampleOffset);
                        const byte2 = view.getUint8(sampleOffset + 1);
                        const byte3 = view.getInt8(sampleOffset + 2); // Signed for MSB
                        const sample24 = (byte3 << 16) | (byte2 << 8) | byte1;
                        sampleValue += sample24 / 8388608.0;
                    } else if (bitsPerSample === 32) {
                        const sample32 = view.getInt32(sampleOffset, true);
                        sampleValue += sample32 / 2147483648.0;
                    }
                }
                
                pcmData[i] = sampleValue / numChannels; // Average channels
            }
            
            return { pcmData, sampleRate, numChannels, bitsPerSample, duration: samplesToProcess / sampleRate };
        }
        
        offset += 8 + chunkSize;
    }
    
    throw new Error('No data chunk found');
}

// Test with synthetic data first
function testSynthetic() {
    console.log('\n=== Testing with Synthetic C Major Chord ===');
    
    // Generate C Major chord (C-E-G: 261.63, 329.63, 392.00 Hz)
    const sampleRate = 44100;
    const duration = 2.0;
    const numSamples = Math.floor(sampleRate * duration);
    const frequencies = [261.63, 329.63, 392.00];
    
    const samples = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
        let sample = 0;
        for (const freq of frequencies) {
            sample += Math.sin(2 * Math.PI * freq * i / sampleRate) * 0.3;
        }
        samples[i] = sample / frequencies.length;
    }
    
    console.log(`Generated ${numSamples} samples for C Major chord`);
    console.log(`Frequencies: ${frequencies.join(', ')} Hz`);
    
    // Test basic array properties
    console.log(`Sample data type: ${samples.constructor.name}`);
    console.log(`Sample length: ${samples.length}`);
    // Calculate min/max manually
    let minSample = samples[0];
    let maxSample = samples[0];
    for (let i = 1; i < samples.length; i++) {
        if (samples[i] < minSample) minSample = samples[i];
        if (samples[i] > maxSample) maxSample = samples[i];
    }
    console.log(`Sample range: ${minSample.toFixed(4)} to ${maxSample.toFixed(4)}`);
    
    // Show first few samples
    console.log(`First 10 samples: ${Array.from(samples.slice(0, 10)).map(s => s.toFixed(4)).join(', ')}`);
    
    return { pcmData: samples, sampleRate, duration };
}

// Test with actual WAV file
function testWavFile(filename) {
    console.log(`\n=== Testing with ${filename} ===`);
    
    try {
        const filePath = path.join(__dirname, filename);
        if (!fs.existsSync(filePath)) {
            console.log(`❌ File not found: ${filePath}`);
            return null;
        }
        
        const buffer = fs.readFileSync(filePath);
        console.log(`File size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
        
        const result = parseWav(buffer.buffer);
        console.log(`✅ Successfully parsed WAV file`);
        console.log(`Extracted ${result.pcmData.length} samples`);
        console.log(`Duration: ${result.duration.toFixed(2)} seconds`);
        console.log(`Sample rate: ${result.sampleRate} Hz`);
        console.log(`Channels: ${result.numChannels}`);
        console.log(`Bits per sample: ${result.bitsPerSample}`);
        // Calculate min/max manually to avoid stack overflow
        let minSample = result.pcmData[0];
        let maxSample = result.pcmData[0];
        for (let i = 1; i < Math.min(result.pcmData.length, 44100); i++) {
            if (result.pcmData[i] < minSample) minSample = result.pcmData[i];
            if (result.pcmData[i] > maxSample) maxSample = result.pcmData[i];
        }
        console.log(`Sample range: ${minSample.toFixed(4)} to ${maxSample.toFixed(4)}`);
        
        // Show first few samples
        console.log(`First 10 samples: ${Array.from(result.pcmData.slice(0, 10)).map(s => s.toFixed(4)).join(', ')}`);
        
        // Calculate simple frequency content analysis (with smaller sample)
        const analysisData = result.pcmData.slice(0, 88200); // Use only first 2 seconds
        analyzeFrequencyContent(analysisData, result.sampleRate);
        
        return result;
        
    } catch (error) {
        console.log(`❌ Error parsing ${filename}: ${error.message}`);
        return null;
    }
}

// Simple frequency analysis to validate musical content
function analyzeFrequencyContent(samples, sampleRate) {
    console.log('\n--- Basic Frequency Analysis ---');
    
    // Take a 4096-sample window for analysis
    const windowSize = 4096;
    const startIdx = Math.floor(samples.length * 0.25); // Start 25% into the file
    const window = samples.slice(startIdx, startIdx + windowSize);
    
    if (window.length < windowSize) {
        console.log('Not enough samples for frequency analysis');
        return;
    }
    
    // Simple DFT for a few key frequencies
    const testFrequencies = [
        { name: 'C4', freq: 261.63 },
        { name: 'D4', freq: 293.66 },
        { name: 'E4', freq: 329.63 },
        { name: 'F4', freq: 349.23 },
        { name: 'G4', freq: 392.00 },
        { name: 'A4', freq: 440.00 },
        { name: 'B4', freq: 493.88 }
    ];
    
    const results = [];
    
    for (const testFreq of testFrequencies) {
        let real = 0, imag = 0;
        const angularFreq = 2 * Math.PI * testFreq.freq / sampleRate;
        
        for (let i = 0; i < windowSize; i++) {
            const angle = angularFreq * i;
            real += window[i] * Math.cos(angle);
            imag += window[i] * Math.sin(angle);
        }
        
        const magnitude = Math.sqrt(real * real + imag * imag) / windowSize;
        results.push({ ...testFreq, magnitude });
    }
    
    // Sort by magnitude
    results.sort((a, b) => b.magnitude - a.magnitude);
    
    console.log('Top frequency components:');
    results.slice(0, 5).forEach(result => {
        console.log(`  ${result.name} (${result.freq.toFixed(1)} Hz): ${result.magnitude.toFixed(4)}`);
    });
    
    // Check if there's musical content
    const maxMagnitude = results[0].magnitude;
    if (maxMagnitude > 0.001) {
        console.log(`✅ Musical content detected (strongest: ${results[0].name})`);
    } else {
        console.log(`⚠️  Low musical content detected`);
    }
}

// Test WASM module if available
async function testWasmModule(audioData, testName) {
    console.log(`\n=== Testing WASM Key Detection for ${testName} ===`);
    
    try {
        // Try to import WASM module
        const wasmModule = await import('./public/loudness_wasm.js');
        await wasmModule.default();
        
        const analyzer = new wasmModule.MusicAnalyzer(audioData.sampleRate || 44100);
        console.log('✅ WASM module initialized successfully');
        
        // Run key detection
        const startTime = Date.now();
        const result = analyzer.analyze_music(audioData.pcmData);
        const endTime = Date.now();
        
        console.log(`🎵 Key Detection Results for ${testName}:`);
        console.log(`   Detected Key: ${result.key}`);
        console.log(`   Root Note: ${result.root_note}`);
        console.log(`   Is Major: ${result.is_major}`);
        console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        console.log(`   Tonal Clarity: ${(result.tonal_clarity * 100).toFixed(1)}%`);
        console.log(`   Harmonic Complexity: ${(result.harmonic_complexity * 100).toFixed(1)}%`);
        console.log(`   Processing Time: ${endTime - startTime}ms`);
        
        // Show chroma vector
        console.log(`   Chroma Vector:`);
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        result.chroma.forEach((value, index) => {
            console.log(`     ${noteNames[index]}: ${value.toFixed(4)}`);
        });
        
        // Show scale analysis
        if (result.scales && result.scales.length > 0) {
            console.log(`   Scale Analysis:`);
            result.scales.forEach(scale => {
                console.log(`     ${scale.name}: ${(scale.strength * 100).toFixed(1)}% (${scale.category})`);
            });
        }
        
        return result;
        
    } catch (error) {
        console.log(`❌ WASM test failed: ${error.message}`);
        console.log('This might be normal if running outside a browser environment');
        return null;
    }
}

// Main test function
async function runTests() {
    console.log('🎼 Musical Key Detection Algorithm Test');
    console.log('=====================================');
    
    // Test 1: Synthetic data
    const syntheticData = testSynthetic();
    await testWasmModule(syntheticData, 'C Major Chord (Synthetic)');
    
    // Test 2: Real WAV files
    const wavFiles = ['1.wav', 'testfile.wav'];
    
    for (const filename of wavFiles) {
        const audioData = testWavFile(filename);
        if (audioData) {
            await testWasmModule(audioData, filename);
        }
    }
    
    console.log('\n✅ All tests completed!');
    console.log('\nTo test in browser environment:');
    console.log('1. Open http://localhost:5173/test_wav_files.html');
    console.log('2. Click the test buttons to run key detection on the WAV files');
    console.log('\nOr test synthetic chords:');
    console.log('3. Open http://localhost:5173/test_synthetic.html');
    console.log('4. Click the chord test buttons to validate algorithm accuracy');
}

// Run tests
runTests().catch(console.error); 