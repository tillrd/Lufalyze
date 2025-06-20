// S-KEY Integration for your existing MusicAnalyzer
// Add these dependencies to loudness-wasm/Cargo.toml:
// [dependencies]
// candle-core = "0.3"
// candle-nn = "0.3"
// # OR alternatively:
// tch = "0.15"  # PyTorch bindings

use wasm_bindgen::prelude::*;
use js_sys::Float32Array;

// Add S-KEY neural network structure to your existing code
pub struct SKEYNetwork {
    // Model components
    encoder: Vec<Vec<f32>>,      // Dense layer weights 
    key_classifier: Vec<Vec<f32>>, // 24-class classifier weights
    mode_classifier: Vec<Vec<f32>>, // 2-class major/minor weights
    initialized: bool,
}

impl SKEYNetwork {
    pub fn new() -> Self {
        SKEYNetwork {
            encoder: Vec::new(),
            key_classifier: Vec::new(), 
            mode_classifier: Vec::new(),
            initialized: false,
        }
    }

    // Load pre-trained S-KEY weights (simplified version)
    pub fn initialize(&mut self) -> Result<(), String> {
        // In production, these would be loaded from embedded model file
        // For now, initialize with placeholder weights
        
        // Encoder: 15 features -> 64 hidden units
        self.encoder = vec![vec![0.1; 64]; 15];
        
        // Key classifier: 64 hidden -> 24 keys (12 major + 12 minor)
        self.key_classifier = vec![vec![0.1; 24]; 64];
        
        // Mode classifier: 64 hidden -> 2 modes (major/minor)
        self.mode_classifier = vec![vec![0.1; 2]; 64];
        
        self.initialized = true;
        Ok(())
    }

    // S-KEY inference (simplified forward pass)
    pub fn predict(&self, features: &[f32]) -> Result<(usize, bool, f32), String> {
        if !self.initialized {
            return Err("S-KEY network not initialized".to_string());
        }

        if features.len() != 15 { // 12 chroma + 3 auxiliary features
            return Err("Invalid feature vector size".to_string());
        }

        // Forward pass: features -> encoder -> hidden
        let mut hidden = vec![0.0; 64];
        for (i, neuron_weights) in self.encoder.iter().enumerate() {
            if i < features.len() {
                for (j, &weight) in neuron_weights.iter().enumerate() {
                    hidden[j] += features[i] * weight;
                }
            }
        }

        // Apply ReLU activation
        for h in &mut hidden {
            *h = h.max(0.0);
        }

        // Key classification: hidden -> 24 key probabilities
        let mut key_logits = vec![0.0; 24];
        for (i, neuron_weights) in self.key_classifier.iter().enumerate() {
            if i < hidden.len() {
                for (j, &weight) in neuron_weights.iter().enumerate() {
                    key_logits[j] += hidden[i] * weight;
                }
            }
        }

        // Mode classification: hidden -> 2 mode probabilities
        let mut mode_logits = vec![0.0; 2];
        for (i, neuron_weights) in self.mode_classifier.iter().enumerate() {
            if i < hidden.len() {
                for (j, &weight) in neuron_weights.iter().enumerate() {
                    mode_logits[j] += hidden[i] * weight;
                }
            }
        }

        // Apply softmax to get probabilities
        let key_probs = self.softmax(&key_logits);
        let mode_probs = self.softmax(&mode_logits);

        // Find best key
        let (best_key_idx, best_key_prob) = key_probs.iter()
            .enumerate()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
            .unwrap();

        // Determine if major (mode_probs[1] > mode_probs[0])
        let is_major = mode_probs[1] > mode_probs[0];
        
        // Combined confidence
        let mode_confidence = mode_probs[if is_major { 1 } else { 0 }];
        let final_confidence = best_key_prob * mode_confidence;

        Ok((best_key_idx % 12, is_major, final_confidence))
    }

    // Simple softmax implementation
    fn softmax(&self, logits: &[f32]) -> Vec<f32> {
        let max_logit = logits.iter().fold(f32::NEG_INFINITY, |a, &b| a.max(b));
        let exp_logits: Vec<f32> = logits.iter().map(|&x| (x - max_logit).exp()).collect();
        let sum_exp: f32 = exp_logits.iter().sum();
        
        if sum_exp > 0.0 {
            exp_logits.iter().map(|&x| x / sum_exp).collect()
        } else {
            vec![1.0 / logits.len() as f32; logits.len()]
        }
    }
}

