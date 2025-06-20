use wasm_bindgen::prelude::*;
use js_sys::Float32Array;

pub mod chroma;
pub mod keydetection;
pub mod scale_analysis;
pub mod skey;

use crate::constants::*;
use crate::utils::*;
use chroma::ChromaExtractor;
use keydetection::KeyDetector;
use scale_analysis::ScaleAnalyzer;
use skey::SKEYNetwork;

#[wasm_bindgen]
pub struct MusicAnalyzer {
    sample_rate: f32,
    skey_enabled: bool,
    chroma_extractor: ChromaExtractor,
    key_detector: KeyDetector,
    scale_analyzer: ScaleAnalyzer,
}

#[wasm_bindgen]
impl MusicAnalyzer {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32) -> Self {
        MusicAnalyzer {
            sample_rate,
            skey_enabled: true,
            chroma_extractor: ChromaExtractor::new(sample_rate),
            key_detector: KeyDetector::new(),
            scale_analyzer: ScaleAnalyzer::new(),
        }
    }

    #[wasm_bindgen]
    pub fn set_skey_enabled(&mut self, enabled: bool) {
        self.skey_enabled = enabled;
    }

    // Professional HPCP-based chroma extraction following MIR best practices
    fn extract_chroma_advanced(&self, pcm: &Float32Array) -> Vec<f32> {
        self.chroma_extractor.extract_advanced(pcm)
    }

    // Categorize scale types for better UI organization
    fn categorize_scale(&self, scale_name: &str) -> &'static str {
        if scale_name.contains("Major") || scale_name.contains("Lydian") || scale_name.contains("Mixolydian") {
            "Major Family"
        } else if scale_name.contains("Minor") || scale_name.contains("Dorian") || scale_name.contains("Phrygian") || scale_name.contains("Aeolian") {
            "Minor Family"
        } else if scale_name.contains("Pentatonic") {
            "Pentatonic"
        } else if scale_name.contains("Blues") {
            "Blues"
        } else if scale_name.contains("Diminished") || scale_name.contains("Locrian") {
            "Diminished"
        } else if scale_name.contains("Arabic") || scale_name.contains("Persian") || scale_name.contains("Hungarian") || scale_name.contains("Spanish") {
            "World/Exotic"
        } else {
            "Other"
        }
    }

    // Calculate tonal clarity (how clearly defined the key is)
    fn calculate_tonal_clarity(&self, chroma: &[f32]) -> f32 {
        // Find the strongest pitch class
        let max_value = chroma.iter().fold(0.0f32, |a, &b| a.max(b));
        
        // Calculate how much stronger the peak is compared to the average
        let average = chroma.iter().sum::<f32>() / chroma.len() as f32;
        
        if average > 0.0 {
            (max_value / average).min(10.0) / 10.0 // Normalize to 0-1
        } else {
            0.0
        }
    }

    // Calculate harmonic complexity
    fn calculate_harmonic_complexity(&self, chroma: &[f32]) -> f32 {
        // Count significant pitch classes (above threshold)
        let threshold = chroma.iter().fold(0.0f32, |a, &b| a.max(b)) * 0.3;
        let active_pitches = chroma.iter().filter(|&&x| x > threshold).count();
        
        // More active pitches = higher complexity
        (active_pitches as f32 / 12.0).min(1.0)
    }

    #[wasm_bindgen]
    pub fn analyze_music(&self, pcm: &Float32Array) -> JsValue {
        // Extract chroma vector using advanced FFT-based method
        let chroma = self.extract_chroma_advanced(pcm);
        
        // Advanced key detection with multiple profiles
        let (root, is_major, confidence) = self.key_detector.detect_key(&chroma);
        let key_name = format!("{} {}", NOTE_NAMES[root], if is_major { "Major" } else { "Minor" });
        
        // Advanced scale analysis with sophisticated pattern matching
        let scale_matches = self.scale_analyzer.analyze_scales(&chroma, root);
        
        // Calculate additional analysis metrics
        let tonal_clarity = self.calculate_tonal_clarity(&chroma);
        let harmonic_complexity = self.calculate_harmonic_complexity(&chroma);
        
        // Create enhanced result object
        let result = js_sys::Object::new();
        
        // Key detection results
        js_sys::Reflect::set(&result, &"key".into(), &key_name.into()).unwrap();
        js_sys::Reflect::set(&result, &"root_note".into(), &NOTE_NAMES[root].into()).unwrap();
        js_sys::Reflect::set(&result, &"is_major".into(), &is_major.into()).unwrap();
        js_sys::Reflect::set(&result, &"confidence".into(), &confidence.into()).unwrap();
        
        // Additional analysis metrics
        js_sys::Reflect::set(&result, &"tonal_clarity".into(), &tonal_clarity.into()).unwrap();
        js_sys::Reflect::set(&result, &"harmonic_complexity".into(), &harmonic_complexity.into()).unwrap();
        
        // Enhanced chroma vector for visualization
        let chroma_array = js_sys::Array::new();
        for &value in &chroma {
            chroma_array.push(&JsValue::from_f64(value as f64));
        }
        js_sys::Reflect::set(&result, &"chroma".into(), &chroma_array).unwrap();
        
        // Scale analysis results with enhanced data
        let scales_array = js_sys::Array::new();
        for (scale_name, strength) in scale_matches {
            let scale_obj = js_sys::Object::new();
            
            // Add scale category information first (before moving scale_name)
            let category = self.categorize_scale(&scale_name);
            js_sys::Reflect::set(&scale_obj, &"category".into(), &category.into()).unwrap();
            
            js_sys::Reflect::set(&scale_obj, &"name".into(), &scale_name.into()).unwrap();
            js_sys::Reflect::set(&scale_obj, &"strength".into(), &strength.into()).unwrap();
            
            scales_array.push(&scale_obj);
        }
        js_sys::Reflect::set(&result, &"scales".into(), &scales_array).unwrap();
        
        result.into()
    }

    // S-KEY Enhanced Analysis Method
    #[wasm_bindgen]
    pub fn analyze_music_with_skey(&self, pcm: &Float32Array) -> JsValue {
        // Extract traditional chroma
        let traditional_chroma = self.extract_chroma_advanced(pcm);
        
        // Run traditional algorithm
        let (traditional_root, traditional_is_major, traditional_confidence) = self.key_detector.detect_key(&traditional_chroma);
        
        // Try S-KEY enhancement if enabled  
        let mut final_result = (traditional_root, traditional_is_major, traditional_confidence);
        let mut method = "Traditional";
        let mut enhanced = false;

        if self.skey_enabled {
            match self.extract_skey_features(pcm) {
                Ok(skey_features) => {
                    let mut skey_network = SKEYNetwork::new();
                    if skey_network.initialize().is_ok() {
                        match skey_network.predict(&skey_features) {
                            Ok((skey_root, skey_is_major, skey_confidence)) => {
                                // Use S-KEY if confidence is reasonable or if traditional is very low
                                if skey_confidence > 0.1 && (skey_confidence > traditional_confidence * 0.8 || traditional_confidence < 0.4) {
                                    final_result = (skey_root, skey_is_major, skey_confidence);
                                    method = "S-KEY Enhanced";
                                    enhanced = true;
                                }
                            },
                            Err(_) => {}
                        }
                    }
                },
                Err(_) => {}
            }
        }

        // Calculate additional metrics
        let tonal_clarity = self.calculate_tonal_clarity(&traditional_chroma);
        let harmonic_complexity = self.calculate_harmonic_complexity(&traditional_chroma);
        let scales = self.scale_analyzer.analyze_scales(&traditional_chroma, final_result.0);

        // Build result object
        let result = js_sys::Object::new();
        
        let key_name = format!("{} {}", 
            NOTE_NAMES[final_result.0], 
            if final_result.1 { "Major" } else { "Minor" }
        );

        js_sys::Reflect::set(&result, &"key".into(), &key_name.into()).unwrap();
        js_sys::Reflect::set(&result, &"root_note".into(), &NOTE_NAMES[final_result.0].into()).unwrap();
        js_sys::Reflect::set(&result, &"is_major".into(), &final_result.1.into()).unwrap();
        js_sys::Reflect::set(&result, &"confidence".into(), &final_result.2.into()).unwrap();
        js_sys::Reflect::set(&result, &"method".into(), &method.into()).unwrap();
        js_sys::Reflect::set(&result, &"enhanced".into(), &enhanced.into()).unwrap();
        js_sys::Reflect::set(&result, &"traditional_confidence".into(), &traditional_confidence.into()).unwrap();
        js_sys::Reflect::set(&result, &"tonal_clarity".into(), &tonal_clarity.into()).unwrap();
        js_sys::Reflect::set(&result, &"harmonic_complexity".into(), &harmonic_complexity.into()).unwrap();
        
        // Add chroma data
        let chroma_array = js_sys::Array::new();
        for &value in &traditional_chroma {
            chroma_array.push(&value.into());
        }
        js_sys::Reflect::set(&result, &"chroma".into(), &chroma_array).unwrap();

        // Add scales data
        let scales_array = js_sys::Array::new();
        for (scale_name, strength) in scales.iter().take(8) {
            let scale_obj = js_sys::Object::new();
            js_sys::Reflect::set(&scale_obj, &"name".into(), &scale_name.into()).unwrap();
            js_sys::Reflect::set(&scale_obj, &"strength".into(), &(*strength).into()).unwrap();
            js_sys::Reflect::set(&scale_obj, &"category".into(), &self.categorize_scale(scale_name).into()).unwrap();
            scales_array.push(&scale_obj);
        }
        js_sys::Reflect::set(&result, &"scales".into(), &scales_array).unwrap();

        result.into()
    }

    // Extract S-KEY specific features (chroma + auxiliary features)
    fn extract_skey_features(&self, pcm: &Float32Array) -> Result<Vec<f32>, String> {
        // 1. Extract 12-dimensional chroma
        let chroma = self.extract_chroma_advanced(pcm);
        
        // 2. Extract auxiliary features for major/minor distinction
        let auxiliary_features = self.extract_auxiliary_features(pcm)?;
        
        // 3. Combine features: 12 chroma + 3 auxiliary = 15 total
        let mut combined_features = chroma;
        combined_features.extend(auxiliary_features);
        
        Ok(combined_features)
    }

    // Extract auxiliary features that S-KEY uses for major/minor distinction
    fn extract_auxiliary_features(&self, pcm: &Float32Array) -> Result<Vec<f32>, String> {
        let max_samples = (pcm.length() / 4).min(44100 * 2); // Max 2 seconds for efficiency
        
        if max_samples < 1024 {
            return Err("Audio too short for feature extraction".to_string());
        }

        // Feature 1: Spectral Centroid (brightness indicator)
        let spectral_centroid = self.calculate_spectral_centroid_skey(pcm, max_samples);
        
        // Feature 2: Zero Crossing Rate (harmonicity indicator) 
        let zero_crossing_rate = self.calculate_zero_crossing_rate_skey(pcm, max_samples);
        
        // Feature 3: RMS Energy (dynamics indicator)
        let rms_energy = self.calculate_rms_energy_normalized_skey(pcm, max_samples);

        Ok(vec![spectral_centroid, zero_crossing_rate, rms_energy])
    }

    // Calculate spectral centroid for S-KEY
    fn calculate_spectral_centroid_skey(&self, pcm: &Float32Array, max_samples: u32) -> f32 {
        let fft_size = 2048;
        let hop_size = 1024;
        let mut total_centroid = 0.0;
        let mut frame_count = 0;

        for start in (0..max_samples as usize).step_by(hop_size) {
            if start + fft_size > max_samples as usize { break; }
            
            let mut frame = vec![0.0; fft_size];
            for i in 0..fft_size {
                frame[i] = pcm.get_index((start + i) as u32);
            }
            
            // Apply Hann window
            apply_hann_window(&mut frame);
            
            let spectrum = compute_professional_fft(&frame);
            
            let mut weighted_sum = 0.0;
            let mut magnitude_sum = 0.0;
            
            for (bin, &magnitude) in spectrum.iter().enumerate().take(spectrum.len() / 2) {
                let freq = bin as f32 * self.sample_rate / fft_size as f32;
                weighted_sum += freq * magnitude;
                magnitude_sum += magnitude;
            }
            
            if magnitude_sum > 0.0 {
                total_centroid += weighted_sum / magnitude_sum;
                frame_count += 1;
            }
        }

        if frame_count > 0 {
            let avg_centroid = total_centroid / frame_count as f32;
            // Normalize to 0-1 range (typical range: 200-8000 Hz)
            ((avg_centroid - 200.0) / 7800.0).max(0.0).min(1.0)
        } else {
            0.5
        }
    }

    // Calculate zero crossing rate for S-KEY
    fn calculate_zero_crossing_rate_skey(&self, pcm: &Float32Array, max_samples: u32) -> f32 {
        let mut crossings = 0;
        let mut total_samples = 0;
        
        for i in 1..max_samples {
            let current = pcm.get_index(i);
            let previous = pcm.get_index(i - 1);
            
            if (current >= 0.0) != (previous >= 0.0) {
                crossings += 1;
            }
            total_samples += 1;
        }

        if total_samples > 0 {
            // Normalize to 0-1 range
            ((crossings as f32 / total_samples as f32) * 2.0).min(1.0)
        } else {
            0.5
        }
    }

    // Calculate normalized RMS energy for S-KEY
    fn calculate_rms_energy_normalized_skey(&self, pcm: &Float32Array, max_samples: u32) -> f32 {
        let mut sum_squares = 0.0;
        
        for i in 0..max_samples {
            let sample = pcm.get_index(i);
            sum_squares += sample * sample;
        }
        
        let rms = (sum_squares / max_samples as f32).sqrt();
        
        if rms > 0.0 {
            let db = amplitude_to_db(rms);
            // Scale from -60dB to 0dB range
            ((db + 60.0) / 60.0).max(0.0).min(1.0)
        } else {
            0.0
        }
    }

    // Benchmark traditional vs S-KEY performance
    #[wasm_bindgen]
    pub fn benchmark_algorithms(&self, pcm: &Float32Array) -> JsValue {
        let start_time = js_sys::Date::now();
        
        // Traditional analysis
        let chroma = self.extract_chroma_advanced(pcm);
        let (trad_root, trad_major, trad_conf) = self.key_detector.detect_key(&chroma);
        let traditional_time = js_sys::Date::now() - start_time;
        
        // S-KEY analysis
        let skey_start = js_sys::Date::now();
        let skey_result = if self.skey_enabled {
            match self.extract_skey_features(pcm) {
                Ok(features) => {
                    let mut network = SKEYNetwork::new();
                    if network.initialize().is_ok() {
                        network.predict(&features).ok()
                    } else { None }
                },
                Err(_) => None
            }
        } else {
            None
        };
        let skey_time = js_sys::Date::now() - skey_start;
        
        // Build comparison result
        let result = js_sys::Object::new();
        
        // Traditional results
        let trad_obj = js_sys::Object::new();
        js_sys::Reflect::set(&trad_obj, &"key".into(), &format!("{} {}", NOTE_NAMES[trad_root], if trad_major {"Major"} else {"Minor"}).into()).unwrap();
        js_sys::Reflect::set(&trad_obj, &"confidence".into(), &trad_conf.into()).unwrap();
        js_sys::Reflect::set(&trad_obj, &"time_ms".into(), &traditional_time.into()).unwrap();
        js_sys::Reflect::set(&result, &"traditional".into(), &trad_obj).unwrap();
        
        // S-KEY results
        let skey_obj = js_sys::Object::new();
        if let Some((skey_root, skey_major, skey_conf)) = skey_result {
            js_sys::Reflect::set(&skey_obj, &"key".into(), &format!("{} {}", NOTE_NAMES[skey_root], if skey_major {"Major"} else {"Minor"}).into()).unwrap();
            js_sys::Reflect::set(&skey_obj, &"confidence".into(), &skey_conf.into()).unwrap();
            js_sys::Reflect::set(&skey_obj, &"available".into(), &true.into()).unwrap();
        } else {
            js_sys::Reflect::set(&skey_obj, &"available".into(), &self.skey_enabled.into()).unwrap();
        }
        js_sys::Reflect::set(&skey_obj, &"time_ms".into(), &skey_time.into()).unwrap();
        js_sys::Reflect::set(&result, &"skey".into(), &skey_obj).unwrap();
        
        result.into()
    }
} 