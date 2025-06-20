use js_sys::Float32Array;
use std::f32::consts::PI;
use crate::constants::*;
use crate::utils::*;

// HPCP (Harmonic Pitch Class Profile) state for professional key detection
pub struct HpcpState {
    frames: Vec<Vec<f32>>,          // Ring buffer of HPCP frames
    frame_count: usize,             // Current frame index
    ready: bool,                    // Whether we have enough frames
}

impl HpcpState {
    pub fn new() -> Self {
        HpcpState {
            frames: Vec::new(),
            frame_count: 0,
            ready: false,
        }
    }
    
    pub fn add_frame(&mut self, hpcp_frame: Vec<f32>) {
        self.frames.push(hpcp_frame);
        self.frame_count += 1;
        
        // We need at least 10 frames for stable analysis
        if self.frame_count >= 10 {
            self.ready = true;
        }
        
        // Keep only last 50 frames for memory efficiency
        if self.frames.len() > 50 {
            self.frames.remove(0);
        }
    }
    
    pub fn get_pooled_hpcp(&self) -> Vec<f32> {
        if !self.ready || self.frames.is_empty() {
            return vec![0.0; 12];
        }
        
        // Apply temporal pooling (median + mean combination)
        let mut pooled = vec![0.0; 12];
        
        for bin in 0..12 {
            let mut values: Vec<f32> = self.frames.iter().map(|frame| frame[bin]).collect();
            values.sort_by(|a, b| a.partial_cmp(b).unwrap());
            
            // Median for stability
            let median = if values.len() % 2 == 0 {
                (values[values.len()/2 - 1] + values[values.len()/2]) / 2.0
            } else {
                values[values.len()/2]
            };
            
            // Mean for energy preservation
            let mean: f32 = values.iter().sum::<f32>() / values.len() as f32;
            
            // Combine median (70%) and mean (30%) for optimal stability and sensitivity
            pooled[bin] = 0.7 * median + 0.3 * mean;
        }
        
        // Normalize
        let sum: f32 = pooled.iter().sum();
        if sum > 0.0 {
            for value in &mut pooled {
                *value /= sum;
            }
        }
        
        pooled
    }
}

pub struct ChromaExtractor {
    sample_rate: f32,
}

impl ChromaExtractor {
    pub fn new(sample_rate: f32) -> Self {
        ChromaExtractor { sample_rate }
    }

    pub fn extract_advanced(&self, pcm: &Float32Array) -> Vec<f32> {
        // Initialize HPCP state
        let mut hpcp_state = HpcpState::new();
        
        // Adaptive tuning detection (±50 cent search)
        let tuning_offset = self.detect_tuning_offset(pcm);
        
        let max_samples = (MAX_ANALYSIS_SAMPLES as u32).min(pcm.length());
        let mut frame_count = 0;
        
        // Stage 1: Windowed FFT with 50% hop (Classical DSP chain)
        for window_start in (0..max_samples as usize).step_by(HOP_SIZE) {
            if window_start + FFT_SIZE > max_samples as usize { break; }
            if frame_count >= 100 { break; } // Process up to 100 frames
            
            // Extract frame with Blackman-Harris window for optimal frequency resolution
            let mut frame = vec![0.0; FFT_SIZE];
            let mut window_energy = 0.0;
            
            for i in 0..FFT_SIZE {
                let sample = pcm.get_index((window_start + i) as u32);
                frame[i] = sample;
            }
            
            apply_blackman_harris_window(&mut frame);
            
            for i in 0..FFT_SIZE {
                window_energy += frame[i] * frame[i];
            }
            
            // Skip frames with insufficient energy
            if window_energy < 1e-6 { continue; }
            
            // Stage 2: High-resolution spectrum
            let spectrum = compute_professional_fft(&frame);
            
            // Stage 3: Spectral whitening to reduce timbral bias
            let whitened_spectrum = self.apply_spectral_whitening(&spectrum);
            
            // Stage 4: Spectral peak picking
            let peaks = self.pick_spectral_peaks(&whitened_spectrum);
            
            // Stage 5: HPCP frame computation with harmonic weighting
            let hpcp_frame = self.compute_hpcp_frame(&peaks, tuning_offset);
            
            // Add frame to temporal buffer
            hpcp_state.add_frame(hpcp_frame);
            frame_count += 1;
        }
        
        // Stage 6: Frame pooling (median + mean)
        hpcp_state.get_pooled_hpcp()
    }

