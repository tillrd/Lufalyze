use std::f32::consts::PI;

/// High-precision frequency to pitch class conversion
pub fn freq_to_pitch_class_precise(freq: f32) -> usize {
    if freq <= 0.0 { return 0; }
    
    // Use precise A4 = 440 Hz reference
    let a4_freq = 440.0;
    let semitones_from_a4 = 12.0 * (freq / a4_freq).log2();
    
    // Convert A-relative to C-relative: In chromatic scale C=0, A=9
    // So to convert from A=0 reference to C=0 reference, we add 9
    let pitch_class = ((semitones_from_a4 + 9.0).round() as i32) % 12;
    let pitch_class = if pitch_class < 0 { pitch_class + 12 } else { pitch_class };
    
    pitch_class as usize
}

/// Calculate Pearson correlation with professional optimizations
pub fn calculate_enhanced_correlation(chroma: &[f32], key_profile: &[f32], root: usize) -> f32 {
    // Calculate means
    let chroma_mean: f32 = chroma.iter().sum::<f32>() / chroma.len() as f32;
    let profile_mean: f32 = key_profile.iter().sum::<f32>() / key_profile.len() as f32;
    
    let mut numerator = 0.0;
    let mut chroma_variance = 0.0;
    let mut profile_variance = 0.0;
    
    for i in 0..12 {
        let chroma_idx = (i + root) % 12;
        let chroma_centered = chroma[chroma_idx] - chroma_mean;
        let profile_centered = key_profile[i] - profile_mean;
        
        numerator += chroma_centered * profile_centered;
        chroma_variance += chroma_centered * chroma_centered;
        profile_variance += profile_centered * profile_centered;
    }
    
    let denominator = (chroma_variance * profile_variance).sqrt();
    
    if denominator > 1e-8 {
        (numerator / denominator).max(-1.0).min(1.0)
    } else {
        0.0
    }
}

/// Professional FFT with optimal parameters for musical analysis
pub fn compute_professional_fft(samples: &[f32]) -> Vec<f32> {
    let n = samples.len();
    let mut magnitudes = vec![0.0; n / 2];
    
    // High-precision DFT optimized for musical analysis
    for k in 1..(n/2) {
        let mut real = 0.0;
        let mut imag = 0.0;
        let freq_scale = 2.0 * PI * k as f32 / n as f32;
        
        for i in 0..n {
            let angle = freq_scale * i as f32;
            let (sin_val, cos_val) = angle.sin_cos();
            real += samples[i] * cos_val;
            imag += samples[i] * sin_val;
        }
        
        magnitudes[k] = (real * real + imag * imag).sqrt() / (n as f32);
    }
    
    magnitudes
}

/// Simple DFT for performance-critical sections
pub fn compute_simple_fft(samples: &[f32]) -> Vec<f32> {
    let n = samples.len();
    let mut magnitudes = vec![0.0; n / 2];
    
    // Simple DFT for first half of frequency bins
    for k in 1..(n/2) {
        let mut real = 0.0;
        let mut imag = 0.0;
        let freq_scale = 2.0 * PI * k as f32 / n as f32;
        
        // Subsample for performance (every 4th sample)
        for i in (0..n).step_by(4) {
            let angle = freq_scale * i as f32;
            real += samples[i] * angle.cos();
            imag += samples[i] * angle.sin();
        }
        
        magnitudes[k] = (real * real + imag * imag).sqrt() / (n as f32 / 4.0);
    }
    
    magnitudes
}

/// Apply Blackman-Harris window for optimal frequency resolution
pub fn apply_blackman_harris_window(frame: &mut [f32]) {
    let frame_len = frame.len();
    for (i, sample) in frame.iter_mut().enumerate() {
        let w = 0.35875 
            - 0.48829 * (2.0 * PI * i as f32 / (frame_len - 1) as f32).cos()
            + 0.14128 * (4.0 * PI * i as f32 / (frame_len - 1) as f32).cos()
            - 0.01168 * (6.0 * PI * i as f32 / (frame_len - 1) as f32).cos();
        
        *sample *= w;
    }
}

/// Apply Hann window
pub fn apply_hann_window(frame: &mut [f32]) {
    let frame_len = frame.len();
    for (i, sample) in frame.iter_mut().enumerate() {
        let w = 0.5 * (1.0 - (2.0 * PI * i as f32 / (frame_len - 1) as f32).cos());
        *sample *= w;
    }
}

/// Normalize vector to sum to 1.0
pub fn normalize_vector(vector: &mut [f32]) {
    let sum: f32 = vector.iter().sum();
    if sum > 0.0 {
        for value in vector.iter_mut() {
            *value /= sum;
        }
    }
}

/// Calculate RMS energy of a signal
pub fn calculate_rms(samples: &[f32]) -> f32 {
    if samples.is_empty() { return 0.0; }
    
    let sum_squares: f32 = samples.iter().map(|&x| x * x).sum();
    (sum_squares / samples.len() as f32).sqrt()
}

/// Convert amplitude to dB
pub fn amplitude_to_db(amplitude: f32) -> f32 {
    if amplitude > 0.0 {
        20.0 * amplitude.log10()
    } else {
        f32::NEG_INFINITY
    }
}

/// Convert dB to amplitude
pub fn db_to_amplitude(db: f32) -> f32 {
    10.0_f32.powf(db / 20.0)
} 