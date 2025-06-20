import React, { useEffect, useState } from 'react';
import clsx from 'clsx';

interface AnalysisStage {
  id: string;
  title: string;
  description: string;
  icon: string;
  minProgress: number;
  maxProgress: number;
  technical: string;
}

const ANALYSIS_STAGES: AnalysisStage[] = [
  {
    id: 'setup',
    title: 'Initializing WebAssembly Engine',
    description: 'Loading high-performance audio processing modules',
    technical: 'Bootstrapping Rust WASM analyzer with ITU-R BS.1770-4 algorithms',
    icon: '⚙️',
    minProgress: 0,
    maxProgress: 15
  },
  {
    id: 'decode',
    title: 'Decoding Audio Stream',
    description: 'Converting audio data to PCM samples',
    technical: 'Extracting raw audio buffer and metadata for processing',
    icon: '🎵',
    minProgress: 15,
    maxProgress: 25
  },
  {
    id: 'loudness',
    title: 'Analyzing Loudness Standards',
    description: 'Measuring perceived loudness using broadcast standards',
    technical: 'ITU-R BS.1770-4 K-weighted gating with 400ms/3s integration',
    icon: '📊',
    minProgress: 25,
    maxProgress: 35
  },
  {
    id: 'truepeak',
    title: 'True Peak Detection',
    description: 'Scanning for inter-sample peaks and broadcast compliance',
    technical: '4x oversampling interpolation for dBTP measurement & platform validation',
    icon: '📈',
    minProgress: 35,
    maxProgress: 45
  },
  {
    id: 'spectral',
    title: 'Spectral Analysis',
    description: 'Examining frequency content and tonal balance',
    technical: 'FFT-based frequency decomposition with 7-band EQ analysis',
    icon: '🌈',
    minProgress: 45,
    maxProgress: 55
  },
  {
    id: 'music',
    title: 'Musical Key Detection',
    description: 'Identifying harmonic content and musical scales',
    technical: 'Chromagram analysis with Krumhansl-Schmuckler key profiling',
    icon: '🎼',
    minProgress: 55,
    maxProgress: 65
  },
  {
    id: 'stereo',
    title: 'Stereo Field Analysis',
    description: 'Evaluating stereo imaging and phase relationships',
    technical: 'Mid/Side analysis with phase correlation & mono compatibility',
    icon: '🎧',
    minProgress: 65,
    maxProgress: 75
  },
  {
    id: 'quality',
    title: 'Quality Assessment',
    description: 'Detecting clipping, noise, and technical issues',
    technical: 'Digital artifact detection, DC offset & silence gap analysis',
    icon: '🔍',
    minProgress: 75,
    maxProgress: 85
  },
  {
    id: 'mastering',
    title: 'Mastering Evaluation',
    description: 'Assessing overall production quality and dynamics',
    technical: 'PLR calculation, punch/warmth/clarity scoring & DR measurement',
    icon: '🎛️',
    minProgress: 85,
    maxProgress: 95
  },
  {
    id: 'complete',
    title: 'Analysis Complete',
    description: 'Generating comprehensive audio report',
    technical: 'Finalizing metrics aggregation and compliance validation',
    icon: '✅',
    minProgress: 95,
    maxProgress: 100
  }
];

interface AnalysisLoadingScreenProps {
  progress: number;
  fileName?: string;
  isVisible: boolean;
}

const AnalysisLoadingScreen: React.FC<AnalysisLoadingScreenProps> = ({ 
  progress, 
  fileName, 
  isVisible 
}) => {
  const [currentStage, setCurrentStage] = useState<AnalysisStage>(ANALYSIS_STAGES[0]);
  const [completedStages, setCompletedStages] = useState<Set<string>>(new Set());
  const [showTechnical, setShowTechnical] = useState(false);

  // Update current stage based on progress
  useEffect(() => {
    const stage = ANALYSIS_STAGES.find(s => 
      progress >= s.minProgress && progress <= s.maxProgress
    ) || ANALYSIS_STAGES[ANALYSIS_STAGES.length - 1];
    
    setCurrentStage(prevStage => {
      // Only update if the stage actually changed
      return prevStage.id !== stage.id ? stage : prevStage;
    });

    // Mark stages as completed using functional update
    setCompletedStages(prevCompleted => {
      const newCompleted = new Set(prevCompleted);
      let hasChanges = false;
      
      ANALYSIS_STAGES.forEach(s => {
        if (progress > s.maxProgress && !newCompleted.has(s.id)) {
          newCompleted.add(s.id);
          hasChanges = true;
        }
      });
      
      // Only return new Set if there are actual changes
      return hasChanges ? newCompleted : prevCompleted;
    });
  }, [progress]);

  // Auto-toggle technical details
  useEffect(() => {
    const interval = setInterval(() => {
      setShowTechnical(prev => !prev);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-8 max-w-2xl w-full mx-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center animate-pulse">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Analyzing Audio
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {fileName ? `Processing: ${fileName}` : 'Professional audio analysis in progress'}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Overall Progress
            </span>
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500 ease-out relative overflow-hidden"
              style={{ width: `${progress}%` }}
            >
              {/* Animated shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            </div>
          </div>
        </div>

        {/* Current Stage */}
        <div className="mb-8">
          <div className="flex items-start space-x-4 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800">
            <div className="text-3xl animate-bounce">
              {currentStage.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {currentStage.title}
              </h3>
              <div className="space-y-2">
                <p 
                  className={clsx(
                    "text-gray-600 dark:text-gray-300 transition-opacity duration-500",
                    showTechnical ? "opacity-0" : "opacity-100"
                  )}
                >
                  {currentStage.description}
                </p>
                <p 
                  className={clsx(
                    "text-xs text-indigo-600 dark:text-indigo-400 font-mono transition-opacity duration-500",
                    showTechnical ? "opacity-100" : "opacity-0"
                  )}
                >
                  {currentStage.technical}
                </p>
              </div>
            </div>
            <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
              {Math.round(((progress - currentStage.minProgress) / (currentStage.maxProgress - currentStage.minProgress)) * 100)}%
            </div>
          </div>
        </div>

        {/* Stage Timeline */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Analysis Pipeline</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ANALYSIS_STAGES.map((stage, index) => {
              const isCompleted = completedStages.has(stage.id);
              const isCurrent = currentStage.id === stage.id;
              const isUpcoming = progress < stage.minProgress;

              return (
                <div
                  key={stage.id}
                  className={clsx(
                    "flex items-center space-x-3 p-3 rounded-lg transition-all duration-300",
                    isCurrent && "bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-300 dark:border-indigo-700",
                    isCompleted && "bg-green-50 dark:bg-green-900/20",
                    isUpcoming && "bg-gray-50 dark:bg-gray-800/50"
                  )}
                >
                  <div className={clsx(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all duration-300",
                    isCompleted && "bg-green-500 text-white",
                    isCurrent && "bg-indigo-500 text-white animate-pulse",
                    isUpcoming && "bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400"
                  )}>
                    {isCompleted ? (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={clsx(
                      "text-xs font-medium truncate transition-colors duration-300",
                      isCurrent && "text-indigo-900 dark:text-indigo-100",
                      isCompleted && "text-green-800 dark:text-green-200",
                      isUpcoming && "text-gray-500 dark:text-gray-400"
                    )}>
                      {stage.title}
                    </p>
                  </div>
                  <div className="text-xs opacity-60">
                    {stage.icon}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
              <span>Real-time processing</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>WebAssembly powered</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-purple-500 rounded-full" />
              <span>ITU-R BS.1770-4 compliant</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisLoadingScreen; 