import React, { useState } from 'react';
import clsx from 'clsx';

export interface AnalysisOptions {
  loudness: boolean;
  stereo: boolean;
  technical: boolean;
}

interface AnalysisSelectorProps {
  onSelectionChange: (options: AnalysisOptions) => void;
  onConfirm: () => void;
  estimatedTime?: number;
  fileSize?: number;
  disabled?: boolean;
}

const AnalysisSelector: React.FC<AnalysisSelectorProps> = ({
  onSelectionChange,
  onConfirm,
  estimatedTime,
  fileSize,
  disabled = false
}) => {
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisOptions>({
    loudness: true,
    stereo: true,
    technical: true
  });

  const [selectedPreset, setSelectedPreset] = useState<string>('full');

  const presets = [
    {
      id: 'quick',
      name: '⚡ Quick Analysis',
      description: 'Essential loudness analysis only',
      options: { loudness: true, stereo: false, technical: false },
      timeMultiplier: 0.3,
      icon: '⚡'
    },
    {
      id: 'standard',
      name: '🎯 Standard Analysis', 
      description: 'Loudness + stereo field analysis',
      options: { loudness: true, stereo: true, technical: false },
      timeMultiplier: 0.6,
      icon: '🎯'
    },
    {
      id: 'full',
      name: '🔬 Complete Analysis',
      description: 'All analysis types for full insights',
      options: { loudness: true, stereo: true, technical: true },
      timeMultiplier: 1.0,
      icon: '🔬'
    }
  ];

  const analysisTypes = [
    {
      key: 'loudness' as keyof AnalysisOptions,
      name: 'Loudness Analysis',
      description: 'ITU-R BS.1770-4 compliance, LUFS measurements, platform targets',
      icon: '📊',
      essential: true,
      timeWeight: 0.4
    },
    {
      key: 'stereo' as keyof AnalysisOptions,
      name: 'Stereo Field Analysis', 
      description: 'Phase correlation, stereo width, L/R balance, imaging quality',
      icon: '🎧',
      essential: false,
      timeWeight: 0.3
    },
    {
      key: 'technical' as keyof AnalysisOptions,
      name: 'Technical Analysis',
      description: 'True peak, spectral analysis, mastering assessment, quality metrics',
      icon: '🔬',
      essential: false,
      timeWeight: 0.3
    }
  ];

  const handlePresetSelect = (preset: typeof presets[0]) => {
    setSelectedPreset(preset.id);
    setSelectedAnalysis(preset.options);
    onSelectionChange(preset.options);
  };

  const handleAnalysisToggle = (key: keyof AnalysisOptions) => {
    if (key === 'loudness') return; // Loudness is always required
    
    const newOptions = {
      ...selectedAnalysis,
      [key]: !selectedAnalysis[key]
    };
    setSelectedAnalysis(newOptions);
    setSelectedPreset('custom');
    onSelectionChange(newOptions);
  };

  const getEstimatedTime = () => {
    if (!estimatedTime) return null;
    
    const selectedTypes = analysisTypes.filter(type => selectedAnalysis[type.key]);
    const totalWeight = selectedTypes.reduce((sum, type) => sum + type.timeWeight, 0);
    const baseTime = fileSize ? Math.max(3, (fileSize / (1024 * 1024)) * 2) : estimatedTime;
    
    return Math.round(baseTime * totalWeight);
  };

  const selectedCount = Object.values(selectedAnalysis).filter(Boolean).length;
  const estimatedProcessingTime = getEstimatedTime();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Choose Your Analysis
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Select which types of analysis you need. More analysis provides deeper insights but takes longer to process.
        </p>
      </div>

      {/* Quick Presets */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Quick Presets</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetSelect(preset)}
              disabled={disabled}
              className={clsx(
                "p-4 rounded-lg border-2 transition-all text-left",
                selectedPreset === preset.id
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                  : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-lg">{preset.icon}</span>
                <span className="font-medium text-gray-900 dark:text-white text-sm">
                  {preset.name}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {preset.description}
              </p>
              {estimatedTime && (
                <div className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                  ~{Math.round(estimatedTime * preset.timeMultiplier)}s
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Selection */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Custom Selection</h4>
        <div className="space-y-3">
          {analysisTypes.map((analysis) => (
            <div
              key={analysis.key}
              className={clsx(
                "flex items-start space-x-3 p-3 rounded-lg border",
                selectedAnalysis[analysis.key]
                  ? "border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/20"
                  : "border-gray-200 dark:border-gray-600"
              )}
            >
              <div className="flex-shrink-0 pt-1">
                <button
                  onClick={() => handleAnalysisToggle(analysis.key)}
                  disabled={disabled || analysis.essential}
                  className={clsx(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                    selectedAnalysis[analysis.key]
                      ? "border-green-500 bg-green-500"
                      : "border-gray-300 dark:border-gray-600",
                    (disabled || analysis.essential) && "cursor-not-allowed",
                    !analysis.essential && !disabled && "hover:border-green-400"
                  )}
                >
                  {selectedAnalysis[analysis.key] && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{analysis.icon}</span>
                  <h5 className="font-medium text-gray-900 dark:text-white">
                    {analysis.name}
                    {analysis.essential && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 rounded">
                        Required
                      </span>
                    )}
                  </h5>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {analysis.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Analysis Summary */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-4">
        <div className="text-sm">
          <span className="font-medium text-gray-900 dark:text-white">
            {selectedCount} analysis type{selectedCount !== 1 ? 's' : ''} selected
          </span>
          {estimatedProcessingTime && (
            <span className="text-gray-600 dark:text-gray-400 ml-2">
              • Estimated time: ~{estimatedProcessingTime}s
            </span>
          )}
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={onConfirm}
        disabled={disabled || selectedCount === 0}
        className={clsx(
          "w-full py-3 px-4 rounded-lg font-medium transition-colors",
          disabled || selectedCount === 0
            ? "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            : "bg-indigo-600 hover:bg-indigo-700 text-white"
        )}
      >
        {disabled ? "Processing..." : `Start Analysis (${selectedCount} type${selectedCount !== 1 ? 's' : ''})`}
      </button>
    </div>
  );
};

export default AnalysisSelector; 