// Enhanced MusicAnalyzer with S-KEY integration
#[wasm_bindgen]
impl MusicAnalyzer {
    // Add S-KEY network as a field (you'll need to modify your struct)
    // skey_network: Option<SKEYNetwork>,

    // Enhanced analyze_music method with S-KEY integration
    pub fn analyze_music_with_skey(&self, pcm: &Float32Array) -> JsValue {
        // Extract traditional chroma (your existing method)
        let traditional_chroma = self.extract_chroma_advanced(pcm);
        
        // Run traditional algorithm
        let (traditional_root, traditional_is_major, traditional_confidence) = self.detect_key(&traditional_chroma);
        
        // Try S-KEY enhancement if traditional confidence is low
        let mut final_result = (traditional_root, traditional_is_major, traditional_confidence);
        let mut method = "Traditional";
        let mut enhanced = false;

        if traditional_confidence < 0.8 {
            // Extract S-KEY features
            match self.extract_skey_features(pcm) {
                Ok(skey_features) => {
                    // Initialize S-KEY network (lazy initialization)
                    let mut skey_network = SKEYNetwork::new();
                    
                    if skey_network.initialize().is_ok() {
                        // Run S-KEY prediction
                        match skey_network.predict(&skey_features) {
                            Ok((skey_root, skey_is_major, skey_confidence)) => {
                                // Use S-KEY result if more confident
                                if skey_confidence > traditional_confidence {
                                    final_result = (skey_root, skey_is_major, skey_confidence);
                                    method = "S-KEY";
                                    enhanced = true;
                                }
                            },
                            Err(_) => {
                                // S-KEY failed, keep traditional
                            }
                        }
                    }
                },
                Err(_) => {
                    // Feature extraction failed, keep traditional
                }
            }
        }

        // Calculate additional metrics using your existing methods
        let tonal_clarity = self.calculate_tonal_clarity(&traditional_chroma);
        let harmonic_complexity = self.calculate_harmonic_complexity(&traditional_chroma);
        let scales = self.analyze_scales(&traditional_chroma, final_result.0);

        // Build result object (similar to your existing analyze_music)
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

        // Add scales data (reuse your existing logic)
        let scales_array = js_sys::Array::new();
        for (scale_name, strength) in scales.iter().take(8) {
            let scale_obj = js_sys::Object::new();
            js_sys::Reflect::set(&scale_obj, &"name".into(), &scale_name.into()).unwrap();
            js_sys::Reflect::set(&scale_obj, &"strength".into(), &strength.into()).unwrap();
            js_sys::Reflect::set(&scale_obj, &"category".into(), &self.categorize_scale(scale_name).into()).unwrap();
            scales_array.push(&scale_obj);
        }
        js_sys::Reflect::set(&result, &"scales".into(), &scales_array).unwrap();

        result.into()
    }

    // Extract S-KEY specific features (chroma + auxiliary features)
    fn extract_skey_features(&self, pcm: &Float32Array) -> Result<Vec<f32>, String> {
        // 1. Extract 12-dimensional chroma (reuse your existing method)
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
        let spectral_centroid = self.calculate_spectral_centroid_advanced(pcm, max_samples);
        
        // Feature 2: Zero Crossing Rate (harmonicity indicator) 
        let zero_crossing_rate = self.calculate_zero_crossing_rate(pcm, max_samples);
        
        // Feature 3: RMS Energy (dynamics indicator)
        let rms_energy = self.calculate_rms_energy_normalized(pcm, max_samples);

        Ok(vec![spectral_centroid, zero_crossing_rate, rms_energy])
    }

