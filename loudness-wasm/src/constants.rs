// Constants for ITU-R BS.1770-4
pub const ABSOLUTE_GATE: f32 = -70.0;         // Absolute gate threshold in LUFS
pub const RELATIVE_GATE: f32 = -10.0;         // Relative gate threshold in LUFS

// Constants for ITU-R BS.1770-4
pub const MOMENTARY_BLOCK_SIZE: usize = 17640;  // 400ms at 44.1kHz
pub const MOMENTARY_HOP: usize = 4410;          // 100ms hop
pub const SHORT_TERM_BLOCK_SIZE: usize = 132300; // 3s at 44.1kHz
pub const SHORT_TERM_HOP: usize = 13230;        // 300ms hop

// K-weighting filter coefficients for 44.1kHz
pub const K_B: [f32; 3] = [1.5351249, -2.6916962, 1.1983928];
pub const K_A: [f32; 3] = [1.0, -1.6906593, 0.73248076]; 