    // Detect tuning offset for adaptive tuning (±50 cent search)
    fn detect_tuning_offset(&self, pcm: &Float32Array) -> f32 {
        let mut best_offset = 0.0;
        let mut best_score = 0.0;
        
        // Search in ±50 cent range with 10 cent steps
        for offset_cents in (-50..=50).step_by(10) {
            let offset = offset_cents as f32;
            let score = self.calculate_tuning_score(pcm, offset);
            
            if score > best_score {
                best_score = score;
                best_offset = offset;
            }
        }
        
        best_offset
    }

    // Calculate tuning score for a given offset
    fn calculate_tuning_score(&self, pcm: &Float32Array, offset_cents: f32) -> f32 {
        let max_samples = (pcm.length() / 8).min(44100); // Quick analysis
        let mut total_harmony = 0.0;
        let mut frame_count = 0;
        
        for window_start in (0..max_samples as usize).step_by(2048) {
            if window_start + 2048 > max_samples as usize { break; }
            
            let mut frame = vec![0.0; 2048];
            for i in 0..2048 {
                frame[i] = pcm.get_index((window_start + i) as u32);
            }
            
            let spectrum = compute_simple_fft(&frame);
            let harmony_score = self.calculate_harmonic_content(&spectrum, offset_cents);
            
            total_harmony += harmony_score;
            frame_count += 1;
        }
        
        if frame_count > 0 { total_harmony / frame_count as f32 } else { 0.0 }
    }

    // Calculate harmonic content with tuning offset
    fn calculate_harmonic_content(&self, spectrum: &[f32], offset_cents: f32) -> f32 {
        let mut harmony_score = 0.0;
        let cent_factor = 2.0_f32.powf(offset_cents / 1200.0);
        
        for (bin, &magnitude) in spectrum.iter().enumerate().take(spectrum.len() / 4) {
            if magnitude < 1e-6 { continue; }
            
            let freq = (bin as f32 * self.sample_rate / (spectrum.len() * 2) as f32) * cent_factor;
            
            if freq >= MIN_FREQ && freq <= MAX_FREQ {
                // Look for harmonic relationships
                for harmonic in 2..=8 {
                    let harmonic_freq = freq * harmonic as f32;
                    let harmonic_bin = (harmonic_freq * (spectrum.len() * 2) as f32 / self.sample_rate) as usize;
                    
                    if harmonic_bin < spectrum.len() && spectrum[harmonic_bin] > magnitude * 0.1 {
                        harmony_score += magnitude * spectrum[harmonic_bin] / harmonic as f32;
                    }
                }
            }
        }
        
        harmony_score
    }

    // Apply spectral whitening to reduce timbral bias
    fn apply_spectral_whitening(&self, spectrum: &[f32]) -> Vec<f32> {
        let mut whitened = spectrum.to_vec();
        
        // Calculate local average for each bin
        let window_size = 5; // Local averaging window
        
        for i in 0..spectrum.len() {
            let start = i.saturating_sub(window_size / 2);
            let end = (i + window_size / 2 + 1).min(spectrum.len());
            
            let local_avg: f32 = spectrum[start..end].iter().sum::<f32>() / (end - start) as f32;
            
            if local_avg > 1e-8 {
                // Apply spectral whitening with controlled strength
                whitened[i] = spectrum[i] / (local_avg.powf(SPECTRAL_WHITENING_FACTOR));
            }
        }
        
        whitened
    }

    // Professional spectral peak picking
    fn pick_spectral_peaks(&self, spectrum: &[f32]) -> Vec<(f32, f32)> { // (frequency, magnitude)
        let mut peaks = Vec::new();
        let threshold_db = PEAK_THRESHOLD;
        let threshold_linear = 10.0_f32.powf(threshold_db / 20.0);
        
        // Find local maxima above threshold
        for i in 2..(spectrum.len() - 2) {
            let magnitude = spectrum[i];
            
            if magnitude > threshold_linear && 
               magnitude > spectrum[i - 1] && magnitude > spectrum[i + 1] &&
               magnitude > spectrum[i - 2] && magnitude > spectrum[i + 2] {
                
                let freq = i as f32 * self.sample_rate / (spectrum.len() * 2) as f32;
                
                if freq >= MIN_FREQ && freq <= MAX_FREQ {
                    peaks.push((freq, magnitude));
                }
            }
        }
        
        // Sort by magnitude (strongest peaks first)
        peaks.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        
        // Keep only top peaks to avoid noise
        peaks.truncate(50);
        
        peaks
    }

