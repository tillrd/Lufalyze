use wasm_bindgen::prelude::*;
use js_sys::Float32Array;

#[wasm_bindgen]
pub struct StereoAnalyzer {
    sample_rate: f32,
}

#[wasm_bindgen]
impl StereoAnalyzer {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32) -> Self {
        StereoAnalyzer {
            sample_rate,
        }
    }

    // Extract left and right channels from interleaved stereo PCM data - Optimized for performance
    fn extract_stereo_channels(&self, pcm: &Float32Array) -> (Vec<f32>, Vec<f32>) {
        let length = pcm.length() as usize;
        let samples_per_channel = length / 2;
        
        // Limit analysis to first 60 seconds for very long files to improve performance
        let max_samples_per_channel = (self.sample_rate as usize * 60).min(samples_per_channel);
        
        let mut left = Vec::with_capacity(max_samples_per_channel);
        let mut right = Vec::with_capacity(max_samples_per_channel);
        
        for i in 0..max_samples_per_channel {
            left.push(pcm.get_index((i * 2) as u32));      // Left channel
            right.push(pcm.get_index((i * 2 + 1) as u32)); // Right channel
        }
        
        (left, right)
    }

    // Calculate phase correlation between L/R channels
    // Returns value between -1 (out of phase) and +1 (in phase)
    fn calculate_phase_correlation(&self, left: &[f32], right: &[f32]) -> f32 {
        if left.len() != right.len() || left.is_empty() {
            return 0.0;
        }

        let mut sum_lr = 0.0;
        let mut sum_ll = 0.0;
        let mut sum_rr = 0.0;

        // Calculate cross-correlation and auto-correlations
        for i in 0..left.len() {
            let l = left[i];
            let r = right[i];
            
            sum_lr += l * r;
            sum_ll += l * l;
            sum_rr += r * r;
        }

        // Pearson correlation coefficient
        let denominator = (sum_ll * sum_rr).sqrt();
        if denominator > 1e-10 {
            (sum_lr / denominator).max(-1.0).min(1.0)
        } else {
            0.0
        }
    }

    // Calculate stereo width using Mid/Side analysis
    // Returns value between 0 (mono) and 1 (full stereo width)
    fn calculate_stereo_width(&self, left: &[f32], right: &[f32]) -> f32 {
        if left.len() != right.len() || left.is_empty() {
            return 0.0;
        }

        let mut mid_energy = 0.0;
        let mut side_energy = 0.0;

        // Convert to Mid/Side and calculate energies
        for i in 0..left.len() {
            let mid = (left[i] + right[i]) * 0.5;   // Mid = (L + R) / 2
            let side = (left[i] - right[i]) * 0.5;  // Side = (L - R) / 2
            
            mid_energy += mid * mid;
            side_energy += side * side;
        }

        let total_energy = mid_energy + side_energy;
        if total_energy > 1e-10 {
            // Normalize to 0-1 range where 0.5 is typical stereo content
            (side_energy / total_energy * 2.0).min(1.0)
        } else {
            0.0
        }
    }

    // Calculate L/R balance in dB
    // Positive values = right louder, negative = left louder
    fn calculate_lr_balance(&self, left: &[f32], right: &[f32]) -> f32 {
        if left.len() != right.len() || left.is_empty() {
            return 0.0;
        }

        let mut left_energy = 0.0;
        let mut right_energy = 0.0;

        // Calculate RMS energy for each channel
        for i in 0..left.len() {
            left_energy += left[i] * left[i];
            right_energy += right[i] * right[i];
        }

        let left_rms = (left_energy / left.len() as f32).sqrt();
        let right_rms = (right_energy / right.len() as f32).sqrt();

        // Convert to dB difference
        if left_rms > 1e-10 && right_rms > 1e-10 {
            20.0 * (right_rms / left_rms).log10()
        } else if right_rms > 1e-10 {
            20.0 // Right only
        } else if left_rms > 1e-10 {
            -20.0 // Left only
        } else {
            0.0 // No signal
        }
    }

    // Test mono compatibility by checking for phase cancellation
    // Returns value between 0 (bad mono compatibility) and 1 (perfect mono compatibility)
    fn calculate_mono_compatibility(&self, left: &[f32], right: &[f32]) -> f32 {
        if left.len() != right.len() || left.is_empty() {
            return 1.0;
        }

        let mut stereo_energy = 0.0;
        let mut mono_energy = 0.0;

        // Calculate energy of stereo signal vs mono sum
        for i in 0..left.len() {
            let stereo_sample = (left[i] + right[i]) * 0.5;
            let mono_sample = stereo_sample;
            
            stereo_energy += left[i] * left[i] + right[i] * right[i];
            mono_energy += mono_sample * mono_sample * 2.0; // Multiply by 2 for fair comparison
        }

        if stereo_energy > 1e-10 {
            (mono_energy / stereo_energy).min(1.0)
        } else {
            1.0
        }
    }

    // Analyze stereo imaging quality based on phase coherence across frequency bands - Optimized
    fn calculate_imaging_quality(&self, left: &[f32], right: &[f32]) -> f32 {
        if left.len() != right.len() || left.is_empty() {
            return 0.0;
        }

        // Analyze phase coherence in different frequency bands
        let window_size = 512.min(left.len()); // Smaller window for speed
        let mut coherence_sum = 0.0;
        let mut window_count = 0;

        // Process overlapping windows with larger steps for speed
        let step_size = if left.len() > 44100 * 10 { window_size } else { window_size / 2 }; // Larger steps for long files
        for start in (0..left.len().saturating_sub(window_size)).step_by(step_size) {
            let end = (start + window_size).min(left.len());
            let window_left = &left[start..end];
            let window_right = &right[start..end];

            // Calculate phase correlation for this window
            let correlation = self.calculate_phase_correlation(window_left, window_right);
            
            // Weight by window energy to focus on audible content
            let mut window_energy = 0.0;
            for i in 0..window_left.len() {
                window_energy += window_left[i] * window_left[i] + window_right[i] * window_right[i];
            }

            if window_energy > 1e-8 {
                coherence_sum += correlation.abs() * window_energy.sqrt();
                window_count += 1;
            }
        }

        if window_count > 0 {
            (coherence_sum / window_count as f32).min(1.0)
        } else {
            0.0
        }
    }

    // Classify stereo imaging quality
    fn classify_imaging(&self, phase_correlation: f32, stereo_width: f32, mono_compatibility: f32) -> &'static str {
        let overall_score = (phase_correlation.abs() + stereo_width + mono_compatibility) / 3.0;
        
        if overall_score >= 0.85 {
            "Professional"
        } else if overall_score >= 0.7 {
            "High Quality"
        } else if overall_score >= 0.5 {
            "Good"
        } else if overall_score >= 0.3 {
            "Fair"
        } else {
            "Poor"
        }
    }

    #[wasm_bindgen]
    pub fn analyze_stereo(&self, pcm: &Float32Array) -> JsValue {
        // Check if we have stereo data (even number of samples)
        if pcm.length() % 2 != 0 {
            // Return mono analysis result
            let result = js_sys::Object::new();
            js_sys::Reflect::set(&result, &"is_mono".into(), &true.into()).unwrap();
            js_sys::Reflect::set(&result, &"channels".into(), &1.into()).unwrap();
            js_sys::Reflect::set(&result, &"mono_compatibility".into(), &1.0.into()).unwrap();
            js_sys::Reflect::set(&result, &"imaging_quality".into(), &"Perfect".into()).unwrap();
            return result.into();
        }

        // Extract stereo channels
        let (left, right) = self.extract_stereo_channels(pcm);

        // Perform all stereo analysis calculations
        let phase_correlation = self.calculate_phase_correlation(&left, &right);
        let stereo_width = self.calculate_stereo_width(&left, &right);
        let lr_balance = self.calculate_lr_balance(&left, &right);
        let mono_compatibility = self.calculate_mono_compatibility(&left, &right);
        let imaging_quality_score = self.calculate_imaging_quality(&left, &right);
        let imaging_quality = self.classify_imaging(phase_correlation, stereo_width, mono_compatibility);

        // Create result object
        let result = js_sys::Object::new();
        
        // Basic info
        js_sys::Reflect::set(&result, &"is_mono".into(), &false.into()).unwrap();
        js_sys::Reflect::set(&result, &"channels".into(), &2.into()).unwrap();
        
        // Stereo analysis results
        js_sys::Reflect::set(&result, &"phase_correlation".into(), &phase_correlation.into()).unwrap();
        js_sys::Reflect::set(&result, &"stereo_width".into(), &stereo_width.into()).unwrap();
        js_sys::Reflect::set(&result, &"lr_balance".into(), &lr_balance.into()).unwrap();
        js_sys::Reflect::set(&result, &"mono_compatibility".into(), &mono_compatibility.into()).unwrap();
        js_sys::Reflect::set(&result, &"imaging_quality_score".into(), &imaging_quality_score.into()).unwrap();
        js_sys::Reflect::set(&result, &"imaging_quality".into(), &imaging_quality.into()).unwrap();

        result.into()
    }
} 