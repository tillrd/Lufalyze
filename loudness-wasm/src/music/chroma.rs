// Chroma extraction has been removed from this application
// This is a stub to maintain build compatibility

use js_sys::Float32Array;

pub struct ChromaExtractor {
    sample_rate: f32,
}

impl ChromaExtractor {
    pub fn new(sample_rate: f32) -> Self {
        ChromaExtractor { sample_rate }
    }

    pub fn extract_advanced(&self, _pcm: &Float32Array) -> Vec<f32> {
        // Return empty chroma vector since music analysis is removed
        vec![0.0; 12]
    }
} 