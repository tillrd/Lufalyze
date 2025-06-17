declare module 'wav-decoder' {
  interface AudioData {
    sampleRate: number;
    numberOfChannels: number;
    channelData: Float32Array[];
  }

  export function decode(buffer: ArrayBuffer | Buffer): Promise<AudioData>;
} 