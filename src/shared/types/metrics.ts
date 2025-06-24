import { AudioFileInfo } from './audio';

// Core loudness analysis metrics
export interface LoudnessMetrics {
  momentaryMax: number;
  shortTermMax: number;
  integrated: number;
}

// Music analysis has been removed from this application

// Stereo imaging analysis results
export interface StereoAnalysis {
  is_mono: boolean;
  channels: number;
  phase_correlation?: number;
  stereo_width?: number;
  lr_balance?: number;
  mono_compatibility?: number;
  imaging_quality?: string;
  imaging_quality_score?: number;
}

// Technical analysis results
export interface TechnicalAnalysis {
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
}

// Performance metrics
export interface PerformanceMetrics {
  totalTime: number;
  kWeightingTime: number;
  blockProcessingTime: number;
}

// Complete analysis results
export interface Metrics {
  loudness: number;
  loudnessDetailed?: LoudnessMetrics;
  rms: number;
  performance: PerformanceMetrics;
  processingTime?: number;
  fileSize?: number;
  duration?: number;
  audioFileInfo?: AudioFileInfo;
  tempo?: number; // BPM (beats per minute)
  // Music analysis removed
  stereoAnalysis?: StereoAnalysis;
  technicalAnalysis?: TechnicalAnalysis;
}

// Audio metrics with additional data (used in some contexts)
export interface AudioMetrics {
  loudness: number;
  loudnessDetailed?: LoudnessMetrics;
  rms: number;
  performance: PerformanceMetrics;
  processingTime?: number;
  fileSize?: number;
  duration?: number;
  waveformData?: Float32Array;
  tempo?: number; // BPM (beats per minute)
  // Music analysis removed
} 