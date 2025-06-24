// Module declarations
mod constants;
mod utils;
mod loudness;
mod music;
mod stereo;
mod technical;

// Re-export public interfaces
pub use loudness::LoudnessAnalyzer;
// Music analysis removed
pub use stereo::StereoAnalyzer;
pub use technical::TechnicalAnalyzer;

// Module-based architecture for professional audio analysis WASM library

pub fn add(left: u64, right: u64) -> u64 {
    left + right
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }
}

