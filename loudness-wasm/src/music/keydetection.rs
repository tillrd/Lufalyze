use crate::constants::*;
use crate::utils::calculate_enhanced_correlation;

pub struct KeyDetector {
}

impl KeyDetector {
    pub fn new() -> Self {
        KeyDetector {}
    }

    // Professional key detection using hybrid voting (classical + modern profiles)
    pub fn detect_key(&self, chroma: &[f32]) -> (usize, bool, f32) { // (root, is_major, confidence)
        // Hybrid voting approach: combine multiple professional profiles
        let mut profile_results = Vec::new();
        
        // Test EDM-A profiles (93% accuracy on modern datasets)
        let edma_result = self.test_profile_set(chroma, &EDMA_MAJOR, &EDMA_MINOR, "EDM-A");
        profile_results.push((edma_result, 0.35)); // Highest weight for modern music
        
        // Test Hybrid profiles (optimized combination)
        let hybrid_result = self.test_profile_set(chroma, &HYBRID_MAJOR, &HYBRID_MINOR, "Hybrid");
        profile_results.push((hybrid_result, 0.25));
        
        // Test Krumhansl-Schmuckler (classical reliability)
        let ks_result = self.test_profile_set(chroma, &KS_MAJOR, &KS_MINOR, "K-S");
        profile_results.push((ks_result, 0.20));
        
        // Test Temperley (good for popular music)
        let temperley_result = self.test_profile_set(chroma, &TEMPERLEY_MAJOR, &TEMPERLEY_MINOR, "Temperley");
        profile_results.push((temperley_result, 0.15));
        
        // Test Shaath (electronic music specialist)
        let shaath_result = self.test_profile_set(chroma, &SHAATH_MAJOR, &SHAATH_MINOR, "Shaath");
        profile_results.push((shaath_result, 0.05));
        
        // Weighted consensus voting
        let consensus = self.calculate_weighted_consensus(&profile_results);
        
        // Enhanced confidence calculation (return as 0-1 range, not percentage)
        let agreement_factor = self.calculate_profile_agreement(&profile_results);
        let final_confidence = (consensus.2 * agreement_factor).max(0.05).min(0.95);
        
        (consensus.0, consensus.1, final_confidence)
    }

    // Test a specific profile set (major/minor pair)
    fn test_profile_set(&self, chroma: &[f32], major_profile: &[f32], minor_profile: &[f32], _name: &str) -> (usize, bool, f32) {
        let mut best_correlation = -1.0;
        let mut best_root = 0;
        let mut best_is_major = true;
        
        for root in 0..12 {
            // Test major key
            let major_corr = calculate_enhanced_correlation(chroma, major_profile, root);
            if major_corr > best_correlation {
                best_correlation = major_corr;
                best_root = root;
                best_is_major = true;
            }
            
            // Test minor key
            let minor_corr = calculate_enhanced_correlation(chroma, minor_profile, root);
            if minor_corr > best_correlation {
                best_correlation = minor_corr;
                best_root = root;
                best_is_major = false;
            }
        }
        
        // Convert correlation to normalized confidence [0, 1]
        let confidence = ((best_correlation + 1.0) / 2.0).max(0.0_f32).min(1.0_f32);
        
        (best_root, best_is_major, confidence)
    }

    // Calculate weighted consensus from multiple profile results
    fn calculate_weighted_consensus(&self, results: &[((usize, bool, f32), f32)]) -> (usize, bool, f32) {
        let mut key_votes = vec![0.0; 24]; // 12 major + 12 minor keys
        let mut total_weight = 0.0;
        
        for &((root, is_major, confidence), weight) in results {
            let key_idx = if is_major { root } else { root + 12 };
            let vote_strength = confidence * weight;
            key_votes[key_idx] += vote_strength;
            total_weight += vote_strength;
        }
        
        // Find winning key
        let (best_idx, &best_score) = key_votes
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
            .unwrap_or((0, &0.0));
        
        let consensus_root = best_idx % 12;
        let consensus_is_major = best_idx < 12;
        let consensus_confidence = if total_weight > 0.0 {
            best_score / total_weight
        } else {
            0.0
        };
        
        (consensus_root, consensus_is_major, consensus_confidence)
    }

    // Calculate agreement between different profile sets
    fn calculate_profile_agreement(&self, results: &[((usize, bool, f32), f32)]) -> f32 {
        if results.len() < 2 { return 1.0; }
        
        let mut total_agreement = 0.0;
        let mut pair_count = 0;
        
        for i in 0..results.len() {
            for j in (i+1)..results.len() {
                let (root1, major1, conf1) = results[i].0;
                let (root2, major2, conf2) = results[j].0;
                
                let agreement = if root1 == root2 && major1 == major2 {
                    1.0 // Perfect agreement
                } else if root1 == root2 {
                    0.7 // Same root, different mode
                } else if (root1 + 3) % 12 == root2 || (root2 + 3) % 12 == root1 {
                    0.6 // Relative major/minor
                } else if (root1 + 7) % 12 == root2 || (root2 + 7) % 12 == root1 {
                    0.4 // Fifth relationship
                } else {
                    0.0 // No relationship
                };
                
                // Weight by confidence of both results
                let weight = (conf1 * conf2).sqrt();
                total_agreement += agreement * weight;
                pair_count += 1;
            }
        }
        
        if pair_count > 0 {
            (total_agreement / pair_count as f32).max(0.3) // Minimum 30% agreement
        } else {
            1.0
        }
    }
} 