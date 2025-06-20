use crate::constants::*;

pub struct ScaleAnalyzer {
}

impl ScaleAnalyzer {
    pub fn new() -> Self {
        ScaleAnalyzer {}
    }

    // Enhanced scale analysis testing all roots for all patterns
    pub fn analyze_scales(&self, chroma: &[f32], _detected_root: usize) -> Vec<(String, f32)> {
        let mut scale_matches = Vec::new();
        
        // Process the most common scales for performance
        let common_patterns = [
            (&SCALE_PATTERNS[0], "Major"),
            (&SCALE_PATTERNS[1], "Natural Minor"),
            (&SCALE_PATTERNS[2], "Harmonic Minor"),
            (&SCALE_PATTERNS[4], "Dorian"),
            (&SCALE_PATTERNS[6], "Lydian"),
            (&SCALE_PATTERNS[7], "Mixolydian"),
            (&SCALE_PATTERNS[10], "Pentatonic Major"),
            (&SCALE_PATTERNS[11], "Pentatonic Minor"),
            (&SCALE_PATTERNS[12], "Blues"),
        ];
        
        // Test each scale pattern at all 12 possible roots
        for &((pattern, _), name) in &common_patterns {
            for root in 0..12 {
                let scale_strength = self.calculate_scale_fit_corrected(chroma, pattern, root);
                
                if scale_strength > 0.10 { // Higher threshold for better results
                    scale_matches.push((format!("{} {}", NOTE_NAMES[root], name), scale_strength));
                }
            }
        }
        
        // Sort by strength and return top 8 for better variety
        scale_matches.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        scale_matches.truncate(8);
        
        scale_matches
    }

    // Corrected scale fit calculation with proper interval mapping
    fn calculate_scale_fit_corrected(&self, chroma: &[f32], pattern: &[usize], root: usize) -> f32 {
        let mut in_scale_energy = 0.0;
        let mut out_scale_energy = 0.0;
        let mut pattern_weights = 0.0;
        let mut _total_weights = 0.0;
        
        // Calculate energy distribution for scale pattern
        for i in 0..12 {
            let note_interval = (i - root + 12) % 12; // Correct interval calculation
            let energy = chroma[i];
            
            if pattern.contains(&note_interval) {
                // Dynamic weighting based on scale degree importance
                let weight = match note_interval {
                    0 => 3.0,    // Root (tonic) - most important
                    4 | 3 => 2.0, // Third (major/minor) - defines mode
                    7 => 2.0,    // Fifth - harmonic foundation
                    2 | 9 => 1.5, // Second and sixth - secondary tones
                    5 | 10 => 1.3, // Fourth and seventh - tendency tones
                    _ => 1.0,    // Other scale tones
                };
                in_scale_energy += energy * weight;
                pattern_weights += weight;
            } else {
                // Penalize non-scale tones more heavily
                out_scale_energy += energy * 2.0;
            }
            _total_weights += 1.0;
        }
        
        // Normalize by pattern size and weights
        if pattern_weights == 0.0 { return 0.0; }
        
        let normalized_in_scale = in_scale_energy / pattern_weights;
        let normalized_out_scale = out_scale_energy / (12.0 - pattern.len() as f32);
        
        let total_normalized = normalized_in_scale + normalized_out_scale;
        if total_normalized == 0.0 { return 0.0; }
        
        // Calculate fit ratio with penalty for out-of-scale energy
        let fit_ratio = normalized_in_scale / total_normalized;
        let penalty = 1.0 / (1.0 + normalized_out_scale * 3.0); // Penalty for out-of-scale notes
        
        // Apply gentle enhancement with penalty
        (fit_ratio * penalty).powf(0.8)
    }
} 