import React, { useState } from 'react';
import clsx from 'clsx';
import { AnalysisOptions } from './AnalysisSelector';

interface AnalysisUpgradeProps {
  currentOptions: AnalysisOptions;
  onUpgrade: (options: AnalysisOptions) => void;
  estimatedTime?: number;
  fileSize?: number;
  disabled?: boolean;
  onClose?: () => void;
}

const AnalysisUpgrade: React.FC<AnalysisUpgradeProps> = ({
  currentOptions,
  onUpgrade,
  estimatedTime,
  fileSize,
  disabled = false,
  onClose
}) => {
  const [selectedUpgrade, setSelectedUpgrade] = useState<string>('');

  const getCurrentAnalysisName = () => {
    const { loudness, stereo, technical } = currentOptions;
    if (loudness && !stereo && !technical) return 'Quick';
    if (loudness && stereo && !technical) return 'Standard';
    if (loudness && stereo && technical) return 'Complete';
    return 'Custom';
  };

  const getAvailableUpgrades = () => {
    const current = getCurrentAnalysisName();
    const upgrades = [];

    if (current === 'Quick') {
      // After Quick Analysis: Only offer Stereo Analysis upgrade
      upgrades.push({
        id: 'standard',
        name: '🎯 Add Stereo Analysis',
        description: 'Include stereo field and phase correlation analysis',
        options: { loudness: true, stereo: true, technical: false },
        timeMultiplier: 0.4, // Additional time for stereo analysis
        additionalFeatures: ['Stereo width analysis', 'Phase correlation', 'L/R balance', 'Imaging quality']
      });
    } else if (current === 'Standard') {
      // After Standard Analysis: Only offer Technical Analysis upgrade
      upgrades.push({
        id: 'complete',
        name: '🔬 Add Technical Analysis',
        description: 'Include technical analysis for comprehensive insights',
        options: { loudness: true, stereo: true, technical: true },
        timeMultiplier: 0.4, // Additional time for technical analysis
        additionalFeatures: ['True peak detection', 'Spectral analysis', 'Technical quality metrics', 'Mastering assessment']
      });
    }
    // No upgrades available for Complete analysis

    return upgrades;
  };

  const getEstimatedAdditionalTime = (timeMultiplier: number) => {
    if (!estimatedTime) return null;
    const baseTime = fileSize ? Math.max(2, (fileSize / (1024 * 1024)) * 1.5) : estimatedTime;
    return Math.round(baseTime * timeMultiplier);
  };

  const availableUpgrades = getAvailableUpgrades();

  if (availableUpgrades.length === 0) {
    return null; // No upgrades available
  }

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border-2 border-dashed border-indigo-200 dark:border-indigo-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Want More Insights?
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            You completed <span className="font-medium text-indigo-600 dark:text-indigo-400">{getCurrentAnalysisName()} Analysis</span>. 
            {getCurrentAnalysisName() === 'Quick' 
              ? 'Add stereo analysis for spatial audio insights.'
              : 'Add technical analysis for comprehensive professional insights.'
            }
          </p>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors"
            aria-label="Close upgrade options"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {availableUpgrades.map((upgrade) => {
          const additionalTime = getEstimatedAdditionalTime(upgrade.timeMultiplier);
          
          return (
            <button
              key={upgrade.id}
              onClick={() => setSelectedUpgrade(upgrade.id)}
              disabled={disabled}
              className={clsx(
                "p-5 rounded-xl border-2 transition-all text-left group hover:scale-[1.02]",
                selectedUpgrade === upgrade.id
                  ? "border-indigo-500 bg-white dark:bg-gray-800 shadow-lg"
                  : "border-gray-200 dark:border-gray-600 bg-white/70 dark:bg-gray-800/70 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-white dark:hover:bg-gray-800",
                disabled && "opacity-50 cursor-not-allowed hover:scale-100"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900 dark:text-white text-lg">
                  {upgrade.name}
                </h4>
                {additionalTime && (
                  <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 px-2 py-1 rounded-full">
                    +{additionalTime}s
                  </span>
                )}
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {upgrade.description}
              </p>
              
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Additional Features:
                </p>
                {upgrade.additionalFeatures.slice(0, 3).map((feature, index) => (
                  <div key={index} className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                    <svg className="w-3 h-3 text-green-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </div>
                ))}
                {upgrade.additionalFeatures.length > 3 && (
                  <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                    +{upgrade.additionalFeatures.length - 3} more features...
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selectedUpgrade && (
        <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-sm">
            <span className="font-medium text-gray-900 dark:text-white">
              Ready to run additional analysis?
            </span>
            {getEstimatedAdditionalTime(availableUpgrades.find(u => u.id === selectedUpgrade)?.timeMultiplier || 0) && (
              <span className="text-gray-600 dark:text-gray-400 ml-2">
                • Additional time: ~{getEstimatedAdditionalTime(availableUpgrades.find(u => u.id === selectedUpgrade)?.timeMultiplier || 0)}s
              </span>
            )}
          </div>
          
          <button
            onClick={() => {
              console.log('🔥 Start Analysis button clicked!');
              console.log('📊 Selected upgrade:', selectedUpgrade);
              const upgrade = availableUpgrades.find(u => u.id === selectedUpgrade);
              console.log('🎯 Found upgrade:', upgrade);
              if (upgrade) {
                console.log('✅ Calling onUpgrade with options:', upgrade.options);
                onUpgrade(upgrade.options);
              } else {
                console.error('❌ No upgrade found for ID:', selectedUpgrade);
              }
            }}
            disabled={disabled}
            className={clsx(
              "px-6 py-2 rounded-lg font-medium transition-colors",
              disabled
                ? "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg"
            )}
                      >
              {disabled ? "Processing..." : "Start Analysis"}
            </button>
        </div>
      )}
    </div>
  );
};

export default AnalysisUpgrade; 