    // Compute HPCP frame with harmonic weighting
    fn compute_hpcp_frame(&self, peaks: &[(f32, f32)], tuning_offset: f32) -> Vec<f32> {
        let mut hpcp = vec![0.0; 12];
        let cent_factor = 2.0_f32.powf(tuning_offset / 1200.0);
        
        for &(freq, magnitude) in peaks {
            let adjusted_freq = freq * cent_factor;
            
            // Add fundamental frequency with highest weight
            let fundamental_pc = freq_to_pitch_class_precise(adjusted_freq);
            hpcp[fundamental_pc] += magnitude;
            
            // Consider harmonics with decreasing weight
            for harmonic in 2..=NUM_HARMONICS {
                let harmonic_freq = adjusted_freq / harmonic as f32;
                
                if harmonic_freq >= MIN_FREQ {
                    let harmonic_pc = freq_to_pitch_class_precise(harmonic_freq);
                    let weight = magnitude / (harmonic as f32).sqrt(); // Harmonic decay
                    
                    hpcp[harmonic_pc] += weight;
                }
            }
        }
        
        // Normalize frame
        normalize_vector(&mut hpcp);
        
        hpcp
    }

    // Additional extraction methods for comparison/benchmarking

    // STFT-based chroma extraction with multiple window sizes
    #[allow(dead_code)]
    pub fn extract_chroma_stft(&self, pcm: &Float32Array) -> Vec<f32> {
        let samples = self.preprocess_audio(pcm);
        let mut chroma = vec![0.0; CHROMA_SIZE];
        let mut frame_count = 0;
        
        // Use multiple window sizes for different frequency ranges
        let window_sizes = [8192, 16384]; // Different resolutions
        
        for &window_size in &window_sizes {
            let hop_size = window_size / 4; // 75% overlap for better temporal resolution
            
            for window_start in (0..samples.len()).step_by(hop_size) {
                if window_start + window_size > samples.len() { break; }
                if frame_count >= MAX_FRAMES { break; }
                
                // Extract frame with Blackman-Harris window (better frequency resolution)
                let mut frame = vec![0.0; window_size];
                let mut window_energy = 0.0;
                
                for i in 0..window_size {
                    frame[i] = samples[window_start + i];
                }
                
                apply_blackman_harris_window(&mut frame);
                
                for i in 0..window_size {
                    window_energy += frame[i] * frame[i];
                }
                
                // Only process frames with sufficient energy
                if window_energy < 1e-6 { continue; }
                
                // High-quality FFT
                let spectrum = compute_professional_fft(&frame);
                
                // Extract chroma with advanced frequency mapping
                let frame_chroma = self.spectrum_to_chroma_advanced(&spectrum, window_size);
                
                // Weight by energy and window size
                let weight = window_energy.sqrt() * (window_size as f32 / 16384.0);
            
                for i in 0..CHROMA_SIZE {
                    chroma[i] += frame_chroma[i] * weight;
                }
            
                frame_count += 1;
            }
        }
        
        // Normalize
        normalize_vector(&mut chroma);
        
        chroma
    }

    // Constant-Q Transform based chroma for better musical frequency resolution
    #[allow(dead_code)]
    pub fn extract_chroma_cqt(&self, pcm: &Float32Array) -> Vec<f32> {
        let samples = self.preprocess_audio(pcm);
        let mut chroma = vec![0.0; CHROMA_SIZE];
        
        // Simulate CQT with logarithmically spaced frequencies
        let mut cqt_bins = Vec::new();
        let q_factor = 1.0 / (2.0_f32.powf(1.0 / CQT_BINS_PER_OCTAVE as f32) - 1.0);
        
        // Generate CQT frequency bins from C2 to C8
        let mut freq = MIN_FREQ;
        while freq <= MAX_FREQ {
            cqt_bins.push(freq);
            freq *= 2.0_f32.powf(1.0 / CQT_BINS_PER_OCTAVE as f32);
        }
        
        // Calculate CQT using multiple window sizes adapted to frequency
        for &center_freq in &cqt_bins {
            let window_size = ((q_factor * self.sample_rate / center_freq) as usize).max(1024).min(16384);
            let hop_size = window_size / 8; // High overlap for CQT
            
            let mut bin_energy = 0.0;
            let mut frame_count = 0;
            
            for window_start in (0..samples.len()).step_by(hop_size) {
                if window_start + window_size > samples.len() { break; }
                if frame_count >= 50 { break; } // Limit frames per frequency
                
                // Create frequency-adapted window
                let mut frame = vec![0.0; window_size];
                for i in 0..window_size {
                    frame[i] = samples[window_start + i];
                }
                
                apply_hann_window(&mut frame);
                
                // Calculate energy at this specific frequency using complex demodulation
                let mut real_sum = 0.0;
                let mut imag_sum = 0.0;
                
                for i in 0..window_size {
                    let phase = 2.0 * PI * center_freq * i as f32 / self.sample_rate;
                    real_sum += frame[i] * phase.cos();
                    imag_sum += frame[i] * phase.sin();
                }
                
                bin_energy += (real_sum * real_sum + imag_sum * imag_sum).sqrt();
                frame_count += 1;
            }
            
            if frame_count > 0 {
                bin_energy /= frame_count as f32;
                
                // Map to chroma bin
                let pitch_class = freq_to_pitch_class_precise(center_freq);
                chroma[pitch_class] += bin_energy;
            }
        }
        
        // Normalize
        normalize_vector(&mut chroma);
        
        chroma
    }

