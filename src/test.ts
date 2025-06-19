import { readFileSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
// import * as mm from 'music-metadata'; // Temporarily disabled
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper to find the 'data' chunk in a WAV buffer
function findDataChunk(buffer: Buffer): { offset: number; length: number } {
  let offset = 12; // skip RIFF header
  while (offset < buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (chunkId === 'data') {
      return { offset: offset + 8, length: chunkSize };
    }
    offset += 8 + chunkSize;
  }
  throw new Error('No data chunk found in WAV file');
}

interface Metrics {
  loudness: number;
  rms: number;
  validBlocks: number;
  totalBlocks: number;
  performance: {
    totalTime: number;
    kWeightingTime: number;
    blockProcessingTime: number;
  };
}

async function testAudioProcessing() {
  try {
    // Read the sample audio file
    const sampleFile = process.argv[2] || 'sample.wav';
    console.log('Starting audio processing test...');
    console.log(`Reading sample file: ${path.join(__dirname, '..', sampleFile)}`);
    const buffer = readFileSync(path.join(__dirname, '..', sampleFile));
    console.log('File size:', buffer.byteLength, 'bytes');

    // Decode WAV file using music-metadata - temporarily disabled
    console.log('Using default WAV settings...');
    // const metadata = await mm.parseBuffer(buffer, 'audio/wav');
    // const format = metadata.format;
    const sampleRate = 44100; // Default
    const numberOfChannels = 1; // Assume mono for testing
    const duration = 0;
    const bitsPerSample = 16; // Default

    // Extract PCM samples from the buffer
    const dataChunk = findDataChunk(buffer);
    let pcm: Float32Array;

    // Convert PCM data to Float32Array based on bit depth
    if (bitsPerSample === 32) {
      // 32-bit float PCM
      pcm = new Float32Array(buffer.buffer, dataChunk.offset, dataChunk.length / 4);
    } else if (bitsPerSample === 24) {
      // 24-bit PCM
      const samples = new Float32Array(dataChunk.length / 3);
      for (let i = 0; i < samples.length; i++) {
        const offset = dataChunk.offset + i * 3;
        // Read 3 bytes, little-endian
        let val = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
        // Sign extension for 24-bit
        if (val & 0x800000) val |= 0xFF000000;
        // Correct scaling for 24-bit PCM: divide by 8388608.0 (2^23)
        samples[i] = val / 8388608.0;
      }
      pcm = samples;
    } else {
      // 16-bit PCM (default)
      const samples = new Float32Array(dataChunk.length / 2);
      for (let i = 0; i < samples.length; i++) {
        const offset = dataChunk.offset + i * 2;
        const sample = buffer.readInt16LE(offset) / 32768.0;
        samples[i] = sample;
      }
      pcm = samples;
    }

    console.log('Decoded audio:', {
      sampleRate,
      numberOfChannels,
      bitsPerSample,
      length: pcm.length
    });

    // Create a worker
    const worker = new Worker(join(__dirname, '../dist/workers/loudness.worker.js'));

    // Set up message handling
    worker.on('message', (result: any) => {
      console.log('Worker: Received message');
      if (result.integrated !== undefined) {
        console.log('Final result:');
        console.log(`Integrated: ${result.integrated.toFixed(2)} LUFS`);
        console.log(`Short Term Max: ${result.shortTerm.toFixed(2)} LUFS`);
        console.log(`Momentary Max: ${result.momentary.toFixed(2)} LUFS`);
        
        if (result.pcm_debug) {
          console.log('PCM debug:', result.pcm_debug);
        }
        if (result.block_energy_debug) {
          console.log('Block energy debug:', result.block_energy_debug);
        }
        if (result.preliminary_loudness !== undefined) {
          console.log('Preliminary (ungated) loudness:', result.preliminary_loudness.toFixed(2), 'LUFS');
        }
        if (result.gate_threshold !== undefined) {
          console.log('Gating threshold:', result.gate_threshold.toFixed(2), 'LUFS');
        }
        if (result.abs_gated_blocks !== undefined) {
          console.log('Blocks above absolute gate:', result.abs_gated_blocks);
        }
        if (result.rel_gated_blocks !== undefined) {
          console.log('Blocks above relative gate:', result.rel_gated_blocks);
        }
        if (result.totalBlocks !== undefined) {
          console.log('Total blocks processed:', result.totalBlocks);
        }
        worker.terminate();
      } else {
        console.log('Received unexpected result from worker:', result);
      worker.terminate();
      }
    });

    worker.on('error', (error: Error) => {
      console.error('Worker error:', error);
      worker.terminate();
    });

    // Send the audio data to the worker
    console.log('Sending data to worker...');
    worker.postMessage({
      pcm,
      sampleRate
    });
  } catch (error) {
    console.error('Test failed:', error);
  }
}

console.log('Starting audio processing test...');
testAudioProcessing(); 