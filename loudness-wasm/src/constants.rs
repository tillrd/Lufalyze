// Constants for ITU-R BS.1770-4
pub const LOWER_BOUND: f32 = -70.0;           // Lower bound in LUFS
pub const UPPER_BOUND: f32 = -10.0;           // Upper bound in LUFS
pub const ABSOLUTE_GATE: f32 = -70.0;         // Absolute gate threshold in LUFS
pub const RELATIVE_GATE: f32 = -10.0;         // Relative gate threshold in LUFS
pub const CALIBRATION_OFFSET: f32 = -1.96;
pub const ENERGY_SCALE: f32 = 1.0;

// Constants for ITU-R BS.1770-4
pub const MOMENTARY_BLOCK_SIZE: usize = 17640;  // 400ms at 44.1kHz
pub const MOMENTARY_HOP: usize = 4410;          // 100ms hop
pub const SHORT_TERM_BLOCK_SIZE: usize = 132300; // 3s at 44.1kHz
pub const SHORT_TERM_HOP: usize = 13230;        // 300ms hop

// K-weighting filter coefficients for 44.1kHz
pub const K_B: [f32; 3] = [1.5351249, -2.6916962, 1.1983928];
pub const K_A: [f32; 3] = [1.0, -1.6906593, 0.73248076];

// Channel weights (ITU-R BS.1770-4)
pub const CHANNEL_WEIGHTS: [f32; 5] = [1.0, 1.0, 1.0, 1.41, 1.41]; // L, R, C, Ls, Rs

// Scaling factor to match reference
pub const SCALING_FACTOR: f32 = 0.001;

// Professional MIR constants following Classical DSP chain approach
pub const CHROMA_SIZE: usize = 12;
pub const MAX_ANALYSIS_SAMPLES: usize = 44100 * 60; // 1 minute max for performance
pub const FFT_SIZE: usize = 4096; // High-resolution spectrum as recommended
pub const HOP_SIZE: usize = 2048; // 50% overlap as specified
pub const HPCP_SIZE: usize = 12; // Harmonic Pitch Class Profile bins
pub const MIN_FREQ: f32 = 65.4; // C2 - lowest musical frequency
pub const MAX_FREQ: f32 = 2093.0; // C7 - practical upper limit
pub const NUM_HARMONICS: usize = 8; // For harmonic weighting
pub const SPECTRAL_WHITENING_FACTOR: f32 = 0.33; // Reduces timbral bias
pub const TUNING_SEARCH_CENTS: f32 = 50.0; // ±50 cent adaptive tuning
pub const PEAK_THRESHOLD: f32 = -60.0; // dB threshold for peak picking
pub const MEDIAN_FILTER_SIZE: usize = 5; // For temporal smoothing
pub const NOISE_FLOOR: f32 = -60.0; // dB threshold for noise gating
pub const MAX_FRAMES: usize = 100; // Maximum frames to process
pub const CQT_BINS_PER_OCTAVE: usize = 36; // For CQT analysis

// Note names for output
pub const NOTE_NAMES: [&str; 12] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Enhanced scale patterns with more precise intervals
pub const SCALE_PATTERNS: [(&[usize], &str); 24] = [
    // Traditional scales
    (&[0, 2, 4, 5, 7, 9, 11], "Major"),
    (&[0, 2, 3, 5, 7, 8, 10], "Natural Minor"),
    (&[0, 2, 3, 5, 7, 8, 11], "Harmonic Minor"),
    (&[0, 2, 3, 5, 7, 9, 11], "Melodic Minor"),
    
    // Modal scales  
    (&[0, 2, 3, 5, 7, 9, 10], "Dorian"),
    (&[0, 1, 3, 5, 7, 8, 10], "Phrygian"),
    (&[0, 2, 4, 6, 7, 9, 11], "Lydian"),
    (&[0, 2, 4, 5, 7, 9, 10], "Mixolydian"),
    (&[0, 2, 3, 5, 7, 8, 9], "Aeolian"),
    (&[0, 1, 3, 5, 6, 8, 10], "Locrian"),
    
    // Pentatonic scales
    (&[0, 2, 4, 7, 9], "Pentatonic Major"),
    (&[0, 3, 5, 7, 10], "Pentatonic Minor"),
    
    // Blues scales
    (&[0, 3, 5, 6, 7, 10], "Blues"),
    (&[0, 2, 3, 4, 7, 9], "Blues Major"),
    
    // Jazz scales
    (&[0, 1, 3, 4, 6, 8, 10], "Diminished"),
    (&[0, 2, 3, 5, 6, 8, 9, 11], "Diminished Half-Whole"),
    (&[0, 1, 4, 5, 7, 8, 11], "Hungarian Minor"),
    (&[0, 1, 3, 4, 6, 7, 9, 10], "Octatonic"),
    
    // World music scales
    (&[0, 1, 4, 5, 7, 8, 11], "Arabic"),
    (&[0, 1, 4, 6, 7, 8, 11], "Persian"),
    (&[0, 2, 4, 6, 8, 10], "Whole Tone"),
    (&[0, 2, 4, 7, 9, 10], "Hexatonic"),
    (&[0, 3, 5, 6, 7, 10, 11], "Enigmatic"),
    (&[0, 1, 3, 5, 6, 8, 9, 11], "Spanish"),
];

// Professional key profiles for maximum accuracy (2024+ research)
// EDM-A profiles - optimized for electronic and modern music (93% accuracy)
pub const EDMA_MAJOR: [f32; 12] = [0.194, 0.0, 0.108, 0.0, 0.151, 0.114, 0.0, 0.180, 0.0, 0.142, 0.0, 0.111];
pub const EDMA_MINOR: [f32; 12] = [0.192, 0.0, 0.110, 0.162, 0.0, 0.118, 0.0, 0.175, 0.142, 0.0, 0.101, 0.0];

// Krumhansl-Schmuckler (classical, still effective for tonal music)
pub const KS_MAJOR: [f32; 12] = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
pub const KS_MINOR: [f32; 12] = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

// Temperley (good for popular music)
pub const TEMPERLEY_MAJOR: [f32; 12] = [5.0, 2.0, 3.5, 2.0, 4.5, 4.0, 2.0, 4.5, 2.0, 3.5, 1.5, 4.0];
pub const TEMPERLEY_MINOR: [f32; 12] = [5.0, 2.0, 3.5, 4.5, 2.0, 4.0, 2.0, 4.5, 3.5, 2.0, 1.5, 4.0];

// Shaath profiles (good for electronic music)
pub const SHAATH_MAJOR: [f32; 12] = [6.6, 2.0, 3.5, 2.3, 4.6, 4.0, 2.5, 5.2, 2.4, 3.7, 2.3, 2.9];
pub const SHAATH_MINOR: [f32; 12] = [6.5, 2.7, 3.5, 5.4, 2.6, 3.5, 2.5, 4.7, 4.0, 2.7, 3.4, 3.2];

// Hybrid weighted profiles (combines best of multiple approaches)
pub const HYBRID_MAJOR: [f32; 12] = [0.251, 0.0, 0.108, 0.0, 0.191, 0.108, 0.0, 0.234, 0.0, 0.108, 0.0, 0.0];
pub const HYBRID_MINOR: [f32; 12] = [0.244, 0.0, 0.108, 0.186, 0.0, 0.119, 0.0, 0.230, 0.114, 0.0, 0.0, 0.0]; 