    // Audio preprocessing with noise gating and dynamic range optimization
    #[allow(dead_code)]
    fn preprocess_audio(&self, pcm: &Float32Array) -> Vec<f32> {
        let max_samples = (MAX_ANALYSIS_SAMPLES as u32).min(pcm.length());
        let mut processed = Vec::with_capacity(max_samples as usize);
        
        // Calculate RMS for noise gating
        let mut rms_sum = 0.0;
        for i in 0..max_samples {
            let sample = pcm.get_index(i);
            rms_sum += sample * sample;
        }
        let rms = (rms_sum / max_samples as f32).sqrt();
        let noise_threshold = rms * 10.0_f32.powf(NOISE_FLOOR / 20.0);
        
        // Apply noise gate and dynamic range compression
        for i in 0..max_samples {
            let sample = pcm.get_index(i);
            let abs_sample = sample.abs();
            
            // Noise gate
            let gated_sample = if abs_sample > noise_threshold {
                sample
            } else {
                sample * 0.1 // Reduce but don't eliminate
            };
            
            // Gentle compression for better weak signal detection
            let compressed = if abs_sample > 0.5 {
                gated_sample.signum() * (0.5 + 0.5 * (abs_sample - 0.5).tanh())
            } else {
                gated_sample
            };
            
            processed.push(compressed);
        }
        
        processed
    }

    // Advanced spectrum to chroma conversion with sophisticated frequency weighting
    #[allow(dead_code)]
    fn spectrum_to_chroma_advanced(&self, spectrum: &[f32], window_size: usize) -> Vec<f32> {
        let mut chroma = vec![0.0; CHROMA_SIZE];
        
        for (bin, &magnitude) in spectrum.iter().enumerate() {
            if bin == 0 || magnitude < 1e-8 { continue; }
            
            // Precise frequency calculation
            let freq = (bin as f32) * self.sample_rate / window_size as f32;
            
            if freq >= MIN_FREQ && freq <= MAX_FREQ {
                let pitch_class = freq_to_pitch_class_precise(freq);
                
                // Advanced frequency weighting with psychoacoustic modeling
                let weight = self.calculate_perceptual_weight(freq, magnitude);
                
                chroma[pitch_class] += magnitude * weight;
            }
        }
        
        chroma
    }

    // Calculate perceptual weight based on frequency and magnitude
    #[allow(dead_code)]
    fn calculate_perceptual_weight(&self, freq: f32, magnitude: f32) -> f32 {
        // Base weight from frequency range
        let freq_weight = if freq >= 80.0 && freq <= 400.0 {
            // Fundamental range: maximum weight
            2.5
        } else if freq >= 400.0 && freq <= 800.0 {
            // Lower harmonics: high weight
            1.8
        } else if freq >= 800.0 && freq <= 1600.0 {
            // Mid harmonics: medium weight
            1.2
        } else if freq >= 1600.0 && freq <= 3200.0 {
            // Higher harmonics: reduced weight
            0.6
        } else {
            // Very high frequencies: minimal weight
            0.2
        };
        
        // Magnitude-based adjustment (louder = more reliable)
        let magnitude_weight = (magnitude.log10() + 6.0).max(0.1).min(2.0);
        
        // Psychoacoustic masking: reduce weight near very strong peaks
        let masking_weight = 1.0 / (1.0 + magnitude * 2.0);
        
        freq_weight * magnitude_weight * masking_weight
    }
} 