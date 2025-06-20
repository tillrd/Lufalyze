import React, { useEffect, useState } from 'react';
import clsx from 'clsx';

interface AnalysisStage {
  id: string;
  title: string;
  description: string;
  icon: string;
  minProgress: number;
  maxProgress: number;
}

const ANALYSIS_STAGES: AnalysisStage[] = [
  { id: 'setup', title: 'Initializing', description: 'Loading audio processing modules', icon: '⚙️', minProgress: 0, maxProgress: 15 },
  { id: 'decode', title: 'Decoding Audio', description: 'Converting audio data to PCM samples', icon: '🎵', minProgress: 15, maxProgress: 25 },
  { id: 'loudness', title: 'Analyzing Loudness', description: 'Measuring perceived loudness using broadcast standards', icon: '📊', minProgress: 25, maxProgress: 35 },
  { id: 'truepeak', title: 'Detecting Peaks', description: 'Scanning for inter-sample peaks', icon: '📈', minProgress: 35, maxProgress: 45 },
  { id: 'spectral', title: 'Spectral Analysis', description: 'Examining frequency content and tonal balance', icon: '🌈', minProgress: 45, maxProgress: 55 },
  { id: 'music', title: 'Key Detection', description: 'Identifying harmonic content and musical scales', icon: '🎼', minProgress: 55, maxProgress: 65 },
  { id: 'stereo', title: 'Stereo Analysis', description: 'Evaluating stereo imaging and phase relationships', icon: '🎧', minProgress: 65, maxProgress: 75 },
  { id: 'quality', title: 'Quality Check', description: 'Detecting clipping, noise, and technical issues', icon: '🔍', minProgress: 75, maxProgress: 85 },
  { id: 'mastering', title: 'Final Processing', description: 'Assessing overall production quality', icon: '🎛️', minProgress: 85, maxProgress: 95 },
  { id: 'complete', title: 'Complete', description: 'Generating comprehensive audio report', icon: '✅', minProgress: 95, maxProgress: 100 }
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

  useEffect(() => {
    const targetStage = ANALYSIS_STAGES.find(stage => 
      progress >= stage.minProgress && progress < stage.maxProgress
    ) || ANALYSIS_STAGES[ANALYSIS_STAGES.length - 1];
    
    setCurrentStage(targetStage);

    // Mark stages as completed
    setCompletedStages(prevCompleted => {
      const newCompleted = new Set(prevCompleted);
      ANALYSIS_STAGES.forEach(stage => {
        if (progress >= stage.maxProgress) {
          newCompleted.add(stage.id);
        }
      });
      return newCompleted;
    });
  }, [progress]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Analyzing Audio
          </h2>
          {fileName && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {fileName}
            </p>
          )}
        </div>

        {/* Overall Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Overall Progress
            </span>
            <span className="text-sm font-medium text-indigo-600">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="h-full bg-indigo-600 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stage Cards */}
        <div className="space-y-3 mb-6">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
            Analysis Pipeline
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ANALYSIS_STAGES.map((stage, index) => {
              const isCompleted = completedStages.has(stage.id);
              const isCurrent = currentStage.id === stage.id;
              const isUpcoming = progress < stage.minProgress;

              return (
                <div
                  key={stage.id}
                  className={clsx(
                    "flex items-center space-x-3 p-3 rounded-lg border",
                    isCurrent && "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700",
                    isCompleted && "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700",
                    isUpcoming && "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-600"
                  )}
                >
                  <div className={clsx(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium",
                    isCompleted && "bg-green-500 text-white",
                    isCurrent && "bg-indigo-500 text-white",
                    isUpcoming && "bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400"
                  )}>
                    {isCompleted ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={clsx(
                      "text-sm font-medium truncate",
                      isCurrent && "text-indigo-900 dark:text-indigo-100",
                      isCompleted && "text-green-800 dark:text-green-200",
                      isUpcoming && "text-gray-500 dark:text-gray-400"
                    )}>
                      {stage.title}
                    </p>
                    <p className={clsx(
                      "text-xs truncate",
                      isCurrent && "text-indigo-700 dark:text-indigo-300",
                      isCompleted && "text-green-600 dark:text-green-400",
                      isUpcoming && "text-gray-400 dark:text-gray-500"
                    )}>
                      {stage.description}
                    </p>
                  </div>
                  <div className="text-lg">
                    {stage.icon}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Current Stage Info */}
        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 border border-indigo-200 dark:border-indigo-700">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">{currentStage.icon}</div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100">
                {currentStage.title}
              </h3>
              <p className="text-sm text-indigo-700 dark:text-indigo-300">
                {currentStage.description}
              </p>
            </div>
            <div className="flex items-center text-indigo-600">
              <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm font-medium">Processing...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisLoadingScreen; 