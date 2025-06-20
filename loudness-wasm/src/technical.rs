use wasm_bindgen::prelude::*;
use js_sys::Float32Array;
use std::f32::consts::PI;
use crate::utils::{amplitude_to_db, calculate_rms};

#[wasm_bindgen]
pub struct TechnicalAnalyzer {
    sample_rate: f32,
}

#[wasm_bindgen]
impl TechnicalAnalyzer {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32) -> Self {
        TechnicalAnalyzer { sample_rate }
    }

    // True Peak Detection (ITU-R BS.1770-4 compliant)
    fn calculate_true_peak(&self, pcm: &Float32Array) -> (f32, Vec<f32>, bool) {
        let mut max_true_peak = -f32::INFINITY;
        let mut peak_locations = Vec::new();
        
        // 4x oversampling for true peak detection
        let oversample_factor = 4;
        let _upsampled_length = pcm.length() as usize * oversample_factor;
        
        // Simple linear interpolation upsampling for true peak
        for i in 0..(pcm.length() as usize - 1) {
            let current = pcm.get_index(i as u32);
            let next = pcm.get_index((i + 1) as u32);
            
            for j in 0..oversample_factor {
                let t = j as f32 / oversample_factor as f32;
                let interpolated = current + t * (next - current);
                let abs_value = interpolated.abs();
                
                if abs_value > max_true_peak {
                    max_true_peak = abs_value;
                    peak_locations.push(i as f32 + t);
                }
            }
        }
        
        // Convert to dBTP (decibels True Peak)
        let true_peak_db = amplitude_to_db(max_true_peak);
        
        // Check broadcast compliance (-1.0 dBTP threshold)
        let is_compliant = true_peak_db <= -1.0;
        
        (true_peak_db, peak_locations, is_compliant)
    }

    // Digital Clipping Detection
    fn detect_clipping(&self, pcm: &Float32Array) -> (bool, u32, f32) {
        let mut clipped_samples = 0;
        let threshold = 0.99; // Digital clipping threshold
        
        for i in 0..pcm.length() {
            let sample = pcm.get_index(i).abs();
            if sample >= threshold {
                clipped_samples += 1;
            }
        }
        
        let clipping_percentage = (clipped_samples as f32 / pcm.length() as f32) * 100.0;
        let has_clipping = clipped_samples > 0;
        
        (has_clipping, clipped_samples, clipping_percentage)
    }

    // DC Offset Detection
    fn calculate_dc_offset(&self, pcm: &Float32Array) -> f32 {
        let mut sum = 0.0;
        for i in 0..pcm.length() {
            sum += pcm.get_index(i);
        }
        sum / pcm.length() as f32
    }

    // Spectral Analysis
    fn calculate_spectral_metrics(&self, pcm: &Float32Array) -> (f32, f32, f32, Vec<f32>) {
        let window_size = 4096.min(pcm.length() as usize);
        let mut spectral_centroid = 0.0;
        let mut spectral_rolloff = 0.0;
        let mut spectral_flatness = 0.0;
        let mut frequency_balance = vec![0.0; 7]; // 7 frequency bands
        let mut window_count = 0;

        // Process overlapping windows
        for start in (0..pcm.length() as usize).step_by(window_size / 2) {
            if start + window_size > pcm.length() as usize { break; }
            
            // Apply Hann window and compute spectrum
            let mut windowed = vec![0.0; window_size];
            let mut total_energy = 0.0;
            
            for i in 0..window_size {
                let window_val = 0.5 * (1.0 - (2.0 * PI * i as f32 / (window_size - 1) as f32).cos());
                let sample = pcm.get_index((start + i) as u32);
                windowed[i] = sample * window_val;
                total_energy += windowed[i] * windowed[i];
            }
            
            if total_energy < 1e-10 { continue; }
            
            // Simple DFT for spectrum analysis
            let mut spectrum = vec![0.0; window_size / 2];
            for k in 1..window_size / 2 {
                let mut real = 0.0;
                let mut imag = 0.0;
                let freq_scale = 2.0 * PI * k as f32 / window_size as f32;
                
                for i in 0..window_size {
                    let angle = freq_scale * i as f32;
                    real += windowed[i] * angle.cos();
                    imag += windowed[i] * angle.sin();
                }
                
                spectrum[k] = (real * real + imag * imag).sqrt();
            }
            
            // Calculate spectral centroid
            let mut weighted_freq_sum = 0.0;
            let mut magnitude_sum = 0.0;
            
            for (k, &magnitude) in spectrum.iter().enumerate() {
                let freq = k as f32 * self.sample_rate / window_size as f32;
                weighted_freq_sum += freq * magnitude;
                magnitude_sum += magnitude;
            }
            
            if magnitude_sum > 0.0 {
                spectral_centroid += weighted_freq_sum / magnitude_sum;
                
                // Calculate spectral rolloff (85% energy point)
                let energy_threshold = magnitude_sum * 0.85;
                let mut cumulative_energy = 0.0;
                for (k, &magnitude) in spectrum.iter().enumerate() {
                    cumulative_energy += magnitude;
                    if cumulative_energy >= energy_threshold {
                        spectral_rolloff += k as f32 * self.sample_rate / window_size as f32;
                        break;
                    }
                }
                
                // Calculate spectral flatness (geometric mean / arithmetic mean)
                let mut geometric_mean = 1.0;
                let mut arithmetic_mean = 0.0;
                let valid_bins = spectrum.len() - 1;
                
                for &magnitude in &spectrum[1..] {
                    if magnitude > 1e-10 {
                        geometric_mean *= magnitude.powf(1.0 / valid_bins as f32);
                        arithmetic_mean += magnitude;
                    }
                }
                arithmetic_mean /= valid_bins as f32;
                
                if arithmetic_mean > 0.0 {
                    spectral_flatness += geometric_mean / arithmetic_mean;
                }
                
                // Frequency balance analysis
                let bands = [
                    (20.0, 60.0),     // Sub-bass
                    (60.0, 250.0),    // Bass
                    (250.0, 500.0),   // Low-mids
                    (500.0, 2000.0),  // Mids
                    (2000.0, 5000.0), // Upper-mids
                    (5000.0, 8000.0), // Presence
                    (8000.0, 20000.0) // Brilliance
                ];
                
                for (band_idx, &(low_freq, high_freq)) in bands.iter().enumerate() {
                    let low_bin = (low_freq * window_size as f32 / self.sample_rate) as usize;
                    let high_bin = (high_freq * window_size as f32 / self.sample_rate) as usize;
                    
                    let mut band_energy = 0.0;
                    for k in low_bin..high_bin.min(spectrum.len()) {
                        band_energy += spectrum[k];
                    }
                    frequency_balance[band_idx] += band_energy;
                }
                
                window_count += 1;
            }
        }
        
        // Average results
        if window_count > 0 {
            spectral_centroid /= window_count as f32;
            spectral_rolloff /= window_count as f32;
            spectral_flatness /= window_count as f32;
            
            for balance in &mut frequency_balance {
                *balance /= window_count as f32;
            }
        }
        
        (spectral_centroid, spectral_rolloff, spectral_flatness, frequency_balance)
    }

    // Silence Detection
    fn detect_silence(&self, pcm: &Float32Array, threshold_db: f32) -> (f32, f32, Vec<(f32, f32)>) {
        let threshold_linear = 10.0_f32.powf(threshold_db / 20.0);
        let sample_rate = self.sample_rate;
        let mut silence_gaps = Vec::new();
        let mut in_silence = false;
        let mut silence_start = 0.0;
        
        // Leading silence
        let mut leading_silence = 0.0;
        for i in 0..pcm.length() {
            if pcm.get_index(i).abs() > threshold_linear {
                leading_silence = i as f32 / sample_rate;
                break;
            }
        }
        
        // Trailing silence
        let mut trailing_silence = 0.0;
        for i in (0..pcm.length()).rev() {
            if pcm.get_index(i).abs() > threshold_linear {
                trailing_silence = (pcm.length() - 1 - i) as f32 / sample_rate;
                break;
            }
        }
        
        // Find silence gaps
        for i in 0..pcm.length() {
            let current_time = i as f32 / sample_rate;
            let is_silent = pcm.get_index(i).abs() <= threshold_linear;
            
            if is_silent && !in_silence {
                in_silence = true;
                silence_start = current_time;
            } else if !is_silent && in_silence {
                in_silence = false;
                let gap_duration = current_time - silence_start;
                if gap_duration > 0.1 { // Only gaps longer than 100ms
                    silence_gaps.push((silence_start, current_time));
                }
            }
        }
        
        (leading_silence, trailing_silence, silence_gaps)
    }

    // Calculate PLR (Peak-to-Loudness Ratio)
    fn calculate_plr(&self, pcm: &Float32Array, integrated_loudness: f32) -> f32 {
        // Find peak level
        let mut peak: f32 = 0.0;
        for i in 0..pcm.length() {
            peak = peak.max(pcm.get_index(i).abs());
        }
        
        let peak_db = amplitude_to_db(peak);
        
        // PLR = Peak Level - Integrated Loudness
        peak_db - integrated_loudness
    }

    // Mastering Quality Assessment
    fn assess_mastering_quality(&self, pcm: &Float32Array, loudness: f32, dynamics: f32, spectral_balance: &[f32]) -> (f32, f32, f32, f32, f32) {
        let length = pcm.length() as usize;
        
        // Punchiness (transient preservation)
        let mut punchiness = 0.0;
        let window_size = (self.sample_rate * 0.01) as usize; // 10ms windows
        
        for i in (0..length).step_by(window_size) {
            let end = (i + window_size).min(length);
            let mut max_val: f32 = 0.0;
            let mut avg_val = 0.0;
            
            for j in i..end {
                let sample = pcm.get_index(j as u32).abs();
                max_val = max_val.max(sample);
                avg_val += sample;
            }
            
            avg_val /= (end - i) as f32;
            if avg_val > 1e-10 {
                punchiness += max_val / avg_val;
            }
        }
        punchiness /= (length / window_size) as f32;
        punchiness = (punchiness / 10.0).min(1.0); // Normalize
        
        // Warmth (low frequency content)
        let warmth = (spectral_balance[0] + spectral_balance[1]) / 2.0; // Sub-bass + bass
        let warmth_normalized = warmth.min(1.0);
        
        // Clarity (high frequency definition)
        let clarity = (spectral_balance[5] + spectral_balance[6]) / 2.0; // Presence + brilliance
        let clarity_normalized = clarity.min(1.0);
        
        // Spaciousness (estimate based on dynamics and balance)
        let spaciousness = (dynamics / 30.0).min(1.0); // Higher dynamics = more spacious
        
        // Overall mastering score
        let loudness_score = if loudness >= -16.0 && loudness <= -8.0 { 1.0 } else { 0.5 };
        let balance_score = if spectral_balance.iter().all(|&x| x > 0.1 && x < 2.0) { 1.0 } else { 0.7 };
        
        let mastering_score = (loudness_score + balance_score + punchiness + warmth_normalized + clarity_normalized) / 5.0 * 100.0;
        
        (punchiness, warmth_normalized, clarity_normalized, spaciousness, mastering_score)
    }

    #[wasm_bindgen]
    pub fn analyze_technical(&self, pcm: &Float32Array, integrated_loudness: f32) -> JsValue {
        // True Peak Analysis
        let (true_peak_db, peak_locations, broadcast_compliant) = self.calculate_true_peak(pcm);
        
        // Quality Metrics
        let (has_clipping, clipped_samples, clipping_percentage) = self.detect_clipping(pcm);
        let dc_offset = self.calculate_dc_offset(pcm);
        
        // Spectral Analysis
        let (spectral_centroid, spectral_rolloff, spectral_flatness, frequency_balance) = self.calculate_spectral_metrics(pcm);
        
        // Silence Detection
        let (leading_silence, trailing_silence, silence_gaps) = self.detect_silence(pcm, -60.0);
        
        // PLR Calculation
        let plr = self.calculate_plr(pcm, integrated_loudness);
        
        // Dynamic Range (simplified)
        let mut rms_values = Vec::new();
        let window_size = (self.sample_rate * 0.1) as usize; // 100ms windows
        
        for i in (0..pcm.length() as usize).step_by(window_size) {
            let end = (i + window_size).min(pcm.length() as usize);
            let mut samples = Vec::new();
            
            for j in i..end {
                samples.push(pcm.get_index(j as u32));
            }
            
            let rms = calculate_rms(&samples);
            if rms > 1e-10 {
                rms_values.push(amplitude_to_db(rms));
            }
        }
        
        rms_values.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let dynamic_range = if rms_values.len() > 0 {
            let p90 = rms_values[(rms_values.len() as f32 * 0.9) as usize];
            let p10 = rms_values[(rms_values.len() as f32 * 0.1) as usize];
            p90 - p10
        } else {
            0.0
        };
        
        // Mastering Quality Assessment
        let (punchiness, warmth, clarity, spaciousness, mastering_score) = 
            self.assess_mastering_quality(pcm, integrated_loudness, dynamic_range, &frequency_balance);
        
        // Create result object
        let result = js_sys::Object::new();
        
        // True Peak section
        let true_peak_obj = js_sys::Object::new();
        js_sys::Reflect::set(&true_peak_obj, &"level".into(), &true_peak_db.into()).unwrap();
        js_sys::Reflect::set(&true_peak_obj, &"locations".into(), &js_sys::Array::from_iter(peak_locations.iter().map(|&v| JsValue::from_f64(v as f64)))).unwrap();
        js_sys::Reflect::set(&true_peak_obj, &"broadcast_compliant".into(), &broadcast_compliant.into()).unwrap();
        js_sys::Reflect::set(&true_peak_obj, &"spotify_compliant".into(), &(true_peak_db <= -2.0).into()).unwrap();
        js_sys::Reflect::set(&true_peak_obj, &"youtube_compliant".into(), &(true_peak_db <= -1.0).into()).unwrap();
        js_sys::Reflect::set(&result, &"true_peak".into(), &true_peak_obj).unwrap();
        
        // Quality section
        let quality_obj = js_sys::Object::new();
        js_sys::Reflect::set(&quality_obj, &"has_clipping".into(), &has_clipping.into()).unwrap();
        js_sys::Reflect::set(&quality_obj, &"clipped_samples".into(), &clipped_samples.into()).unwrap();
        js_sys::Reflect::set(&quality_obj, &"clipping_percentage".into(), &clipping_percentage.into()).unwrap();
        js_sys::Reflect::set(&quality_obj, &"dc_offset".into(), &dc_offset.into()).unwrap();
        js_sys::Reflect::set(&result, &"quality".into(), &quality_obj).unwrap();
        
        // Spectral section
        let spectral_obj = js_sys::Object::new();
        js_sys::Reflect::set(&spectral_obj, &"centroid".into(), &spectral_centroid.into()).unwrap();
        js_sys::Reflect::set(&spectral_obj, &"rolloff".into(), &spectral_rolloff.into()).unwrap();
        js_sys::Reflect::set(&spectral_obj, &"flatness".into(), &spectral_flatness.into()).unwrap();
        
        let balance_obj = js_sys::Object::new();
        let band_names = ["sub_bass", "bass", "low_mids", "mids", "upper_mids", "presence", "brilliance"];
        for (i, &name) in band_names.iter().enumerate() {
            js_sys::Reflect::set(&balance_obj, &name.into(), &frequency_balance[i].into()).unwrap();
        }
        js_sys::Reflect::set(&spectral_obj, &"frequency_balance".into(), &balance_obj).unwrap();
        js_sys::Reflect::set(&result, &"spectral".into(), &spectral_obj).unwrap();
        
        // Silence section
        let silence_obj = js_sys::Object::new();
        js_sys::Reflect::set(&silence_obj, &"leading_silence".into(), &leading_silence.into()).unwrap();
        js_sys::Reflect::set(&silence_obj, &"trailing_silence".into(), &trailing_silence.into()).unwrap();
        js_sys::Reflect::set(&silence_obj, &"gap_count".into(), &silence_gaps.len().into()).unwrap();
        js_sys::Reflect::set(&result, &"silence".into(), &silence_obj).unwrap();
        
        // Mastering section
        let mastering_obj = js_sys::Object::new();
        js_sys::Reflect::set(&mastering_obj, &"plr".into(), &plr.into()).unwrap();
        js_sys::Reflect::set(&mastering_obj, &"dynamic_range".into(), &dynamic_range.into()).unwrap();
        js_sys::Reflect::set(&mastering_obj, &"punchiness".into(), &punchiness.into()).unwrap();
        js_sys::Reflect::set(&mastering_obj, &"warmth".into(), &warmth.into()).unwrap();
        js_sys::Reflect::set(&mastering_obj, &"clarity".into(), &clarity.into()).unwrap();
        js_sys::Reflect::set(&mastering_obj, &"spaciousness".into(), &spaciousness.into()).unwrap();
        js_sys::Reflect::set(&mastering_obj, &"quality_score".into(), &mastering_score.into()).unwrap();
        js_sys::Reflect::set(&result, &"mastering".into(), &mastering_obj).unwrap();
        
        result.into()
    }
} 