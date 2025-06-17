declare module 'wavesurfer.js' {
  export interface WaveSurferOptions {
    container: string | HTMLElement;
    waveColor?: string;
    progressColor?: string;
    cursorColor?: string;
    barWidth?: number;
    barGap?: number;
    height?: number;
    responsive?: boolean;
    normalize?: boolean;
    splitChannels?: boolean;
    interact?: boolean;
    hideScrollbar?: boolean;
    minPxPerSec?: number;
    pixelRatio?: number;
    plugins?: any[];
  }

  export interface WaveSurfer {
    play(): void;
    pause(): void;
    playPause(): void;
    stop(): void;
    destroy(): void;
    load(url: string): void;
    zoom(level: number): void;
    setPlaybackRate(rate: number): void;
    getDuration(): number;
    on(event: string, callback: (param?: any) => void): void;
    un(event: string, callback: (param?: any) => void): void;
  }

  export function create(options: WaveSurferOptions): WaveSurfer;
}

declare module 'wavesurfer.js/dist/plugin/wavesurfer.regions.min.js' {
  export function create(): any;
}

declare module 'wavesurfer.js/dist/plugin/wavesurfer.timeline.min.js' {
  export function create(options: any): any;
}

declare module 'wavesurfer.js/dist/plugin/wavesurfer.spectrogram.min.js' {
  export function create(options: any): any;
} 