    // Calculate spectral centroid (frequency center of mass)
    fn calculate_spectral_centroid_advanced(&self, pcm: &Float32Array, max_samples: u32) -> f32 {
        let fft_size = 2048;
        let hop_size = 1024;
        let mut total_centroid = 0.0;
        let mut frame_count = 0;

        for start in (0..max_samples as usize).step_by(hop_size) {
            if start + fft_size > max_samples as usize { break; }
            
            // Extract frame
            let mut frame = vec![0.0; fft_size];
            for i in 0..fft_size {
                frame[i] = pcm.get_index((start + i) as u32);
            }
            
            // Apply window
            for (i, sample) in frame.iter_mut().enumerate() {
                let window = 0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / (fft_size - 1) as f32).cos();
                *sample *= window;
            }
            
            // Compute magnitude spectrum
            let spectrum = self.compute_professional_fft(&frame);
            
            // Calculate centroid
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
            // Normalize to 0-1 range (typical range: 200-8000 Hz)
            let avg_centroid = total_centroid / frame_count as f32;
            (avg_centroid - 200.0) / 7800.0
        } else {
            0.5 // Default middle value
        }
    }

    // Calculate zero crossing rate
    fn calculate_zero_crossing_rate(&self, pcm: &Float32Array, max_samples: u32) -> f32 {
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
            // Normalize to 0-1 range (typical range: 0-0.5)
            (crossings as f32 / total_samples as f32) * 2.0
        } else {
            0.5
        }
    }

    // Calculate normalized RMS energy
    fn calculate_rms_energy_normalized(&self, pcm: &Float32Array, max_samples: u32) -> f32 {
        let mut sum_squares = 0.0;
        
        for i in 0..max_samples {
            let sample = pcm.get_index(i);
            sum_squares += sample * sample;
        }
        
        let rms = (sum_squares / max_samples as f32).sqrt();
        
        // Normalize using typical dynamic range
        // Convert to dB and scale to 0-1
        if rms > 0.0 {
            let db = 20.0 * rms.log10();
            // Scale from -60dB to 0dB range
            ((db + 60.0) / 60.0).max(0.0).min(1.0)
        } else {
            0.0
        }
    }

    // Hybrid key detection: combines traditional + S-KEY
    pub fn detect_key_hybrid(&self, chroma: &[f32], pcm: &Float32Array) -> (usize, bool, f32) {
        // Always run traditional first (fast and reliable)
        let (trad_root, trad_major, trad_conf) = self.detect_key(chroma);
        
        // If traditional confidence is high, use it
        if trad_conf > 0.75 {
            return (trad_root, trad_major, trad_conf);
        }
        
        // Otherwise, try S-KEY enhancement
        match self.extract_skey_features(pcm) {
            Ok(skey_features) => {
                let mut skey_network = SKEYNetwork::new();
                if skey_network.initialize().is_ok() {
                    if let Ok((skey_root, skey_major, skey_conf)) = skey_network.predict(&skey_features) {
                        // Use S-KEY if significantly more confident
                        if skey_conf > trad_conf + 0.1 {
                            return (skey_root, skey_major, skey_conf);
                        }
                    }
                }
            },
            Err(_) => {}
        }
        
        // Fallback to traditional
        (trad_root, trad_major, trad_conf)
    }
}

// Additional helper functions for S-KEY integration
impl MusicAnalyzer {
    // Load S-KEY model weights from embedded data
    pub fn load_skey_model(&self) -> Result<SKEYNetwork, String> {
        let mut network = SKEYNetwork::new();
        
        // In production, load from embedded binary data:
        // let model_data = include_bytes!("../models/s_key_weights.bin");
        // network.load_from_bytes(model_data)?;
        
        // For now, initialize with dummy weights
        network.initialize()?;
        
        Ok(network)
    }
    
    // Benchmark traditional vs S-KEY performance
    pub fn benchmark_algorithms(&self, pcm: &Float32Array) -> JsValue {
        let start_time = js_sys::Date::now();
        
        // Traditional analysis
        let chroma = self.extract_chroma_advanced(pcm);
        let (trad_root, trad_major, trad_conf) = self.detect_key(&chroma);
        let traditional_time = js_sys::Date::now() - start_time;
        
        // S-KEY analysis
        let skey_start = js_sys::Date::now();
        let skey_result = match self.extract_skey_features(pcm) {
            Ok(features) => {
                let mut network = SKEYNetwork::new();
                if network.initialize().is_ok() {
                    network.predict(&features).ok()
                } else { None }
            },
            Err(_) => None
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
            js_sys::Reflect::set(&skey_obj, &"available".into(), &false.into()).unwrap();
        }
        js_sys::Reflect::set(&skey_obj, &"time_ms".into(), &skey_time.into()).unwrap();
        js_sys::Reflect::set(&result, &"skey".into(), &skey_obj).unwrap();
        
        result.into()
    }
} 